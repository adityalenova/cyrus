/* ══ qualityReport.test.ts — what a refresh changed, and what to do about it ══ */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_THRESHOLDS, FIELD_CAP, LIST_CAP, PREVIEW_CAP,
  buildReport, changedFields, diffRows, findInvalidRows, formatConsole,
  renderMarkdown, resolveOverride, resolveThresholds, safePreview,
} from "../../scripts/lib/quality-report.mjs";

/* The report exists so a bad upstream read is visible before it replaces the
   archive, so these tests read it the way a maintainer would: the counts, the
   named rows, the threshold that tripped, and what the run is told to do next. */

const rows = (...list: Array<Record<string, unknown>>) => ({ projects: list.length, list });
const NOTHING = { projects: 0, list: [] };

const YEARS = { min: 2010, max: 2026 };

function report(datasets: any[], opts: any = {}) {
  return buildReport({ name: "program-projects", stamp: "2026-11-14", datasets, ...opts });
}

const dataset = (id: string, before: unknown, after: unknown, extra: Record<string, unknown> = {}) => ({
  id, source: `scripts/fetch-${id}.mjs`, before, after, years: YEARS, ...extra,
});

/** the one check a report is being read for */
const check = (r: any, name: string) => r.checks.find((c: any) => c.name === name);

describe("an unchanged refresh", () => {
  const same = rows({ u: "a", t: "Alpha", o: "Org", y: 2024, stars: 10 });
  it("passes, and says so in every output", () => {
    const r = report([dataset("gsoc", same, same)]);
    expect(r.status).toBe("pass");
    expect(r.totals).toMatchObject({ datasets: 1, before: 1, after: 1, added: 0, removed: 0, changed: 0, unchanged: 1, invalid: 0 });
    expect(r.failed).toEqual([]);
    expect(r.nextStep).toBe("publish the refresh");
    expect(formatConsole(r)).toContain("- PASS");
    expect(renderMarkdown(r)).toContain("Status: **pass**");
  });

  it("is byte-identical when nothing about the data changed", () => {
    const a = renderMarkdown(report([dataset("gsoc", same, same)]));
    const b = renderMarkdown(report([dataset("gsoc", same, same)]));
    expect(a).toBe(b);
  });

  it("treats a field that is absent in both versions as no change", () => {
    const diff = diffRows([{ u: "a", t: "A" }], [{ u: "a", t: "A", lang: undefined }]);
    expect(diff.changedCount).toBe(0);
    expect(diff.unchanged).toBe(1);
  });

  it("finds the rows of a snapshot written before the current column contract", () => {
    /* the archive public/data shipped until the builders settled on `list` kept
       rows under `projects` and spelled the columns out in full. reading it as
       zero rows would tell a maintainer the program is empty. */
    const old = {
      program: "gsoc", generated: "2026-10-25", rows: 3, capped: true,
      projects: [
        { title: "Optimizing OpenCV for RISC-V", org: "OpenCV", year: 2022 },
        { title: "Offline mode for Open Food Facts", org: "Open Food Facts", year: 2022 },
        { title: "Jenkinsfile Runner Action", org: "Jenkins", year: 2023 },
      ],
    };
    const now = rows({ u: "gsoc-1", t: "Optimizing OpenCV for RISC-V", o: "OpenCV", y: 2022 });
    const r = report([dataset("gsoc", old, now)], { thresholds: { maxRemovedPct: 100, maxTotalDropPct: 100 } });
    expect(r.rows[0]).toMatchObject({ before: 3, after: 1, removedCount: 3, addedCount: 1 });
    expect(r.rows[0].removed.shown).toEqual([
      "Optimizing OpenCV for RISC-V",
      "Offline mode for Open Food Facts",
      "Jenkinsfile Runner Action",
    ]);
    expect(r.rows[0].stated).toBe(1);
  });

  it("keeps two rows that say the same thing as two rows", () => {
    /* a program with no id per row is keyed by its title, and titles repeat:
       the second one is numbered, never merged, or a lost row disappears */
    const same = { t: "Website redesign", o: "Org" };
    const diff = diffRows([same, same], [same]);
    expect(diff.before).toBe(2);
    expect(diff.unchanged).toBe(1);
    expect(diff.removed.all).toEqual(["Website redesign#2"]);
  });

  it("leaves the row count unstated rather than calling it wrong", () => {
    const r = report([dataset("kde", rows({ u: "a", t: "A", o: "O" }), { list: [{ u: "a", t: "A", o: "O" }] })]);
    expect(r.rows[0]).toMatchObject({ stated: null, statedMatches: null });
    expect(r.failed).toEqual([]);
  });
});

describe("rows that arrived and rows that left", () => {
  const before = rows({ u: "a", t: "Alpha", o: "Org" }, { u: "b", t: "Beta", o: "Org" });
  const after = rows({ u: "a", t: "Alpha", o: "Org" }, { u: "c", t: "Gamma", o: "Other" });

  it("names them by id, with the title the reviewer will recognise", () => {
    const diff = diffRows(before.list, after.list);
    expect(diff.added.shown).toEqual(["c: Gamma"]);
    expect(diff.removed.shown).toEqual(["b: Beta"]);
    expect(diff.unchanged).toBe(1);
    expect(diff.before).toBe(2);
    expect(diff.after).toBe(2);
  });

  it("counts a removal against the rows that were there before", () => {
    const many = rows(...Array.from({ length: 10 }, (_, i) => ({ u: `r${i}`, t: `Row ${i}`, o: "Org" })));
    const minusTwo = rows(...many.list.slice(2));
    const diff = diffRows(many.list, minusTwo.list);
    expect(diff.removedPct).toBe(20);
    const r = report([dataset("kde", many, minusTwo)]);
    expect(r.status).toBe("fail");
    expect(r.failed).toContain("maxRemovedPct");
    expect(formatConsole(r)).toContain("maxRemovedPct 20 > 10");
  });

  it("lists up to the cap and points at the JSON for the rest", () => {
    const gone = rows(...Array.from({ length: LIST_CAP + 5 }, (_, i) => ({ u: `r${i}`, t: `Row ${i}`, o: "Org" })));
    const r = report([dataset("oct", gone, NOTHING)], { thresholds: { maxRemovedPct: 100, maxTotalDropPct: 100, maxEmptyDatasets: 1, maxChangedPct: 100 } });
    const oct = r.rows[0];
    expect(oct.removed.shown).toHaveLength(LIST_CAP);
    expect(oct.removed.omitted).toBe(5);
    expect(oct.removed.total).toBe(30);
    expect(renderMarkdown(r)).toContain("and 5 more, all in the JSON report");
  });

  it("keeps every entry in the object the JSON artifact is written from", () => {
    const gone = rows(...Array.from({ length: LIST_CAP + 5 }, (_, i) => ({ u: `r${i}`, t: `Row ${i}`, o: "Org" })));
    const r = report([dataset("oct", gone, NOTHING)], { thresholds: { maxRemovedPct: 100, maxTotalDropPct: 100, maxEmptyDatasets: 1, maxChangedPct: 100 } });
    expect(r.rows[0].removed.all).toHaveLength(LIST_CAP + 5);
    expect(JSON.stringify(r)).toContain("Row 29");
    expect(renderMarkdown(r)).not.toContain("Row 29");
  });
});

describe("fields that changed", () => {
  it("reports the column and both previews", () => {
    const before = rows({ u: "a", t: "Alpha", o: "Org", stars: 100 });
    const after = rows({ u: "a", t: "Alpha", o: "Org", stars: 140 });
    const diff = diffRows(before.list, after.list);
    expect(diff.changedCount).toBe(1);
    expect(diff.changed.shown[0]).toMatchObject({
      id: "a",
      fields: [{ field: "stars", from: "100", to: "140" }],
      fieldsOmitted: 0,
    });
    expect(renderMarkdown(report([dataset("gsoc", before, after)]))).toContain("`a`: stars: 100 -> 140");
  });

  it("notices a column upstream added, which is a schema change not a quiet day", () => {
    const before = rows({ u: "a", t: "Alpha", o: "Org" });
    const after = rows({ u: "a", t: "Alpha", o: "Org", cohort: "2026" });
    expect(changedFields(before.list[0], after.list[0])).toEqual([
      { field: "cohort", from: "null", to: "2026" },
    ]);
  });

  it("caps a preview instead of pasting a description into a report", () => {
    const long = "x".repeat(PREVIEW_CAP + 400);
    const fields = changedFields({ u: "a", b: long }, { u: "a", b: "y".repeat(400) });
    expect(fields[0].to).toHaveLength(PREVIEW_CAP);
    expect(fields[0].to.endsWith("\u2026")).toBe(true);
  });

  it("keeps the number of columns per row bounded, and says how many it hid", () => {
    const prev: Record<string, unknown> = { u: "a" };
    const next: Record<string, unknown> = { u: "a" };
    for (let i = 0; i < FIELD_CAP + 3; i++) { prev[`f${i}`] = 0; next[`f${i}`] = i + 1; }
    const diff = diffRows([prev], [next]);
    expect(diff.changed.shown[0].fields).toHaveLength(FIELD_CAP);
    expect(diff.changed.shown[0].fieldsOmitted).toBe(3);
    expect(diff.changed.shown[0].fieldsAll).toHaveLength(FIELD_CAP + 3);
  });

  it("shows a credential-shaped column as a change without showing its value", () => {
    const fields = changedFields({ u: "a", access_token: "old" }, { u: "a", access_token: "ghp_supercalifragilistic" });
    expect(fields).toEqual([{ field: "access_token", from: "[redacted]", to: "[redacted]" }]);
    expect(safePreview("api_key", "secret")).toBe("[redacted]");
    expect(safePreview("title", "a normal title")).toBe("a normal title");
    const leak = report([dataset("gsoc", rows({ u: "a", t: "A", o: "O", access_token: "old" }),
      rows({ u: "a", t: "A", o: "O", access_token: "ghp_supercalifragilistic" }))]);
    expect(renderMarkdown(leak)).toContain("[redacted]");
    expect(renderMarkdown(leak)).not.toContain("ghp_");
    expect(formatConsole(leak)).not.toContain("ghp_");
    expect(JSON.stringify(leak)).not.toContain("ghp_");
  });
});

describe("malformed records", () => {
  it("names the program, the row, and what is wrong", () => {
    const bad = rows(
      { u: "a", o: "Org" },                                  // no title
      { u: "b", t: "Beta", o: "Org", y: 1899 },               // year out of range
      { u: "c", t: "Gamma", o: "Org", url: "github.com/x/y" },// not a link
      { u: "d", t: "Delta", o: "Org", tt: "react" },          // tags not a list
      { u: "e", t: "Eps", o: "Org", tp: ["ok", "  "] },       // blank tag
      { u: "f", t: "Zeta" },                                  // titled row with no org
    );
    const problems = findInvalidRows(bad.list, { program: "gssoc", years: YEARS });
    expect(problems.map((p: any) => `${p.program} ${p.id}: ${p.problem}`)).toEqual([
      "gssoc a: a row with no title is not a row",
      "gssoc b: year outside 2010\u20132026",
      "gssoc c: url is not a link",
      "gssoc d: tt is not a list",
      "gssoc e: tp holds an empty or non-string entry",
      "gssoc f: a titled row with no organization",
    ]);
    expect(problems[2].value).toBe("github.com/x/y");
  });

  it("reads an unknown value as unknown, not as a defect", () => {
    /* the archive spells "the program did not tell us" several ways across its
       history - an absent key, an empty string, and a null - and only the
       first two were ever written down on purpose */
    const honest = rows(
      { u: "a", t: "Alpha", o: "Org", y: null, url: null, tt: null, tp: null },
      { u: "b", t: "Beta", o: "Org", y: undefined, url: "", tt: [], tp: [] },
    );
    expect(findInvalidRows(honest.list, { program: "gsoc", years: YEARS })).toEqual([]);
  });

  it("catches a row id used twice in one shard", () => {
    const twice = rows({ u: "a", t: "Alpha", o: "Org" }, { u: "a", t: "Alpha again", o: "Org" });
    const problems = findInvalidRows(twice.list, { program: "nsoc", years: YEARS });
    expect(problems).toEqual([{ id: "a", program: "nsoc", problem: "row id used 2 times in one shard", value: "" }]);
  });

  it("does not mistake a repeated title for a repeated id", () => {
    /* FOSSEE's board lists the same course project title dozens of times; the
       builders give each row its own id, and a report must not invent a defect */
    const same = { t: "Graphics & Animation FOCAL project", o: "NRDX" };
    expect(findInvalidRows([same, same, same], { program: "fossee", years: YEARS })).toEqual([]);
  });

  it("fails the run on the first malformed row, because that is the default limit", () => {
    const ten = rows(...Array.from({ length: 10 }, (_, i) => ({ u: `r${i}`, t: `Row ${i}`, o: "O" })));
    const r = report([dataset("oct", ten, rows(...ten.list, { u: "bad", t: "Bad", o: "O", y: 3 })),
      dataset("gsoc", rows({ u: "b", t: "B", o: "O" }), rows({ u: "b", t: "B", o: "O" }))]);
    expect(r.status).toBe("fail");
    expect(r.failed).toEqual(["maxInvalidRecords"]);
    expect(r.totals.invalid).toBe(1);
    expect(formatConsole(r)).toContain("maxInvalidRecords 1 > 0");
    expect(renderMarkdown(r)).toContain(`### oct \u2014 1 problem (source: scripts/fetch-oct.mjs)`);
    expect(renderMarkdown(r)).toContain("- `bad`: year outside 2010\u20132026 \u2014 3");
  });

  it("accepts a known-bad source when the limit is raised, and still lists the rows", () => {
    const r = report([dataset("oct", NOTHING, rows({ u: "a", t: "A", o: "O", y: 3 }))],
      { thresholds: { maxInvalidRecords: 5, maxGainedPct: 100 } });
    expect(r.status).toBe("pass");
    expect(formatConsole(r)).toContain("within limit: 1 malformed row(s), each listed in the report");
  });

  it("lists a malformed source row by row, and keeps the whole list in the JSON", () => {
    const broken = rows(...Array.from({ length: LIST_CAP + 7 }, (_, i) => ({ u: `r${i}`, t: `Row ${i}`, o: "O", y: 1900 })));
    const r = report([dataset("lfx", NOTHING, broken)], { thresholds: { maxGainedPct: 100, maxInvalidRecords: LIST_CAP + 7 } });
    expect(r.rows[0].invalid).toHaveLength(LIST_CAP);
    expect(r.rows[0].invalidOmitted).toBe(7);
    expect(r.rows[0].invalidAll).toHaveLength(LIST_CAP + 7);
    expect(renderMarkdown(r)).toContain("and 7 more, all in the JSON report");
  });

  it("says when a shard disagrees with its own row count", () => {
    const after = { projects: 7, list: [{ u: "a", t: "A", o: "O" }] };
    const r = report([dataset("sob", rows({ u: "a", t: "A", o: "O" }), after)]);
    expect(r.failed).toContain("statedRowCounts");
    expect(r.rows[0].statedMatches).toBe(false);
  });
});

describe("thresholds", () => {
  const growing = (from: number, to: number) => ({
    before: rows(...Array.from({ length: from }, (_, i) => ({ u: `r${i}`, t: `Row ${i}`, o: "O" }))),
    after: rows(...Array.from({ length: to }, (_, i) => ({ u: `r${i}`, t: `Row ${i}`, o: "O" }))),
  });

  it("blocks an archive that grew implausibly in one run", () => {
    const d = growing(100, 200);
    const r = report([dataset("gsoc", d.before, d.after)]);
    expect(r.failed).toContain("maxGainedPct");
    expect(check(r, "maxGainedPct").says).toContain("grew 100%");
  });

  it("blocks a dataset that came back with nothing where it had rows", () => {
    const d = growing(40, 0);
    const r = report([dataset("mlh", d.before, d.after)]);
    expect(r.failed).toEqual(expect.arrayContaining(["maxRemovedPct", "maxTotalDropPct", "maxEmptyDatasets"]));
    expect(renderMarkdown(r)).toContain("mlh went to nothing");
  });

  it("blocks a wholesale rewrite of a shard even when the count is steady", () => {
    const before = rows({ u: "a", t: "A", o: "O" }, { u: "b", t: "B", o: "O" }, { u: "c", t: "C", o: "O" });
    const after = rows({ u: "a", t: "A", o: "New" }, { u: "b", t: "B", o: "New" }, { u: "c", t: "C", o: "Same" });
    const r = report([dataset("24pr", before, after)]);
    expect(r.failed).toEqual(["maxChangedPct"]);
  });

  it("keeps the published defaults and raises them for one run without a commit", () => {
    expect(DEFAULT_THRESHOLDS.maxRemovedPct).toBe(10);
    const resolved = resolveThresholds({ env: { CYRUS_QUALITY_MAXREMOVEDPCT: "35", CYRUS_QUALITY_MAXINVALIDRECORDS: "20" } });
    expect(resolved.thresholds.maxRemovedPct).toBe(35);
    expect(resolved.thresholds.maxInvalidRecords).toBe(20);
    expect(resolved.from).toContain("env maxRemovedPct");
  });

  it("takes a whole set from JSON, ignores what is not a threshold, and reports what it ignored", () => {
    const resolved = resolveThresholds({
      env: { CYRUS_QUALITY_THRESHOLDS: JSON.stringify({ maxRemovedPct: 5, favorite: "pony", maxGainedPct: -3 }) },
    });
    expect(resolved.thresholds.maxRemovedPct).toBe(5);
    expect(resolved.thresholds.maxGainedPct).toBe(DEFAULT_THRESHOLDS.maxGainedPct);
    expect(resolved.notes).toEqual([
      "ignored favorite: not a threshold",
      "ignored maxGainedPct=\"-3\": not a number at or above zero",
    ]);
  });

  it("reads a thresholds file when one is given, and says so in the report", () => {
    const resolved = resolveThresholds({
      file: "ops/thresholds.json",
      read: () => JSON.stringify({ maxTotalDropPct: 2 }),
      env: {},
    });
    expect(resolved.thresholds.maxTotalDropPct).toBe(2);
    expect(resolved.from).toEqual(["defaults", "ops/thresholds.json"]);
    const r = report([dataset("gsoc", rows({ u: "a", t: "A", o: "O" }), NOTHING)],
      { thresholds: resolved.thresholds, thresholdSource: resolved.from.join(", ") });
    expect(renderMarkdown(r)).toContain("Thresholds in force came from defaults, ops/thresholds.json.");
  });

  it("says plainly when the thresholds themselves were unreadable", () => {
    const resolved = resolveThresholds({ file: "ops/thresholds.json", read: () => "{ nope", env: { CYRUS_QUALITY_THRESHOLDS: "nonsense" } });
    expect(resolved.thresholds).toEqual(DEFAULT_THRESHOLDS);
    expect(resolved.notes[0]).toContain("could not be read");
    expect(resolved.notes[1]).toContain("is not JSON");
  });
});

describe("overriding a failed threshold", () => {
  const collapsed = {
    before: rows(...Array.from({ length: 10 }, (_, i) => ({ u: `r${i}`, t: `Row ${i}`, o: "O" }))),
    after: rows({ u: "r0", t: "Row 0", o: "O" }),
  };

  it("records who overrode and why, and publishes", () => {
    const r = report([dataset("gsoc", collapsed.before, collapsed.after)], {
      override: { reason: "the program moved its archive and the last year is gone on purpose", by: "adityalenova" },
    });
    expect(r.status).toBe("overridden");
    expect(r.failed).toContain("maxRemovedPct");
    expect(r.nextStep).toContain("the program moved its archive");
    const text = renderMarkdown(r);
    expect(text).toContain("## Override");
    expect(text).toContain("overridden, publishing anyway");
    expect(text).toContain("Reason given: the program moved its archive and the last year is gone on purpose (by adityalenova)");
  });

  it("blocks publication when nothing overrode it", () => {
    const r = report([dataset("gsoc", collapsed.before, collapsed.after)]);
    expect(r.status).toBe("fail");
    expect(r.nextStep).toContain("CYRUS_QUALITY_OVERRIDE");
    expect(renderMarkdown(r)).toContain("Status: **FAIL, publication blocked**");
    expect(renderMarkdown(r)).not.toContain("## Override");
  });

  it("reads the override from the environment, with or without a name", () => {
    expect(resolveOverride({})).toBeNull();
    expect(resolveOverride({ CYRUS_QUALITY_OVERRIDE: "   " })).toBeNull();
    expect(resolveOverride({ CYRUS_QUALITY_OVERRIDE: "expected drop" })).toEqual({
      reason: "expected drop", by: "the environment of this run",
    });
    expect(resolveOverride({ CYRUS_QUALITY_OVERRIDE: "expected drop", CYRUS_QUALITY_OVERRIDE_BY: "maintainer" })?.by).toBe("maintainer");
  });
});

describe("a first refresh, with nothing to compare against", () => {
  it("reports every row as added and does not divide by zero", () => {
    const r = report([dataset("gsoc", null, rows({ u: "a", t: "A", o: "O" }, { u: "b", t: "B", o: "O" }))]);
    expect(r.totals).toMatchObject({ before: 0, after: 2, added: 2, removed: 0, changed: 0 });
    expect(r.totalDeltaPct).toBeNull();
    expect(r.rows[0].removedPct).toBeNull();
    expect(r.status).toBe("pass");
    expect(renderMarkdown(r)).toContain("### gsoc");
    expect(formatConsole(r)).toContain("2 added");
  });

  it("reports a dataset the refresh failed to build at all", () => {
    const r = report([dataset("kde", rows({ u: "a", t: "A", o: "O" }), null)]);
    expect(r.rows[0]).toMatchObject({ before: 1, after: 0, removedCount: 1 });
    expect(r.failed).toEqual(expect.arrayContaining(["maxRemovedPct", "maxEmptyDatasets"]));
  });
});
