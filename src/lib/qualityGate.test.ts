import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { reviewRefresh } from "../../scripts/lib/quality-gate.mjs";

/* The gate is the last thing standing between a bad upstream read and the
   archive every page counts. These tests run it over real directories so the
   promise that matters is the one a maintainer actually relies on: when the
   report says the run may not publish, the files the site serves did not move. */

const fixtures: string[] = [];
afterEach(() => fixtures.splice(0).forEach((path) => rmSync(path, { recursive: true, force: true })));

function sandbox() {
  const root = mkdtempSync(join(tmpdir(), "cyrus-gate-"));
  fixtures.push(root);
  const live = join(root, "live"), quality = join(root, "quality");
  mkdirSync(live, { recursive: true });
  return { root, live, quality };
}

const rowList = (n: number, from = 0) =>
  Array.from({ length: n }, (_, i) => ({ u: `r${from + i}`, t: `Row ${from + i}`, o: "Org", y: 2024 }));

const buildShard = (program: string, list: object[], extra: object = {}) => ({
  program, label: program.toUpperCase(), source: `https://api.test/${program}/projects`,
  readAt: "2026-11-14", unit: "projects", note: "", projects: list.length, list, ...extra,
});

const liveShard = (s: ReturnType<typeof sandbox>, shard: Record<string, any>) =>
  writeFileSync(join(s.live, `${shard.program}.json`), JSON.stringify(shard, null, 1));

const run = (s: ReturnType<typeof sandbox>, built: Record<string, any>[], opts: Record<string, any> = {}) =>
  reviewRefresh({ name: "program-projects", stamp: "2026-11-14", liveDir: s.live, qualityDir: s.quality, built, env: {}, ...opts });

const readJson = (p: string) => JSON.parse(readFileSync(p, "utf8"));

describe("a refresh that looks like the last one", () => {
  it("publishes, and leaves both documents behind", () => {
    const s = sandbox();
    const yesterday = buildShard("gsoc", rowList(20));
    liveShard(s, yesterday);
    const g = run(s, [buildShard("gsoc", rowList(20))]);
    expect(g.publish).toBe(true);
    expect(g.report.status).toBe("pass");
    expect(existsSync(g.files.json)).toBe(true);
    expect(existsSync(g.files.md)).toBe(true);
    expect(readJson(g.files.json).totals).toMatchObject({ datasets: 1, before: 20, after: 20, changed: 0 });
    expect(readFileSync(g.files.md, "utf8")).toContain("Status: **pass**");
    expect(g.text).toContain("review ->");
  });

  it("counts a program with no previous shard as all-new, not as a loss", () => {
    const s = sandbox();
    const g = run(s, [buildShard("fossee", rowList(12))]);
    expect(g.publish).toBe(true);
    expect(g.report.rows[0]).toMatchObject({ before: 0, after: 12, addedCount: 12, removedCount: 0 });
  });

  it("names the source a reviewer has to go and look at", () => {
    const s = sandbox();
    const g = run(s, [buildShard("gssoc", [{ u: "x", t: "Claimed project", o: "GirlScript", y: 1899 }])]);
    const md = readFileSync(g.files.md, "utf8");
    expect(g.publish).toBe(false);
    expect(md).toContain("### gssoc");
    expect(md).toContain("https://api.test/gssoc/projects");
  });
});

describe("a refresh that does not", () => {
  const collapse = () => {
    const s = sandbox();
    liveShard(s, buildShard("gsoc", rowList(100)));
    return { s, g: run(s, [buildShard("gsoc", rowList(10))]) };
  };

  it("refuses to publish and says which limits were exceeded", () => {
    const { g } = collapse();
    expect(g.publish).toBe(false);
    expect(g.report.failed).toEqual(expect.arrayContaining(["maxRemovedPct", "maxTotalDropPct"]));
    expect(g.text).toContain("maxRemovedPct 90 > 10");
    expect(readFileSync(g.files.md, "utf8")).toContain("Status: **FAIL, publication blocked**");
  });

  it("writes the review even though it published nothing", () => {
    const { s, g } = collapse();
    expect(existsSync(join(s.quality, "program-projects-2026-11-14.md"))).toBe(true);
    expect(readJson(g.files.json).status).toBe("fail");
  });

  it("leaves the archive the site serves exactly as it was", () => {
    const { s } = collapse();
    const before = readFileSync(join(s.live, "gsoc.json"), "utf8");
    expect(JSON.parse(before).list).toHaveLength(100);
    expect(readFileSync(join(s.live, "gsoc.json"), "utf8")).toBe(before);
  });

  it("lists every removed row in the JSON and only the first page in the Markdown", () => {
    const { g } = collapse();
    const json = readFileSync(g.files.json, "utf8");
    const md = readFileSync(g.files.md, "utf8");
    expect(md).toContain("and 65 more, all in the JSON report");
    expect(json).toContain("Row 99");
    expect(md).not.toContain("Row 99");
  });
});

describe("what a maintainer may say about it", () => {
  it("publishes over a failed threshold when a reason is given, in both documents", () => {
    const s = sandbox();
    liveShard(s, buildShard("gsoc", rowList(100)));
    const g = run(s, [buildShard("gsoc", rowList(10))], {
      env: { CYRUS_QUALITY_OVERRIDE: "the program retired its 2019 cohort", CYRUS_QUALITY_OVERRIDE_BY: "adityalenova" },
    });
    expect(g.publish).toBe(true);
    expect(g.report.status).toBe("overridden");
    const md = readFileSync(g.files.md, "utf8");
    expect(md).toContain("## Override");
    expect(md).toContain("the program retired its 2019 cohort (by adityalenova)");
    expect(readJson(g.files.json).override.reason).toBe("the program retired its 2019 cohort");
  });

  it("raises a limit for one run from the environment, and says it came from there", () => {
    const s = sandbox();
    liveShard(s, buildShard("gsoc", rowList(100)));
    const env = { CYRUS_QUALITY_MAXREMOVEDPCT: "45", CYRUS_QUALITY_MAXTOTALDROPPCT: "45" };
    const g = run(s, [buildShard("gsoc", rowList(60))], { env });
    expect(g.publish).toBe(true);
    expect(g.report.thresholds.maxRemovedPct).toBe(45);
    expect(g.report.thresholdSource).toContain("env maxRemovedPct");
  });

  it("takes a thresholds file when the run points at one", () => {
    const s = sandbox();
    const file = join(s.root, "thresholds.json");
    writeFileSync(file, JSON.stringify({ maxRemovedPct: 95, maxTotalDropPct: 95 }));
    liveShard(s, buildShard("gsoc", rowList(100)));
    const g = run(s, [buildShard("gsoc", rowList(10))], { thresholdsFile: file });
    expect(g.publish).toBe(true);
    expect(g.report.thresholdSource).toContain(file);
    expect(readFileSync(g.files.md, "utf8")).toContain(`Thresholds in force came from defaults, ${file}.`);
  });

  it("reports a thresholds file it could not use instead of silently defaulting", () => {
    const s = sandbox();
    const file = join(s.root, "broken.json");
    writeFileSync(file, "{ nope");
    liveShard(s, buildShard("gsoc", rowList(100)));
    const g = run(s, [buildShard("gsoc", rowList(10))], { thresholdsFile: file });
    expect(g.publish).toBe(false);
    expect(g.text).toContain("could not be read");
  });
});

describe("what must never leave the run", () => {
  it("keeps a credential that arrived inside a row out of both documents", () => {
    const s = sandbox();
    const secret = "ghp_supercalifragilisticexpialidocious";
    liveShard(s, buildShard("kde", [{ u: "a", t: "Idea", o: "KDE", y: 2024, access_token: "old" }]));
    const g = run(s, [buildShard("kde", [{ u: "a", t: "Idea", o: "KDE", y: 2024, access_token: secret }])]);
    const json = readFileSync(g.files.json, "utf8");
    const md = readFileSync(g.files.md, "utf8");
    expect(md).toContain("[redacted]");
    expect(json).not.toContain(secret);
    expect(md).not.toContain(secret);
    expect(g.text).not.toContain(secret);
  });

  it("says when the snapshot it is comparing against did not parse", () => {
    const s = sandbox();
    writeFileSync(join(s.live, "lfx.json"), "not json at all");
    const g = run(s, [buildShard("lfx", rowList(30))]);
    expect(g.publish).toBe(true);
    expect(g.notes.join(" ")).toContain("lfx: the snapshot the site serves does not parse");
    expect(g.text).toContain("does not parse");
    expect(g.report.rows[0]).toMatchObject({ before: 0, after: 30 });
  });
});
