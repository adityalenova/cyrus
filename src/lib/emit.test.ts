import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, statSync, writeFileSync, rmSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  contentFingerprint,
  emitArtifact,
  renderCrawlStats,
  renderIssueSignals,
  selectIssueSignals,
  stampOf,
} from "../../scripts/lib/emit.mjs";

const dirs: string[] = [];
const tempDir = () => {
  const d = mkdtempSync(join(tmpdir(), "cyrus-emit-"));
  dirs.push(d);
  return d;
};
afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

/* a crawl row big enough to clear the catalog filter, varied by hand */
const row = (repo: string, number: number, updated: string, labels: string[] = [], stars = 5000) => ({
  id: number, number, repo, url: `https://github.com/${repo}/issues/${number}`,
  state: "open", locked: false, assignees: [], labels, updated_at: updated,
  title: `A title long enough to survive the filter ${number}`,
  repo_stars: stars, repo_language: "TypeScript",
});

const FIXTURE = [
  row("acme/alpha", 12, "2026-10-04T09:00:00Z", ["good first issue"]),
  row("acme/alpha", 7, "2026-10-05T09:00:00Z", []),
  row("beige/beta", 3, "2026-10-01T09:00:00Z", ["help wanted"], 9000),
  row("cyan/gamma", 88, "2026-09-30T09:00:00Z", [], 3000),
];

const AS_OF = "2026-10-06";

const COUNTS = {
  issues: 40017, reposWithIssues: 1200, catalogRepos: 9000, orgs: 364,
  languages: 31, beginnerLabelled: 5120, mostRecentUpdate: "2026-10-06T12:00:00Z",
};

describe("selectIssueSignals", () => {
  it("selects the same rows from the same records in any input order", () => {
    const a = selectIssueSignals(FIXTURE, { asOf: AS_OF });
    const b = selectIssueSignals([...FIXTURE].reverse(), { asOf: AS_OF });
    const c = selectIssueSignals([FIXTURE[2], FIXTURE[0], FIXTURE[3], FIXTURE[1]], { asOf: AS_OF });
    expect(b).toEqual(a);
    expect(c).toEqual(a);
  });

  it("ranks beginner labels first, then the bigger catalog, then the freshest", () => {
    const rows = selectIssueSignals(FIXTURE, { asOf: AS_OF });
    // #3 and #12 carry a helpful label; between the two, #3 has the bigger
    // catalog. #7 then #88 are unlabelled, ordered by stars.
    expect(rows.map((r: any) => `${r.repo}#${r.number}`)).toEqual([
      "beige/beta#3", "acme/alpha#12", "acme/alpha#7", "cyan/gamma#88",
    ]);
    expect(rows[0].beginner).toBe(true);
  });

  it("caps the wall at two rows per repository", () => {
    const many = [
      row("acme/alpha", 1, "2026-10-05T00:00:00Z"),
      row("acme/alpha", 2, "2026-10-04T00:00:00Z"),
      row("acme/alpha", 3, "2026-10-03T00:00:00Z"),
    ];
    expect(selectIssueSignals(many, { asOf: AS_OF })).toHaveLength(2);
  });

  it("measures the freshness window from asOf, not from the machine clock", () => {
    const old = [row("acme/alpha", 1, "2026-08-01T00:00:00Z")];
    expect(selectIssueSignals(old, { asOf: "2026-10-06" })).toHaveLength(0);
    expect(selectIssueSignals(old, { asOf: "2026-08-20" })).toHaveLength(1);
  });

  it("drops locked, assigned, tiny-catalog and untitled rows and unreadable dates", () => {
    const dropped = [
      { ...row("acme/alpha", 1, "2026-10-05T00:00:00Z"), locked: true },
      { ...row("acme/alpha", 2, "2026-10-05T00:00:00Z"), assignees: [{ login: "someone" }] },
      row("acme/alpha", 3, "2026-10-05T00:00:00Z", [], 1999),
      { ...row("acme/alpha", 4, "2026-10-05T00:00:00Z"), title: "short" },
      { ...row("acme/alpha", 5, "2026-10-05T00:00:00Z"), state: "closed" },
      { ...row("acme/alpha", 6, "not a date") },
    ];
    expect(selectIssueSignals(dropped, { asOf: AS_OF })).toEqual([]);
  });
});

describe("rendering", () => {
  it("renders byte-identical text for reordered equivalent records", () => {
    const one = renderIssueSignals(selectIssueSignals(FIXTURE, { asOf: AS_OF }), AS_OF);
    const two = renderIssueSignals(selectIssueSignals([...FIXTURE].reverse(), { asOf: AS_OF }), AS_OF);
    expect(one).toBe(two);
    expect(one.endsWith("\n")).toBe(true);
  });

  it("keeps the content identical across days so only the stamp can differ", () => {
    const rows = selectIssueSignals(FIXTURE, { asOf: AS_OF });
    const oct = renderIssueSignals(rows, "2026-10-06");
    const nov = renderIssueSignals(rows, "2026-11-06");
    expect(contentFingerprint(oct)).toBe(contentFingerprint(nov));
    expect(oct).not.toBe(nov);
  });

  it("carries every count the crawl produced into the stats file", () => {
    const text = renderCrawlStats(COUNTS, "2026-10-06");
    expect(text).toContain("issues: 40017");
    expect(text).toContain("reposWithIssues: 1200");
    expect(text).toContain("catalogRepos: 9000");
    expect(text).toContain("orgs: 364");
    expect(text).toContain("languages: 31");
    expect(text).toContain("beginnerLabelled: 5120");
    expect(text).toContain('mostRecentUpdate: "2026-10-06"');
    expect(text).toContain('crawledAt: "2026-10-06"');
  });

  it("reads the stamp an artifact carries", () => {
    expect(stampOf(renderIssueSignals([], AS_OF))).toBe(AS_OF);
    expect(stampOf("no date here")).toBeNull();
  });
});

describe("emitArtifact", () => {
  it("leaves an unchanged artifact completely alone, stamp included", () => {
    const file = join(tempDir(), "issueSignals.ts");
    const rows = selectIssueSignals(FIXTURE, { asOf: AS_OF });
    const first = emitArtifact(file, renderIssueSignals(rows, "2026-10-06"));
    expect(first).toEqual({ written: true, asOf: "2026-10-06" });

    // backdate so a rewrite would be visible in mtime, then re-run a day later
    const old = new Date("2026-01-01T00:00:00Z");
    utimesSync(file, old, old);
    const before = { text: readFileSync(file, "utf8"), mtime: statSync(file).mtimeMs };

    const second = emitArtifact(file, renderIssueSignals(rows, "2026-11-06"));
    expect(second.written).toBe(false);
    expect(second.asOf).toBe("2026-10-06");
    expect(readFileSync(file, "utf8")).toBe(before.text);
    expect(statSync(file).mtimeMs).toBe(before.mtime);
  });

  it("writes when a record actually changed", () => {
    const file = join(tempDir(), "issueSignals.ts");
    const a = renderIssueSignals(selectIssueSignals(FIXTURE, { asOf: AS_OF }), AS_OF);
    emitArtifact(file, a);
    const changed = [...FIXTURE, row("delta/epsilon", 9, "2026-10-06T00:00:00Z", ["good first issue"], 12000)];
    const b = renderIssueSignals(selectIssueSignals(changed, { asOf: AS_OF }), AS_OF);
    const out = emitArtifact(file, b);
    expect(out.written).toBe(true);
    expect(readFileSync(file, "utf8")).toBe(b);
  });

  it("writes a file that does not exist yet", () => {
    const file = join(tempDir(), "nested", "crawlStats.ts");
    const text = renderCrawlStats(COUNTS, AS_OF);
    let written = "";
    const out = emitArtifact(file, text, {
      read: () => null,
      write: (_p, t) => { written = t; },
    });
    expect(out.written).toBe(true);
    expect(written).toBe(text);
  });

  it("reports the diff a maintainer would review as one line", () => {
    const rows = selectIssueSignals(FIXTURE, { asOf: AS_OF });
    const base = renderIssueSignals(rows, AS_OF).split("\n");
    const moved = renderIssueSignals(rows.map((r: any, i: number) => (i === 0 ? { ...r, stars: r.stars + 1 } : r)), AS_OF).split("\n");
    const changedLines = moved.filter((l, i) => l !== base[i]);
    expect(changedLines).toHaveLength(1);
  });

  it("does not treat a date-only difference as content", () => {
    expect(contentFingerprint('export const A = "2026-10-06";')).toBe(contentFingerprint('export const A = "2026-11-06";'));
    expect(contentFingerprint("export const A = 1")).not.toBe(contentFingerprint("export const A = 2"));
  });

  it("round-trips a written file back through the reader", () => {
    const dir = tempDir();
    const file = join(dir, "issueSignals.ts");
    writeFileSync(file, "stale content 2026-01-01");
    const out = emitArtifact(file, renderIssueSignals([], AS_OF));
    expect(out.written).toBe(true);
    expect(readFileSync(file, "utf8")).toContain(AS_OF);
  });
});
