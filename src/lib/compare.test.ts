import { describe, expect, it } from "vitest";
import {
  ATTRIBUTES,
  COMPARE_PARAM,
  MAX_COMPARE,
  buildMatrix,
  cellOf,
  compareAttribute,
  compareHref,
  differingAttributes,
  isFull,
  resolveSelection,
  searchCandidates,
  selectionFromSearch,
  selectionToQuery,
  sharedAttributes,
  toggleUrl,
  type CompareRow,
} from "./compare";

const row = (over: Partial<CompareRow> = {}): CompareRow => ({
  url: "https://github.com/a/one",
  title: "One",
  org: "alpha",
  program: "GSoC",
  year: 2026,
  season: "GSoC'26",
  lang: "TypeScript",
  tags: ["react", "next"],
  mentor: "ana",
  stars: 10,
  ...over,
});

describe("selectionFromSearch", () => {
  it("reads each project from its own repeated parameter", () => {
    const sel = selectionFromSearch(`?${COMPARE_PARAM}=u1&${COMPARE_PARAM}=u2`);
    expect(sel).toEqual(["u1", "u2"]);
  });
  it("accepts a search string with or without the leading question mark", () => {
    expect(selectionFromSearch("c=u1")).toEqual(["u1"]);
    expect(selectionFromSearch("?c=u1")).toEqual(["u1"]);
  });
  it("keeps order, drops blanks and collapses a repeat", () => {
    expect(selectionFromSearch("?c=u2&c=&c=u1&c=u2")).toEqual(["u2", "u1"]);
  });
  it("never returns more than the cap", () => {
    const sel = selectionFromSearch("?c=a&c=b&c=c&c=d");
    expect(sel).toHaveLength(MAX_COMPARE);
    expect(sel).toEqual(["a", "b", "c"]);
  });
  it("reads an empty page as no selection", () => {
    expect(selectionFromSearch("")).toEqual([]);
    expect(selectionFromSearch("?q=react")).toEqual([]);
  });
  it("round-trips a url containing query characters", () => {
    const url = "https://example.com/x?a=1&b=2";
    expect(selectionFromSearch(selectionToQuery([url]))).toEqual([url]);
    expect(selectionToQuery([url])).toContain("%26");
  });
});

describe("compareHref", () => {
  it("is a bare path with no selection", () => {
    expect(compareHref([])).toBe("/compare");
  });
  it("carries one parameter per project", () => {
    expect(compareHref(["a", "b"])).toBe("/compare?c=a&c=b");
  });
});

describe("toggleUrl", () => {
  it("adds to an empty selection", () => {
    expect(toggleUrl([], "a")).toEqual(["a"]);
  });
  it("removes what is already selected", () => {
    expect(toggleUrl(["a", "b"], "a")).toEqual(["b"]);
  });
  it("drops the oldest pick at the cap rather than growing a column", () => {
    const next = toggleUrl(["a", "b", "c"], "d");
    expect(next).toEqual(["b", "c", "d"]);
    expect(next).toHaveLength(MAX_COMPARE);
  });
  it("ignores a blank url", () => {
    expect(toggleUrl(["a"], "   ")).toEqual(["a"]);
  });
  it("reports a full selection", () => {
    expect(isFull(["a", "b"])).toBe(false);
    expect(isFull(["a", "b", "c"])).toBe(true);
  });
});

describe("cellOf", () => {
  it("prefers the named round over the bare year", () => {
    expect(cellOf("timeline", row())).toBe("GSoC'26");
    expect(cellOf("timeline", row({ season: "" }))).toBe("2026");
    expect(cellOf("timeline", row({ season: "", year: 0 }))).toBe("");
  });
  it("joins the tech stack", () => {
    expect(cellOf("stack", row({ tags: ["go", "grpc"] }))).toBe("go, grpc");
  });
  it("hides a zero star count instead of printing it", () => {
    expect(cellOf("stars", row({ stars: 0 }))).toBe("");
    expect(cellOf("stars", row({ stars: 42 }))).toBe("42");
  });
  it("returns an empty cell for every unpublished value", () => {
    for (const attr of ATTRIBUTES) {
      expect(cellOf(attr.id, row({ program: "", season: "", year: 0, org: "", lang: "", tags: [], mentor: "", stars: 0 }))).toBe("");
    }
  });
});

describe("compareAttribute", () => {
  it("marks an identical value as shared", () => {
    const m = compareAttribute(ATTRIBUTES[0], [row(), row({ url: "u2" })]);
    expect(m.kind).toBe("same");
    expect(m.cells).toEqual(["GSoC", "GSoC"]);
  });
  it("marks a split value as differing", () => {
    const m = compareAttribute(ATTRIBUTES[0], [row(), row({ program: "MLH" })]);
    expect(m.kind).toBe("differs");
  });
  it("treats a value one source omits as a difference", () => {
    const m = compareAttribute(ATTRIBUTES[3], [row(), row({ lang: "" })]);
    expect(m.kind).toBe("differs");
    expect(m.cells[1]).toBe("");
  });
  it("marks a column no source published as unknown", () => {
    const m = compareAttribute(ATTRIBUTES[5], [row({ mentor: "" }), row({ mentor: "" })]);
    expect(m.kind).toBe("unknown");
  });
  it("calls a single selection shared, not differing", () => {
    expect(compareAttribute(ATTRIBUTES[0], [row()]).kind).toBe("same");
  });
});

describe("buildMatrix", () => {
  it("emits one row per attribute in order", () => {
    const m = buildMatrix([row(), row({ url: "u2" })]);
    expect(m.map((r) => r.id)).toEqual(ATTRIBUTES.map((a) => a.id));
  });
  it("splits shared from differing", () => {
    const m = buildMatrix([row(), row({ program: "MLH", lang: "Go" })]);
    expect(sharedAttributes(m).map((r) => r.id)).toContain("stack");
    expect(differingAttributes(m).map((r) => r.id)).toEqual(["program", "lang"]);
  });
  it("carries no difficulty column", () => {
    expect(ATTRIBUTES.map((a) => a.id)).not.toContain("difficulty");
  });
});

describe("resolveSelection", () => {
  const rows = [row(), row({ url: "https://github.com/b/two", title: "Two" })];

  it("returns rows in selection order", () => {
    const r = resolveSelection(rows, [rows[1].url, rows[0].url]);
    expect(r.rows.map((x) => x.title)).toEqual(["Two", "One"]);
    expect(r.missing).toEqual([]);
  });
  it("names a url the archive no longer has", () => {
    const r = resolveSelection(rows, ["https://github.com/gone/x"]);
    expect(r.rows).toEqual([]);
    expect(r.missing).toEqual(["https://github.com/gone/x"]);
  });
  it("keeps the columns it can resolve alongside the gap", () => {
    const r = resolveSelection(rows, [rows[0].url, "https://github.com/gone/x"]);
    expect(r.rows).toHaveLength(1);
    expect(r.missing).toHaveLength(1);
  });
  it("ignores a row with no url so it can never be selected", () => {
    const r = resolveSelection([row({ url: "" })], [""]);
    expect(r.rows).toEqual([]);
  });
});

describe("searchCandidates", () => {
  const rows = [
    row({ url: "u1", title: "React dashboard", org: "facebook", tags: ["react"] }),
    row({ url: "u2", title: "Grafana plugins", org: "grafana", tags: ["go"] }),
    row({ url: "", title: "no url", org: "ghost" }),
  ];

  it("returns unselected rows with a url when there is no term", () => {
    expect(searchCandidates(rows, "").map((r) => r.url)).toEqual(["u1", "u2"]);
  });
  it("excludes what is already selected", () => {
    expect(searchCandidates(rows, "", ["u1"]).map((r) => r.url)).toEqual(["u2"]);
  });
  it("ranks a title prefix above an incidental match", () => {
    expect(searchCandidates(rows, "react")[0].url).toBe("u1");
  });
  it("matches on org and on the tech stack", () => {
    expect(searchCandidates(rows, "grafana").map((r) => r.url)).toEqual(["u2"]);
    expect(searchCandidates(rows, "grpc")).toEqual([]);
  });
  it("ignores case and punctuation", () => {
    expect(searchCandidates(rows, "  RE-ACT! ").map((r) => r.url)).toEqual(["u1"]);
  });
  it("caps the list it hands the picker", () => {
    const many = Array.from({ length: 30 }, (_, i) => row({ url: `u${i}`, title: `project ${i}` }));
    expect(searchCandidates(many, "project", [], 5)).toHaveLength(5);
  });
});
