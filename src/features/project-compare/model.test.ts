/* ══ model.test.ts — repository comparison's promises ══════════════
   The URL round-trip, the three-column cap, the difference condition, and the
   line between a missing value and a real zero. Fixtures are built through
   factsOf() so the tests exercise the same normalisation the page does.      ═ */
import { describe, expect, it } from "vitest";
import { CATALOG } from "../../lib/util";
import type { Repo } from "../../lib/types";
import {
  ACTIVITY_META,
  CATALOG_AS_OF,
  MAX_REPOS,
  PROGRAM_SHELF_AS_OF,
  activityOf,
  cellOf,
  compareField,
  compareHref,
  factsOf,
  isFull,
  normalizeRepoKey,
  parseSavedComparisons,
  removeComparison,
  resolveFacts,
  saveComparison,
  searchRepos,
  selectionFromSearch,
  selectionToQuery,
  toggleKey,
  type RepoFacts,
} from "./model";

type RepoOverride = Partial<Omit<Repo, "lang" | "license" | "updated">> & {
  lang?: string | null; license?: string | null; updated?: string | null;
};

const repo = (over: RepoOverride = {}): Repo => ({
  cat: "mcp",
  repo: "acme/alpha",
  stars: 1200,
  forks: 60,
  issues: 12,
  lang: "TypeScript",
  license: "MIT",
  updated: "2026-10-02",
  home: "",
  url: "https://github.com/acme/alpha",
  desc: "An agent tool",
  tags: ["ai-agents", "typescript"],
  ...over,
} as Repo);

const facts = (over: RepoOverride = {}): RepoFacts => factsOf(repo(over));

describe("repository keys", () => {
  it("folds URLs, trailing slashes and .git into owner/name", () => {
    expect(normalizeRepoKey("https://github.com/vercel/next.js")).toBe("vercel/next.js");
    expect(normalizeRepoKey(" https://www.github.com/vercel/next.js.git ")).toBe("vercel/next.js");
    expect(normalizeRepoKey("vercel/next.js/")).toBe("vercel/next.js");
    expect(normalizeRepoKey("vercel")).toBe("");
    expect(normalizeRepoKey("a/b/c")).toBe("");
    expect(normalizeRepoKey("not a repo")).toBe("");
  });
});

describe("URL selection", () => {
  it("round-trips a three-column selection through the query string", () => {
    const keys = ["vercel/next.js", "facebook/react", "kubernetes/kubernetes"];
    const query = selectionToQuery(keys);
    expect(query).toBe("repos=vercel/next.js,facebook/react,kubernetes/kubernetes");
    expect(selectionFromSearch(`?${query}`)).toEqual(keys);
    expect(compareHref(keys)).toBe(`/projects/compare?${query}`);
  });

  it("accepts repeated params, commas, duplicates and hand-edited casing", () => {
    expect(selectionFromSearch("?repos=acme/alpha&repos=acme/beta,acme/gamma")).toEqual([
      "acme/alpha", "acme/beta", "acme/gamma",
    ]);
    expect(selectionFromSearch("?repos=ACME/Alpha,acme/alpha,acme/beta")).toEqual(["ACME/Alpha", "acme/beta"]);
    expect(selectionFromSearch("?repos=,,")).toEqual([]);
    expect(selectionFromSearch("")).toEqual([]);
  });

  it("caps the selection at three without reordering", () => {
    const keys = ["a/one", "b/two", "c/three", "d/four"];
    expect(selectionFromSearch(`?repos=${keys.join(",")}`)).toEqual(["a/one", "b/two", "c/three"]);
    expect(MAX_REPOS).toBe(3);
    const atCap = ["a/one", "b/two", "c/three"];
    expect(toggleKey(atCap, "d/four")).toEqual(atCap);
    expect(isFull(atCap)).toBe(true);
    expect(toggleKey(["a/one"], "d/four")).toEqual(["a/one", "d/four"]);
  });

  it("toggles a selected key off, case-insensitively", () => {
    expect(toggleKey(["acme/alpha", "acme/beta"], "ACME/Alpha")).toEqual(["acme/beta"]);
    expect(toggleKey([], "acme/alpha")).toEqual(["acme/alpha"]);
    expect(toggleKey(["acme/alpha"], "nonsense")).toEqual(["acme/alpha"]);
    expect(compareHref([])).toBe("/projects/compare");
  });
});

describe("difference and similarity", () => {
  it("calls equal stated values the same and split values different", () => {
    const a = facts();
    const b = facts({ repo: "other/beta", url: "https://github.com/other/beta" });
    expect(compareField({ id: "stars", label: "Stars" }, [a, b]).kind).toBe("same");
    expect(compareField({ id: "owner", label: "Organization" }, [a, b]).kind).toBe("differs");
    expect(compareField({ id: "license", label: "Licence" }, [a, b]).kind).toBe("same");

    const c = facts({ stars: 1300 });
    expect(compareField({ id: "stars", label: "Stars" }, [a, c]).kind).toBe("differs");
  });

  it("reads the same topic set in any order as the same stack", () => {
    const a = facts({ tags: ["typescript", "ai-agents"] });
    const b = facts({ tags: ["ai-agents", "typescript"] });
    expect(cellOf("stack", a).text).toBe("typescript, ai-agents");
    expect(compareField({ id: "stack", label: "Tech stack" }, [a, b]).kind).toBe("same");
    expect(compareField({ id: "stack", label: "Tech stack" }, [a, facts({ tags: ["rust"] })]).kind).toBe("differs");
  });

  it("marks a field no repository states as unknown, and a partly stated one as differing", () => {
    const a = facts({ license: null });
    const b = facts({ repo: "acme/beta", license: null });
    expect(compareField({ id: "license", label: "Licence" }, [a, b]).kind).toBe("unknown");
    expect(compareField({ id: "mentors", label: "Mentors" }, [a, b]).kind).toBe("unknown");

    const c = facts({ repo: "acme/beta", lang: null });
    expect(compareField({ id: "lang", label: "Primary language" }, [a, c]).kind).toBe("differs");
  });

  it("derives difficulty from the star band and activity from the snapshot", () => {
    const mid = facts({ stars: 12_000 });
    const top = facts({ stars: 90_000, repo: "acme/top" });
    expect(cellOf("difficulty", mid).text).toBe("Intermediate");
    expect(cellOf("difficulty", top).text).toBe("Advanced");
    expect(compareField({ id: "difficulty", label: "Difficulty" }, [mid, top]).kind).toBe("differs");
    expect(compareField({ id: "difficulty", label: "Difficulty" }, [facts({ stars: 1 }), facts({ stars: 1, repo: "acme/b" })]).kind).toBe("same");
  });
});

describe("missing versus zero", () => {
  it("prints a real zero as 0, never as a dash", () => {
    const z = facts({ stars: 0, issues: 0 });
    expect(cellOf("stars", z)).toEqual({ text: "0", value: "0", zero: true });
    expect(cellOf("issues", z)).toEqual({ text: "0", value: "0", zero: true });
    expect(cellOf("stars", facts({ stars: 0 })).value).not.toBeNull();
    expect(compareField({ id: "stars", label: "Stars" }, [facts({ stars: 0 }), facts({ stars: 0, repo: "a/b" })]).kind).toBe("same");
  });

  it("prints an absent field as a dash with a null value", () => {
    const a = facts({ lang: "-", license: "", updated: "" });
    expect(cellOf("lang", a)).toEqual({ text: "—", value: null, zero: false });
    expect(cellOf("license", a)).toEqual({ text: "—", value: null, zero: false });
    expect(cellOf("updated", a)).toEqual({ text: "—", value: null, zero: false });
    expect(cellOf("activity", a)).toEqual({ text: "—", value: null, zero: false });
  });

  it("bands last-push age against the row's own snapshot", () => {
    expect(activityOf("2026-10-21", CATALOG_AS_OF)).toEqual({ band: "active", days: 0 });
    expect(activityOf("2026-09-01", CATALOG_AS_OF)).toEqual({ band: "quiet", days: 50 });
    expect(activityOf("2026-05-01", CATALOG_AS_OF)).toEqual({ band: "dormant", days: 173 });
    expect(activityOf(null, CATALOG_AS_OF)).toBeNull();
    expect(activeLabel("dormant")).toContain("90");

    const shelf = facts({ cat: "programs", repo: "kubernetes/kubernetes", updated: "2026-10-03", tags: ["kubernetes"] });
    expect(shelf.snapshot).toBe(PROGRAM_SHELF_AS_OF);
    expect(cellOf("activity", shelf).text).toBe("Active · 0d");
  });
});

function activeLabel(band: keyof typeof ACTIVITY_META): string {
  return ACTIVITY_META[band].days;
}

describe("catalog resolution", () => {
  const catalog = [
    repo(),
    repo({ repo: "acme/beta", stars: 5 }),
    repo({ repo: "programs/gamma", cat: "programs", stars: 900 }),
  ];

  it("resolves case-insensitively and reports stale keys instead of blank columns", () => {
    const out = resolveFacts(["ACME/Alpha", "acme/nope", "ACME/ALPHA"], catalog);
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0].key).toBe("acme/alpha");
    expect(out.missing).toEqual(["acme/nope"]);
  });

  it("names the snapshot each row came from", () => {
    expect(factsOf(catalog[0]).snapshot).toBe(CATALOG_AS_OF);
    expect(factsOf(catalog[2]).snapshot).toBe(PROGRAM_SHELF_AS_OF);
  });

  it("derives a program stack only for repositories the shelf lists", () => {
    const kubernetes = CATALOG.find((r) => r.repo.toLowerCase() === "kubernetes/kubernetes")!;
    const k = factsOf(kubernetes);
    expect(k.programs).toContain("GSoC");
    expect(k.programStack.length).toBeGreaterThan(0);
    expect(k.programs.length).toBeGreaterThan(0);
    expect(facts().programStack).toEqual([]);
    expect(facts().mentors).toEqual([]);
  });

  it("searches name first and skips what is already selected", () => {
    const hits = searchRepos("beta", [], 5, catalog);
    expect(hits.map((h) => h.key)).toEqual(["acme/beta"]);
    expect(searchRepos("beta", ["acme/beta"], 5, catalog)).toEqual([]);
    expect(searchRepos("", [], 2, catalog).map((h) => h.key)).toEqual(["acme/alpha", "programs/gamma"]);
  });
});

describe("saved comparisons", () => {
  it("saves, lists newest first, removes, and round-trips through storage", () => {
    const first = saveComparison([], "Front of the queue", ["acme/alpha", "acme/beta"], Date.UTC(2026, 10, 22));
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = saveComparison(first.list, "Runtime picks", ["acme/beta"], Date.UTC(2026, 10, 23));
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.list.map((c) => c.name)).toEqual(["Runtime picks", "Front of the queue"]);

    const parsed = parseSavedComparisons(JSON.parse(JSON.stringify(second.list)));
    expect(parsed).toHaveLength(2);
    expect(parsed[0].repos).toEqual(["acme/beta"]);
    expect(parsed[0].savedAt).toBe("2026-11-23T00:00:00.000Z");
    expect(removeComparison(second.list, second.entry.id)).toHaveLength(1);
  });

  it("refuses an unnamed or empty comparison and caps stored repos", () => {
    expect(saveComparison([], "   ", ["acme/alpha"])).toEqual({ ok: false, error: "Give this comparison a name." });
    expect(saveComparison([], "ok", [])).toEqual({ ok: false, error: "Choose at least one repository, then save." });
    const big = saveComparison([], "too many", ["a/1", "b/2", "c/3", "d/4"], 0);
    expect(big.ok).toBe(true);
    if (big.ok) expect(big.entry.repos).toHaveLength(3);
  });

  it("drops malformed saved rows instead of rendering them", () => {
    const rows = parseSavedComparisons([
      { id: "x", name: "Good", repos: ["acme/alpha"], savedAt: "2026-11-01T00:00:00.000Z" },
      { id: "y", name: "", repos: ["acme/beta"] },
      { id: "z", name: "No repos", repos: [] },
      { id: "w", name: "Bad repo", repos: ["nonsense"] },
      null,
    ]);
    expect(rows.map((r) => r.name)).toEqual(["Good"]);
  });
});
