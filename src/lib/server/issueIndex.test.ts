/* ══ issueIndex.test.ts — the finder filters what it says it filters ══ */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { CRAWL } from "@/data/crawlStats";
import {
  EMPTY_QUERY, facetKey, facets, filterIssues, issueUrl, parseQuery, scoreRow,
  type IssueQuery, type IssueRow,
} from "./issueIndex";

const row = (over: Partial<IssueRow>): IssueRow => ({
  r: "vercel/next.js", n: 1, t: "Docs typo in the app router page",
  a: 0, l: ["good first issue", "documentation"], g: "TypeScript",
  s: 1000, u: "2026-10-01", c: "2026-09-01", m: 2, b: 1, ...over,
});

const FIXTURE = [
  row({}),
  row({ n: 2, r: "kubernetes/kubernetes", t: "Fix flaky e2e test for node agent", l: ["help wanted"], g: "Go", s: 120_000, u: "2026-10-19", m: 41 }),
  row({ n: 3, r: "pytorch/pytorch", t: "Add docs for torch.compile mode", l: ["good first issue"], g: "Python", s: 90_000, a: 2, b: 1 }),
  row({ n: 4, r: "rust-lang/rust", t: "Compiler panic on nested generics", l: ["A-compiler"], g: "Rust", s: 100_000, b: 0, u: "2026-08-02" }),
];

const q = (over: Partial<IssueQuery>): IssueQuery => ({ ...EMPTY_QUERY, ...over });

describe("parseQuery", () => {
  it("reads the filters the page sends", () => {
    const p = parseQuery(new URLSearchParams("q=Docs+typo&lang=Go,Rust&org=kubernetes&label=help+wanted&beginner=1&unassigned=1&sort=stars&page=3&per=50"));
    expect(p.q).toBe("Docs typo");
    expect(p.langs).toEqual(["go", "rust"]);
    expect(p.org).toBe("kubernetes");
    expect(p.label).toBe("help wanted");
    expect(p.beginner).toBe(true);
    expect(p.unassigned).toBe(true);
    expect(p.sort).toBe("stars");
    expect(p.page).toBe(3);
    expect(p.per).toBe(50);
  });

  it("clamps what a stranger can type into a url", () => {
    const p = parseQuery(new URLSearchParams("q=" + "x".repeat(500) + "&page=-9&per=100000&sort=drop%20table"));
    expect(p.q.length).toBe(120);
    expect(p.page).toBe(1);
    expect(p.per).toBe(100);
    expect(p.sort).toBe("relevance");
  });

  it("caps the language list and drops blanks and duplicates", () => {
    const p = parseQuery(new URLSearchParams("lang=Go,,go,Rust,Python,Java,TypeScript,C,Shell"));
    expect(p.langs.length).toBeLessThanOrEqual(6);
    expect(p.langs.filter((l) => l === "go").length).toBe(1);
  });

  it("falls back to the empty query when nothing is provided", () => {
    expect(parseQuery(new URLSearchParams())).toEqual(EMPTY_QUERY);
  });
});

describe("scoreRow", () => {
  it("requires every token to land somewhere", () => {
    expect(scoreRow(FIXTURE[0], ["docs", "typo"])).toBeGreaterThan(0);
    expect(scoreRow(FIXTURE[0], ["docs", "flaky"])).toBe(-1);
  });

  it("prefers a title hit over a repository hit", () => {
    const inTitle = scoreRow(row({ t: "kubernetes docs" }), ["kubernetes"]);
    const inRepo = scoreRow(row({ t: "a plain title" }), ["kubernetes"]);
    expect(inTitle).toBeGreaterThan(inRepo);
  });
});

describe("filterIssues", () => {
  it("returns everything when no filter is set", () => {
    expect(filterIssues(FIXTURE, q({})).total).toBe(4);
  });

  it("filters by language, case-insensitively", () => {
    const r = filterIssues(FIXTURE, q({ langs: ["go"] }));
    expect(r.results.map((i) => i.n)).toEqual([2]);
  });

  it("filters by organization on the owner half of the repo", () => {
    expect(filterIssues(FIXTURE, q({ org: "pytorch" })).total).toBe(1);
    expect(filterIssues(FIXTURE, q({ org: "py" })).total).toBe(0);
  });

  it("filters by a label fragment", () => {
    expect(filterIssues(FIXTURE, q({ label: "good first" })).total).toBe(2);
  });

  it("separates beginner-labelled from unassigned", () => {
    /* three of the four carry a label the builder reads as beginner-friendly
       ("good first issue", "help wanted"); two of those have nobody on them */
    expect(filterIssues(FIXTURE, q({ beginner: true })).total).toBe(3);
    expect(filterIssues(FIXTURE, q({ unassigned: true })).total).toBe(3);
    expect(filterIssues(FIXTURE, q({ beginner: true, unassigned: true })).total).toBe(2);
  });

  it("combines a text query with a filter", () => {
    const r = filterIssues(FIXTURE, q({ q: "docs", langs: ["typescript", "python"] }));
    expect(r.results.map((i) => i.n).sort()).toEqual([1, 3]);
  });

  it("sorts by stars, newest and comment count", () => {
    expect(filterIssues(FIXTURE, q({ sort: "stars" })).results.map((i) => i.n)).toEqual([2, 4, 3, 1]);
    expect(filterIssues(FIXTURE, q({ sort: "updated" })).results.map((i) => i.n)[0]).toBe(2);
    expect(filterIssues(FIXTURE, q({ sort: "comments" })).results.map((i) => i.n)[0]).toBe(2);
  });

  it("opens an empty search on what moved most recently, not on stars", () => {
    /* with no query every row scores 0, so a stars tie-break would fill the
       first page from whichever repository has the most stars - 25 issues
       from one project. Recency keeps the opening screen a live board. */
    expect(filterIssues(FIXTURE, q({})).results.map((i) => i.n)).toEqual([2, 3, 1, 4]);
    /* a query is ranked on its own: a title that starts with the term beats
       a bigger repository that only mentions it mid-title */
    expect(filterIssues(FIXTURE, q({ q: "docs" })).results.map((i) => i.n)).toEqual([1, 3]);
    /* and two equal scores fall back to the larger project, deterministically */
    const tied = [row({ n: 7, t: "a docs typo", s: 500 }), row({ n: 8, t: "a docs typo", s: 900 })];
    expect(filterIssues(tied, q({ q: "docs" })).results.map((i) => i.n)).toEqual([8, 7]);
  });

  it("pages without dropping or repeating a row", () => {
    const per = q({ sort: "stars", per: 2 });
    const p1 = filterIssues(FIXTURE, { ...per, page: 1 });
    const p2 = filterIssues(FIXTURE, { ...per, page: 2 });
    expect(p1.pages).toBe(2);
    expect([...p1.results.map((i) => i.n), ...p2.results.map((i) => i.n)].sort()).toEqual([1, 2, 3, 4]);
    expect(filterIssues(FIXTURE, { ...per, page: 9 }).results).toEqual([]);
  });
});

describe("facets", () => {
  it("counts what is actually in the set", () => {
    const f = facets(FIXTURE);
    expect(f.langs.find((l) => l.value === "Go")?.count).toBe(1);
    expect(f.orgs[0]).toEqual({ value: "kubernetes", count: 1 });
    expect(f.labels.find((l) => l.value === "good first issue")?.count).toBe(2);
  });

  it("is the same as before when the query has no filters", () => {
    expect(facets(FIXTURE, q({}))).toEqual(facets(FIXTURE));
    expect(facets(FIXTURE, q({ sort: "stars", page: 4, per: 1 }))).toEqual(facets(FIXTURE));
  });

  it("narrows the other rails with a language, but keeps the language rail's siblings", () => {
    const f = facets(FIXTURE, q({ langs: ["python"] }));
    /* only the pytorch row is Python: orgs and labels describe that row */
    expect(f.orgs).toEqual([{ value: "pytorch", count: 1 }]);
    expect(f.labels).toEqual([{ value: "good first issue", count: 1 }]);
    /* the language rail ignores its own filter, so Go and Rust stay pickable */
    expect(f.langs.map((l) => l.value).sort()).toEqual(["Go", "Python", "Rust", "TypeScript"]);
    expect(f.langs.every((l) => l.count === 1)).toBe(true);
  });

  it("applies the other rails' filters to a rail", () => {
    /* label "good first" leaves rows 1 and 3, so Go and Rust drop off the language rail */
    const f = facets(FIXTURE, q({ label: "good first" }));
    expect(f.langs.map((l) => l.value).sort()).toEqual(["Python", "TypeScript"]);
    /* and the label rail itself still counts rows without that label */
    expect(f.labels.find((l) => l.value === "help wanted")?.count).toBe(1);
    expect(f.labels.find((l) => l.value === "a-compiler")?.count).toBe(1);
    /* a language and an org together: each rail ignores only its own */
    const both = facets(FIXTURE, q({ langs: ["go"], org: "pytorch" }));
    expect(both.langs).toEqual([{ value: "Python", count: 1 }]);
    expect(both.orgs).toEqual([{ value: "kubernetes", count: 1 }]);
    expect(both.labels).toEqual([]);
  });

  it("follows the text query, repo and the two toggles", () => {
    const f = facets(FIXTURE, q({ q: "docs" }));
    expect(f.langs.map((l) => l.value).sort()).toEqual(["Python", "TypeScript"]);
    expect(facets(FIXTURE, q({ unassigned: true })).langs.map((l) => l.value)).not.toContain("Python");
    expect(facets(FIXTURE, q({ beginner: true })).langs.map((l) => l.value)).not.toContain("Rust");
    expect(facets(FIXTURE, q({ repo: "rust-lang" })).orgs).toEqual([{ value: "rust-lang", count: 1 }]);
  });

  it("agrees with filterIssues on the total when no rail filter is active", () => {
    const query = q({ q: "docs", unassigned: true });
    const total = filterIssues(FIXTURE, query).total;
    const f = facets(FIXTURE, query);
    expect(f.orgs.reduce((n, o) => n + o.count, 0)).toBe(total);
  });
});

describe("facetKey", () => {
  it("ignores sort and paging but not the filters", () => {
    expect(facetKey(q({ sort: "stars", page: 3, per: 50 }))).toBe(facetKey(q({})));
    expect(facetKey(q({ langs: ["go", "rust"] }))).toBe(facetKey(q({ langs: ["rust", "go"] })));
    expect(facetKey(q({ q: "Docs   typo" }))).toBe(facetKey(q({ q: "docs typo" })));
    expect(facetKey(q({ langs: ["go"] }))).not.toBe(facetKey(q({})));
    expect(facetKey(q({ org: "a" }))).not.toBe(facetKey(q({ org: "b" })));
    expect(facetKey(q({ beginner: true }))).not.toBe(facetKey(q({ unassigned: true })));
  });
});

describe("the shipped index", () => {
  /* The site states CRAWL's numbers in the hero, the footer and the finder.
     If public/data/issues.json.gz drifts from src/data/crawlStats.ts, those
     sentences become false, so the two are pinned to each other here. */
  const file = new URL("../../../public/data/issues.json.gz", import.meta.url);
  const gz = readFileSync(file);
  const parsed = JSON.parse(gunzipSync(gz).toString("utf8")) as {
    meta: { issues: number; repos: number; orgs: number; languages: number; generated: string };
    items: IssueRow[];
  };

  it("agrees with the crawl stats the chrome quotes", () => {
    expect(parsed.meta.issues).toBe(CRAWL.issues);
    expect(parsed.items.length).toBe(CRAWL.issues);
    expect(parsed.meta.repos).toBe(CRAWL.reposWithIssues);
    expect(parsed.meta.orgs).toBe(CRAWL.orgs);
    expect(parsed.meta.languages).toBe(CRAWL.languages);
    expect(parsed.meta.generated).toBe(CRAWL.crawledAt);
  });

  it("holds rows the finder can filter and link", () => {
    const first = parsed.items[0];
    expect(first.r.split("/").length).toBe(2);
    expect(first.t.length).toBeGreaterThan(0);
    expect(issueUrl(first)).toBe(`https://github.com/${first.r}/issues/${first.n}`);
    expect(parsed.items.every((i) => i.n > 0 && /^\d{4}-\d{2}-\d{2}$/.test(i.u))).toBe(true);
  });

  it("really is beginner-filtered the way the page claims", () => {
    const beginner = filterIssues(parsed.items, q({ beginner: true }));
    expect(beginner.total).toBe(CRAWL.beginnerLabelled);
  });

  it("answers a query over the whole 40k in one pass", () => {
    const started = performance.now();
    const r = filterIssues(parsed.items, q({ q: "memory leak", sort: "updated" }));
    expect(performance.now() - started).toBeLessThan(1500);
    expect(r.total).toBeGreaterThan(0);
    /* both tokens have to appear somewhere in the row - title, repository,
       label or language - which is what "every token must land" promises */
    const haystack = (i: IssueRow) => `${i.t} ${i.r} ${i.l.join(" ")} ${i.g ?? ""}`.toLowerCase();
    expect(r.results.every((i) => haystack(i).includes("memory") && haystack(i).includes("leak"))).toBe(true);
  });
});
