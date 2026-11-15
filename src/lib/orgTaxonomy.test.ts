/* ══ orgTaxonomy.test.ts - the two facets the directory filters on ═══════
 * Sector and technology replaced the old "level" and "focus" filters, and both
 * are derived from free text a program or GitHub wrote. These cases pin the
 * folds that keep the dropdowns honest, plus the word-boundary rule: a bucket
 * used to be picked by the first keyword present anywhere, which let
 * "workspace" read as space and "observability" read as an observatory.
 */
import { describe, expect, it } from "vitest";
import { SECTORS, langToTech, normalizeTechs, sectorOf, techRank } from "./orgTaxonomy";
import { ORGS } from "@/data/orgs";
import { ORG_CLASS } from "@/data/orgClass";
import { CLASSIFIED, SECTOR_FACETS, TECH_FACETS } from "./orgClasses";

describe("sectorOf", () => {
  it("folds a program's own category onto a bucket", () => {
    expect(sectorOf("Science and medicine")).toBe("Science & Medicine");
    expect(sectorOf("Radio Astronomy & Signal Processing")).toBe("Space & Geospatial");
    expect(sectorOf("Hyperledger")).toBe("Blockchain & Web3");
  });

  it("does not read an unrelated word as a keyword", () => {
    expect(sectorOf("Cloud-native observability tooling for Kubernetes clusters")).toBe("Cloud & Infrastructure");
    expect(sectorOf("Workspace automation framework for developers")).not.toBe("Space & Geospatial");
    expect(sectorOf("The department of everything")).not.toBe("Media, Arts & Design");
  });

  it("lets the row's own summary outrank one stray repository blurb", () => {
    expect(sectorOf("Robotics manipulation stack", "also ships a web dashboard")).toBe("Robotics & Hardware");
  });

  it("says Other rather than guessing when the text carries nothing", () => {
    expect(sectorOf("")).toBe("Other");
    expect(sectorOf(null, undefined, "")).toBe("Other");
  });
});

describe("normalizeTechs", () => {
  it("folds contributor spellings onto one vocabulary", () => {
    expect(normalizeTechs(["#js", "node js", "K8s", "c/c++"])).toEqual(["c++", "javascript", "kubernetes", "node.js"]);
  });

  it("drops the words that are a skill sentence, not a technology", () => {
    expect(normalizeTechs(["Advanced data structures", "communication", "python"])).toEqual(["python"]);
  });

  it("maps GitHub language names", () => {
    expect(langToTech("Jupyter Notebook")).toBe("jupyter");
    expect(langToTech("Golang")).toBe("go");
  });
});

describe("techRank", () => {
  it("orders by how many rows list the technology, then alphabetically", () => {
    const ranked = techRank([{ techs: ["python", "go"] }, { techs: ["python"] }, { techs: ["zod"] }, { techs: ["go"] }]);
    expect(ranked.slice(0, 2)).toEqual([["go", 2], ["python", 2]]);
  });
});

describe("the generated directory classification", () => {
  it("classifies every organization the directory lists", () => {
    for (const o of ORGS) {
      const row = ORG_CLASS[o.login];
      expect(row, `${o.login} has no class row - re-run npx tsx scripts/build-org-class.mjs`).toBeTruthy();
      expect(SECTORS).toContain(row.sector);
    }
    expect(CLASSIFIED.length).toBe(ORGS.length);
  });

  it("keeps technologies lowercase, unique and in the explorer's vocabulary", () => {
    for (const c of CLASSIFIED) {
      expect(c.techs).toEqual([...new Set(c.techs)]);
      for (const t of c.techs) expect(t).toBe(t.toLowerCase());
    }
  });

  it("puts the well-known organizations in a defensible field", () => {
    const sector = (login: string) => CLASSIFIED.find((c) => c.org.login === login)?.sector;
    expect(sector("kubernetes")).toBe("Cloud & Infrastructure");
    expect(sector("tensorflow")).toBe("AI & Machine Learning");
    expect(sector("openstreetmap")).toBe("Space & Geospatial");
    expect(sector("godotengine")).toBe("Media, Arts & Design");
  });

  it("offers facets that each have an organization behind them", () => {
    for (const f of SECTOR_FACETS) expect(f.n).toBeGreaterThan(0);
    for (const t of TECH_FACETS) expect(CLASSIFIED.some((c) => c.techs.includes(t))).toBe(true);
  });
});
