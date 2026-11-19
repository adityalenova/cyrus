/* ══ onboarding.test.ts — the wizard's own promises ═══════════════════
   The URL is the wizard's only memory, and the recommender is the only
   thing standing between a visitor's five clicks and a wall of unrelated
   projects, so both are tested here rather than in a browser.      ══ */
import { describe, expect, it } from "vitest";
import type { ArchiveRow } from "./programProjects";
import {
  EMPTY_DRAFT, LAST_STEP, STEPS,
  advance, back, canAdvance, coverage, domainOptions, draftFromParams, draftToParams,
  goTo, isReadyToSave, jump, missingFor, percent, programOptions, recommend, scoreRow,
  skip, stepIndex, summaryOf, techOptions, toggle,
} from "./onboarding";
import type { Draft } from "./onboarding";

const row = (o: Partial<ArchiveRow> = {}): ArchiveRow => ({
  key: "k-" + (o.title ?? "row"),
  id: "gsoc",
  title: "Sample project",
  org: "octo",
  orgUrl: "https://github.com/octo",
  program: "GSoC",
  year: 2025,
  tags: [],
  body: "",
  mentor: "",
  url: "https://example.com/repo",
  stars: 10,
  lang: "",
  season: "",
  ...o,
});

const draft = (o: Partial<Draft> = {}): Draft => ({ ...EMPTY_DRAFT, ...o });

describe("step index", () => {
  it("opens at the start without a parameter", () => {
    expect(stepIndex(null)).toBe(0);
  });
  it("accepts every real step", () => {
    for (let i = 0; i <= LAST_STEP; i++) expect(stepIndex(String(i))).toBe(i);
  });
  it("refuses a step that does not exist rather than showing a blank page", () => {
    expect(stepIndex("99")).toBe(0);
    expect(stepIndex("-1")).toBe(0);
    expect(stepIndex("abc")).toBe(0);
    expect(stepIndex("1.5")).toBe(0);
  });
});

describe("URL state", () => {
  it("writes nothing for a wizard nobody has touched", () => {
    expect(draftToParams(EMPTY_DRAFT).toString()).toBe("");
  });
  it("keeps a domain whose name contains a comma", () => {
    const d = draft({ sectors: ["Media, Arts & Design", "AI & Machine Learning"] });
    expect(draftFromParams(draftToParams(d)).sectors).toEqual(["Media, Arts & Design", "AI & Machine Learning"]);
  });
  it("round-trips a bio full of characters a query string cares about", () => {
    const d = draft({ name: "Ada", bio: "Rust & Go, mostly a=1&b=2? here" });
    const again = draftFromParams(draftToParams(d));
    expect(again.bio).toBe(d.bio);
    expect(again.name).toBe("Ada");
  });
  it("collapses a pick repeated in the query", () => {
    const sp = new URLSearchParams("tech=react|react|vue");
    expect(draftFromParams(sp).techs).toEqual(["react", "vue"]);
  });
  it("drops an empty step parameter instead of storing zero twice", () => {
    expect(draftToParams(EMPTY_DRAFT).has("s")).toBe(false);
    expect(draftToParams(draft({ step: 0 })).has("s")).toBe(false);
    expect(draftToParams(draft({ step: 2 })).get("s")).toBe("2");
  });
  it("survives a full five-step draft in both directions", () => {
    const d = draft({
      step: 4, name: "Grace", bio: "compiler person", avatar: "https://e.com/g.png",
      techs: ["go", "typescript"], sectors: ["Databases & Data"], programs: ["gsoc", "lfx"],
    });
    expect(draftFromParams(draftToParams(d))).toEqual(d);
  });
});

describe("what each step requires", () => {
  it("asks for a name before leaving the welcome", () => {
    expect(missingFor(0, draft({ name: "" }))).toHaveLength(1);
    expect(missingFor(0, draft({ name: "A" }))).toHaveLength(1);
    expect(canAdvance(0, draft({ name: "A" }))).toBe(false);
    expect(canAdvance(0, draft({ name: "Ada" }))).toBe(true);
  });
  it("accepts a language or a domain as an answer on interests", () => {
    expect(canAdvance(1, draft({ techs: ["go"] }))).toBe(true);
    expect(canAdvance(1, draft({ sectors: ["Security & Privacy"] }))).toBe(true);
    expect(canAdvance(1, draft())).toBe(false);
  });
  it("never blocks on programs, matches or the account step", () => {
    for (const step of [2, 3, LAST_STEP]) {
      expect(missingFor(step, draft())).toEqual([]);
      expect(canAdvance(step, draft())).toBe(true);
    }
  });
});

describe("progress", () => {
  it("reads 100 on the last step and 0 on the first", () => {
    expect(percent(0)).toBe(0);
    expect(percent(LAST_STEP)).toBe(100);
  });
  it("stays inside the bar whatever the step holds", () => {
    expect(percent(-4)).toBe(0);
    expect(percent(99)).toBe(100);
  });
  it("labels every step exactly once", () => {
    expect(STEPS).toHaveLength(5);
    expect(new Set(STEPS.map((s) => s.id)).size).toBe(5);
  });
});

describe("moving between steps", () => {
  it("will not step over an unanswered page", () => {
    const d = draft({ step: 0, name: "" });
    expect(jump(d, 3)).toBe(d);
    expect(advance(d).step).toBe(0);
  });
  it("walks forward once the current page is answered", () => {
    expect(advance(draft({ step: 0, name: "Ada" })).step).toBe(1);
  });
  it("always walks backward, even from an unanswered page", () => {
    expect(back(draft({ step: 2 })).step).toBe(1);
    expect(back(draft({ step: 0 })).step).toBe(0);
  });
  it("lets a visitor skip a page they do not care about", () => {
    expect(skip(draft({ step: 1 })).step).toBe(2);
    expect(skip(draft({ step: LAST_STEP })).step).toBe(LAST_STEP);
  });
  it("jumps across several answered pages at once", () => {
    const d = draft({ step: 0, name: "Ada", techs: ["go"] });
    expect(jump(d, 2).step).toBe(2);
  });
  it("clamps a navigation target outside the wizard", () => {
    expect(goTo(draft(), -3).step).toBe(0);
    expect(goTo(draft(), 40).step).toBe(LAST_STEP);
  });
});

describe("picking", () => {
  it("adds, removes and ignores a blank", () => {
    const one = toggle([], "go");
    expect(toggle(one, "go")).toEqual([]);
    expect(toggle(one, "  ")).toEqual(one);
    expect(toggle(["go"], "react")).toEqual(["go", "react"]);
  });
  it("will not record the same pick twice", () => {
    expect(toggle(["go", "react"], "react")).toEqual(["go"]);
  });
});

describe("readiness", () => {
  it("needs a name and one interest before it is worth saving", () => {
    expect(isReadyToSave(draft({ name: "Ada" }))).toBe(false);
    expect(isReadyToSave(draft({ techs: ["go"] }))).toBe(false);
    expect(isReadyToSave(draft({ name: "Ada", techs: ["go"] }))).toBe(true);
    expect(isReadyToSave(draft({ name: "Ada", sectors: ["Databases & Data"] }))).toBe(true);
  });
});

describe("the vocabulary the pickers show", () => {
  const rows = [
    row({ title: "Renderer", tags: ["React", "js"], lang: "TypeScript" }),
    row({ title: "Compiler", tags: ["golang"], lang: "Go" }),
    row({ title: "Charts", tags: ["react", "testing"] }),
  ];

  it("lists only technologies the archive actually carries", () => {
    expect(techOptions(rows).map((o) => o.id).sort()).toEqual(["go", "javascript", "react", "typescript"]);
  });
  it("folds the spellings contributors use onto one name", () => {
    const ids = techOptions(rows).map((o) => o.id);
    expect(ids).not.toContain("js");
    expect(ids).not.toContain("golang");
  });
  it("drops words that are not a technology", () => {
    expect(techOptions(rows).map((o) => o.id)).not.toContain("testing");
  });
  it("ranks by how many rows carry it and honours the limit", () => {
    const all = techOptions(rows);
    expect(all[0]).toEqual({ id: "react", count: 2 });
    expect(techOptions(rows, 1).map((o) => o.id)).toEqual(["react"]);
  });
  it("offers the domains present in the archive, most filled first", () => {
    const space = row({ title: "Satellite ground station", body: "telemetry from orbit", tags: [] });
    const data = row({ title: "Column store", body: "sql database indexing for analytics", tags: [] });
    const opts = domainOptions([space, data, data]);
    expect(opts[0].id).toBe("Databases & Data");
    expect(opts.map((o) => o.id)).toContain("Space & Geospatial");
  });
  it("never offers a domain it cannot fill, including the catch-all", () => {
    const opts = domainOptions([row({ title: "Widget", body: "widgetry" })]);
    expect(opts.map((o) => o.id)).not.toContain("Other");
    expect(opts.length).toBeLessThan(17);
  });
  it("lists the programs the site tracks", () => {
    expect(programOptions([{ id: "gsoc", name: "Google Summer of Code" }])).toEqual([{ id: "gsoc", count: 0 }]);
  });
});

describe("scoring one project", () => {
  it("prefers a declared technology over an incidental language", () => {
    const declared = row({ title: "Dashboard", tags: ["react"] });
    const incidental = row({ title: "Notebooks", lang: "Jupyter Notebook" });
    expect(scoreRow(declared, draft({ techs: ["react"] }))).toEqual({
      row: declared, score: 3, reasons: ["uses react"],
    });
    expect(scoreRow(incidental, draft({ techs: ["jupyter"] }))).toEqual({
      row: incidental, score: 2, reasons: ["written in Jupyter Notebook"],
    });
  });
  it("counts a language once, whichever channel found it", () => {
    const r = row({ title: "Service", tags: ["go"], lang: "Go" });
    const m = scoreRow(r, draft({ techs: ["go"] }));
    expect(m.score).toBe(3);
    expect(m.reasons).toEqual(["uses go"]);
  });
  it("adds the domain and the program on top", () => {
    const r = row({ title: "Column store", body: "sql database indexing", id: "lfx", program: "LFX" });
    const m = scoreRow(r, draft({ sectors: ["Databases & Data"], programs: ["lfx"] }));
    expect(m.score).toBe(5);
    expect(m.reasons).toContain("databases & data");
    expect(m.reasons).toContain("LFX");
  });
  it("scores a row nobody asked for at zero", () => {
    expect(scoreRow(row({ tags: ["rust"] }), draft({ techs: ["go"] })).score).toBe(0);
  });
});

describe("recommendations", () => {
  const weak = row({ title: "Weak match", tags: ["go"], stars: 900 });
  const strong = row({ title: "Strong match", tags: ["go", "react"] });
  const unrelated = row({ title: "Nothing alike", tags: ["rust"] });
  const d = draft({ techs: ["go", "react"] });

  it("never returns a project that matched nothing", () => {
    expect(recommend([weak, strong, unrelated], d).map((m) => m.row.title)).not.toContain("Nothing alike");
  });
  it("puts the better match first", () => {
    expect(recommend([weak, strong], d)[0].row.title).toBe("Strong match");
  });
  it("breaks a tie on stars, then on the name", () => {
    const a = row({ title: "aaa", tags: ["go"], stars: 5 });
    const b = row({ title: "bbb", tags: ["go"], stars: 50 });
    const c = row({ title: "ccc", tags: ["go"], stars: 50 });
    expect(recommend([a, b, c], draft({ techs: ["go"] })).map((m) => m.row.title)).toEqual(["bbb", "ccc", "aaa"]);
  });
  it("stops at the limit", () => {
    const many = Array.from({ length: 20 }, (_, i) => row({ title: `p${i}`, tags: ["go"] }));
    expect(recommend(many, d, 6)).toHaveLength(6);
  });
  it("returns nothing when nothing was picked", () => {
    expect(recommend([weak, strong], EMPTY_DRAFT)).toEqual([]);
  });
  it("counts how much of the archive a set of picks can fill", () => {
    expect(coverage([weak, strong, unrelated], d)).toBe(2);
    expect(coverage([weak, strong, unrelated], EMPTY_DRAFT)).toBe(0);
  });
});

describe("summary line", () => {
  it("counts each answer once and omits what is missing", () => {
    expect(summaryOf(draft({ name: "Ada" }))).toEqual(["Ada"]);
    expect(summaryOf(draft({ name: "Ada", techs: ["go"], sectors: ["Databases & Data"], programs: ["gsoc", "lfx"] })))
      .toEqual(["Ada", "1 language", "1 domain", "2 programs"]);
  });
  it("says nothing about an untouched draft", () => {
    expect(summaryOf(EMPTY_DRAFT)).toEqual([]);
  });
});
