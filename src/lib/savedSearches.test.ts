/* ══ savedSearches.test.ts — what a saved search is, and what it may not be
   A saved search must round-trip: the URL the finder runs becomes the
   filters that are stored, and the stored filters become that URL again.
   It must also survive the future - a filter retired tomorrow cannot be
   allowed to break a search saved today. ═══════════════════════════ */
import { describe, expect, it } from "vitest";
import {
   LANG_COUNT_MAX, NAME_MAX, ORG_MAX, SEARCHES_KEY, SEARCH_KEYS, Q_MAX,
   clipName, decodeStoredSearch, describeFilters, filtersFromParams, hydrateSavedSearch,
   isEmptySearch, mergeSearches, newSearchId, normaliseFilters, paramsFromFilters,
   readSearchStore, searchFiltersError, searchNameError, searchUrl, toSearchStore,
   unknownFilterKeys,
   type SavedSearch,
} from "./savedSearches";

const params = (s: string) => new URLSearchParams(s);

describe("normalising a search before it is stored", () => {
  it("trims, collapses and lowercases each filter the way the index does", () => {
    expect(normaliseFilters(params("q=%20Memory%20%20leak%20"))).toEqual({ q: "Memory leak" });
    expect(normaliseFilters(params("lang=TypeScript,,%20Rust%20"))).toEqual({ lang: ["rust", "typescript"] });
    expect(normaliseFilters(params("org=Vercel&label=Good%20First%20Issue"))).toEqual({
      org: "vercel", label: "good first issue",
    });
    expect(normaliseFilters(params("sort=STARS"))).toEqual({ sort: "stars" });
  });

  it("keeps the free text as it was typed, because the box shows it back", () => {
    expect(normaliseFilters(params("q=Memory Leak")).q).toBe("Memory Leak");
  });

  it("drops empty filters and the defaults, so only the choices are stored", () => {
    expect(normaliseFilters(params("q=&lang=&org=&label=&beginner=0&sort=relevance"))).toEqual({});
    expect(normaliseFilters(params("sort=relevance&beginner=1"))).toEqual({ beginner: true });
    expect(normaliseFilters(params("unassigned=1"))).toEqual({ unassigned: true });
    expect(Object.keys(normaliseFilters(params("q=go&sort=relevance&lang=")))).toEqual(["q"]);
  });

  it("never stores more than the finder is able to run", () => {
    const many = Array.from({ length: 20 }, (_, i) => `lang${i}`).join(",");
    const f = normaliseFilters(params(`lang=${many}`));
    expect(f.lang).toHaveLength(LANG_COUNT_MAX);
    const huge = "x".repeat(Q_MAX + 40);
    expect(normaliseFilters(params(`q=${huge}`)).q).toHaveLength(Q_MAX);
    expect(normaliseFilters(params(`org=${"a".repeat(200)}`)).org).toHaveLength(ORG_MAX);
  });

  it("reads a live URL without its page number, which is not part of a search", () => {
    expect(unknownFilterKeys(params("lang=rust&page=3"))).toEqual([]);
    expect(normaliseFilters(params("q=go&page=2"))).toEqual({ q: "go" });
  });
});

describe("the URL round trip", () => {
  it("writes the filters back into the same canonical query string", () => {
    const f = normaliseFilters(params("beginner=1&lang=rust&org=vercel&q=memory%20leak&sort=stars"));
    expect(paramsFromFilters(f).toString()).toBe("q=memory+leak&lang=rust&org=vercel&beginner=1&sort=stars");
  });

  it("reopens exactly what was saved, in the same order every time", () => {
    const raw = "org=Vercel&lang=Rust,Go&label=Good%20First%20Issue&unassigned=1&sort=updated&q=Docs";
    const once = searchUrl(filtersFromParams(params(raw)));
    /* the second read is the link a reopen actually hands the finder, so it
       has to be parsed the way a browser parses it: path first, query after */
    const fromLink = (href: string) => new URL(href, "http://cyrus.local").searchParams;
    const twice = searchUrl(filtersFromParams(fromLink(once)));
    expect(twice).toBe(once);
    expect(once).toBe("/issues?q=Docs&lang=go%2Crust&org=vercel&label=good+first+issue&unassigned=1&sort=updated");
  });

  it("an unfiltered search opens the finder itself, not a query string", () => {
    expect(searchUrl({})).toBe("/issues");
    expect(searchUrl({ sort: "relevance" })).toBe("/issues");
  });
});

describe("a search saved before a filter was retired", () => {
  it("skips the keys the page does not have and names them", () => {
    const { filters, dropped } = decodeStoredSearch({ filters: { q: "docs", status: "open", lang: ["rust"] } });
    expect(filters).toEqual({ q: "docs", lang: ["rust"] });
    expect(dropped).toEqual(["status"]);
  });

  it("never throws on a row it cannot read", () => {
    for (const junk of [null, undefined, "not json", 42, [], "[]", { filters: 7 }, { filters: "x" }]) {
      expect(() => decodeStoredSearch(junk)).not.toThrow();
      expect(decodeStoredSearch(junk).filters).toEqual({});
    }
    expect(decodeStoredSearch('{"filters":{"q":"go"}}').filters).toEqual({ q: "go" });
  });

  it("takes a bare filter object, a lang as text or as a list, and a stale sort", () => {
    expect(decodeStoredSearch({ q: "go", lang: "Go,Rust" }).filters).toEqual({ q: "go", lang: ["go", "rust"] });
    expect(decodeStoredSearch({ sort: "newest" }).filters).toEqual({});
    expect(decodeStoredSearch({ beginner: "1", unassigned: true }).filters).toEqual({ beginner: true, unassigned: true });
  });

  it("drops a value that is too long rather than carrying it, and keeps the row openable", () => {
    const { filters } = decodeStoredSearch({ filters: { q: "z".repeat(400), org: "a".repeat(120) } });
    expect(filters.q).toHaveLength(Q_MAX);
    expect(filters.org!.length).toBeLessThanOrEqual(39);
    expect(searchUrl(filters)).toContain("/issues?");
  });

  it("reads a server row, and refuses one with no name or no id", () => {
    const row = { itemId: "sq-1", title: "  Rust  good  first  ", meta: { filters: { lang: ["rust"], beginner: true } }, createdAt: "2026-11-01T09:00:00Z" };
    expect(hydrateSavedSearch(row)).toMatchObject({ id: "sq-1", name: "Rust good first", added: "2026-11-01" });
    expect(hydrateSavedSearch({ itemId: "", title: "x" })).toBeNull();
    expect(hydrateSavedSearch({ itemId: "sq-2", title: "   " })).toBeNull();
  });
});

describe("validating what the server is asked to store", () => {
  it("accepts exactly the filters the finder writes", () => {
    const good = normaliseFilters(params("q=docs&lang=rust&org=vercel&label=bug&repo=vercel/next.js&beginner=1&unassigned=1&sort=stars"));
    expect(Object.keys(good)).toHaveLength(SEARCH_KEYS.length);
    expect(searchFiltersError(good)).toBeNull();
    expect(searchFiltersError({ filters: good })).toBeNull();
    expect(searchFiltersError({})).toBeNull();
  });

  it("refuses a key that is not a filter, including a page number", () => {
    expect(searchFiltersError({ status: "open" })).toMatch(/unknown filter: status/);
    expect(searchFiltersError({ page: "2" })).toMatch(/unknown filter/);
  });

  it("refuses an over-long or untrimmed name", () => {
    expect(searchNameError("")).toMatch(/needs a name/);
    expect(searchNameError("   ")).toMatch(/needs a name/);
    expect(searchNameError(undefined)).toMatch(/needs a name/);
    expect(searchNameError("x".repeat(NAME_MAX + 1))).toMatch(/80 characters at most/);
    expect(searchNameError("rust, good first issue")).toBeNull();
    expect(clipName("  a  b  ")).toBe("a b");
  });

  it("refuses absurd filter counts and oversized values", () => {
    expect(searchFiltersError({ lang: Array.from({ length: 40 }, (_, i) => `l${i}`) })).toMatch(/languages at most/);
    expect(searchFiltersError({ lang: "rust" })).toMatch(/must be a list/);
    expect(searchFiltersError({ q: "x".repeat(Q_MAX + 1) })).toMatch(/characters at most/);
    expect(searchFiltersError({ q: 12 })).toMatch(/must be text/);
    expect(searchFiltersError({ beginner: "yes" })).toMatch(/true or false/);
    expect(searchFiltersError({ sort: "newest" })).toMatch(/not a sort/);
    expect(searchFiltersError("rust")).toMatch(/must be an object/);
    expect(searchFiltersError([{ q: "rust" }])).toMatch(/must be an object/);
  });

  it("refuses a value that was not normalised before it was saved", () => {
    expect(searchFiltersError({ org: "Vercel" })).toMatch(/must be normalised/);
    expect(searchFiltersError({ q: "  docs " })).toMatch(/must be normalised/);
    expect(searchFiltersError({ q: "docs" })).toBeNull();
  });
});

describe("what the board holds in this browser", () => {
  const s = (id: string, name: string, added: string, filters: SavedSearch["filters"] = { q: name }): SavedSearch =>
    ({ id, name, filters, added });

  it("keys the list under one documented localStorage key", () => {
    expect(SEARCHES_KEY).toBe("cyrus.searches.v1");
  });

  it("round-trips the map it writes to localStorage", () => {
    const list = [s("a", "rust first issues", "2026-11-02", { lang: ["rust"], beginner: true })];
    const back = readSearchStore(toSearchStore(list));
    expect(back).toEqual(list);
  });

  it("drops entries that are not searches instead of rendering them", () => {
    const store = { a: s("a", "keep", "2026-11-01"), b: { name: "no id" }, c: null, d: { id: "d" }, e: 42 };
    expect(readSearchStore(store).map((x) => x.name)).toEqual(["keep"]);
    expect(readSearchStore(undefined)).toEqual([]);
    expect(readSearchStore("garbage")).toEqual([]);
  });

  it("unions the account's rows with this browser's, newest first, and keeps both", () => {
    const server = [s("1", "from the account", "2026-10-01"), s("2", "shared", "2026-10-20")];
    const local = [s("2", "shared, renamed here", "2026-10-20"), s("3", "only this browser", "2026-11-05", { q: "docs" })];
    const merged = mergeSearches(server, local);
    expect(merged.map((m) => m.id)).toEqual(["3", "2", "1"]);
    expect(merged.find((m) => m.id === "2")!.name).toBe("shared");
    expect(merged.find((m) => m.id === "3")!.filters).toEqual({ q: "docs" });
  });

  it("gives every saved search an id that survives a rename", () => {
    const a = newSearchId(), b = newSearchId();
    expect(a).toMatch(/^sq-/);
    expect(a.length).toBeLessThanOrEqual(200);
    expect(a).not.toBe(b);
  });
});

describe("describing a search, and its empty state", () => {
  it("says what each filter asks for", () => {
    expect(describeFilters(normaliseFilters(params("q=memory leak&lang=rust,go&beginner=1&sort=updated")))).toEqual([
      "“memory leak”", "lang: go, rust", "beginner-labelled", "sort: Recently touched",
    ]);
  });

  it("an empty search is an empty list, and nothing is saved for it", () => {
    expect(isEmptySearch({})).toBe(true);
    expect(isEmptySearch({ sort: "relevance" })).toBe(true);
    expect(isEmptySearch({ q: "go" })).toBe(false);
    expect(describeFilters({})).toEqual([]);
  });
});
