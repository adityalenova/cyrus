import { describe, expect, it } from "vitest";
import { PROGRAM_DETAILS } from "../../data/programDetails";
import type { EligibilityFacets } from "../../data/programDetails";
import {
  DEFAULT_QUERY,
  classify,
  countryListCount,
  facetsActive,
  facetsOf,
  filterCatalog,
  normalizeCountry,
  queryToParams,
  queryToSearch,
  readQuery,
  reasonOf,
  type CatalogQuery,
} from "./model";

const q = (patch: Partial<CatalogQuery> = {}): CatalogQuery => ({ ...DEFAULT_QUERY, ...patch });

/* The facets are a mechanical reading of the eligibility sentence, so the
   first table pins the one record that publishes a structured fact and the
   twelve that deliberately publish none. */
describe("what the records actually publish", () => {
  it("encodes GSoC's own sentence and nothing beyond it", () => {
    const facets = PROGRAM_DETAILS.gsoc.eligibilityFacets!;
    expect(facets.studentStatus).toBe("optional");
    expect(facets.residencyNote).toBe("18+ and legally able to work in your country");
    /* no country list is published, so no country list exists here */
    expect("countries" in facets).toBe(false);
    expect(facets.source).toContain("students and non-students alike");
  });

  it("keeps every other record undefined so the UI shows Unknown", () => {
    for (const [id, detail] of Object.entries(PROGRAM_DETAILS)) {
      if (id === "gsoc") continue;
      expect(detail.eligibilityFacets, `${id} must not carry invented facets`).toBeUndefined();
    }
    expect(facetsOf("lfx")).toBeUndefined();
    expect(facetsOf("not-a-program")).toBeUndefined();
  });

  it("reports that no program publishes a country list", () => {
    expect(countryListCount()).toBe(0);
  });

  it("leaves the free-text eligibility field in place", () => {
    expect(PROGRAM_DETAILS.gsoc.eligibility).toBe(
      "18+ and legally able to work in your country; students and non-students alike",
    );
    expect(PROGRAM_DETAILS.lfx.eligibility).toContain("Open worldwide");
  });
});

describe("facet predicate, including the unknown state", () => {
  const gsoc: EligibilityFacets = PROGRAM_DETAILS.gsoc.eligibilityFacets!;

  it("matches a program whose published rule equals the filter", () => {
    const r = classify(gsoc, q({ student: "optional" }));
    expect(r.student).toBe("eligible");
    expect(r.overall).toBe("eligible");
  });

  it("marks a program ineligible only when its published rule conflicts", () => {
    const r = classify(gsoc, q({ student: "required" }));
    expect(r.student).toBe("ineligible");
    expect(r.overall).toBe("ineligible");
    expect(reasonOf(r)).toContain("welcomes students and non-students");
  });

  it("marks a program unknown when it publishes no rule for the question", () => {
    expect(classify(undefined, q({ student: "optional" })).overall).toBe("unknown");
    expect(classify(undefined, q({ country: "IN" })).overall).toBe("unknown");
    /* GSoC publishes a student rule but no country list */
    const gsocCountry = classify(gsoc, q({ country: "IN" }));
    expect(gsocCountry.student).toBe("eligible");
    expect(gsocCountry.country).toBe("unknown");
    expect(gsocCountry.overall).toBe("unknown");
  });

  it("treats a filter that is off as satisfied, not as evidence", () => {
    const r = classify(undefined, DEFAULT_QUERY);
    expect(r).toMatchObject({ overall: "eligible", student: "eligible", country: "eligible" });
    expect(facetsActive(DEFAULT_QUERY)).toBe(false);
    expect(facetsActive(q({ country: "IN" }))).toBe(true);
  });

  it("never lets unknown win over a published conflict", () => {
    const r = classify({ studentStatus: "required" }, q({ student: "optional", country: "IN" }));
    expect(r.student).toBe("ineligible");
    expect(r.country).toBe("unknown");
    expect(r.overall).toBe("ineligible");
  });
});

describe("missing-field fixtures", () => {
  it("labels an empty facet object as unknown for both questions", () => {
    const r = classify({}, q({ student: "optional", country: "DE" }));
    expect(r.student).toBe("unknown");
    expect(r.country).toBe("unknown");
    expect(r.overall).toBe("unknown");
  });

  it("treats studentStatus 'unknown' as no rule, not as a published rule", () => {
    expect(classify({ studentStatus: "unknown" }, q({ student: "required" })).student).toBe("unknown");
    /* the "no student rule published" filter selects it, because that is a
       statement about the record rather than about the reader */
    expect(classify({ studentStatus: "unknown" }, q({ student: "unknown" })).student).toBe("eligible");
    expect(classify(undefined, q({ student: "unknown" })).student).toBe("eligible");
    expect(classify({ studentStatus: "optional" }, q({ student: "unknown" })).student).toBe("ineligible");
  });

  it("does not read an empty country list as exclusion or inclusion", () => {
    const r = classify({ countries: [] }, q({ country: "IN" }));
    expect(r.country).toBe("unknown");
    expect(r.overall).toBe("unknown");
  });

  it("reads a published country list case-insensitively", () => {
    const facets = { countries: ["in", "br"] };
    expect(classify(facets, q({ country: "IN" })).country).toBe("eligible");
    expect(classify(facets, q({ country: "DE" })).country).toBe("ineligible");
    expect(classify(facets, q({ country: "DE" })).overall).toBe("ineligible");
  });

  it("rejects malformed country codes rather than guessing", () => {
    expect(normalizeCountry("in")).toBe("IN");
    expect(normalizeCountry(" IND ")).toBeNull();
    expect(normalizeCountry("1N")).toBeNull();
    expect(normalizeCountry("")).toBeNull();
    expect(normalizeCountry(null)).toBeNull();
  });
});

describe("catalog pipeline composes with the status pill", () => {
  const catalog = [
    { id: "gsoc", status: "live" },
    { id: "lfx", status: "live" },
    { id: "kde", status: "closed" },
    { id: "ghost", status: "live" },
  ];

  it("applies the status pill first", () => {
    const { rows, counts } = filterCatalog(catalog, q({ status: "live" }));
    expect(rows.map((r) => r.program.id)).toEqual(["gsoc", "lfx", "ghost"]);
    expect(counts.shown).toBe(3);
    expect(counts.eligible).toBe(3);
  });

  it("keeps unknown programs and hides only published conflicts", () => {
    const { rows, counts } = filterCatalog(catalog, q({ student: "optional" }));
    expect(rows.map((r) => r.program.id)).toEqual(["gsoc", "lfx", "kde", "ghost"]);
    expect(counts).toEqual({ shown: 4, eligible: 1, ineligible: 0, unknown: 3 });

    const strict = filterCatalog(catalog, q({ student: "required" }));
    expect(strict.rows.map((r) => r.program.id)).toEqual(["lfx", "kde", "ghost"]);
    expect(strict.counts).toEqual({ shown: 3, eligible: 0, ineligible: 1, unknown: 3 });
  });

  it("composes status and facets", () => {
    const { rows, counts } = filterCatalog(catalog, q({ status: "live", student: "optional" }));
    expect(rows.map((r) => r.program.id)).toEqual(["gsoc", "lfx", "ghost"]);
    expect(counts).toEqual({ shown: 3, eligible: 1, ineligible: 0, unknown: 2 });
  });
});

describe("filter URL round-trip", () => {
  it("reads no query as the defaults", () => {
    expect(readQuery("")).toEqual(DEFAULT_QUERY);
    expect(queryToSearch(DEFAULT_QUERY)).toBe("");
  });

  it("round-trips all three filters", () => {
    const query = q({ status: "upcoming", student: "optional", country: "IN" });
    const search = queryToSearch(query);
    expect(search).toBe("?status=upcoming&student=optional&country=IN");
    expect(readQuery(search)).toEqual(query);
  });

  it("normalises a lowercase country and drops unknown options", () => {
    expect(readQuery("?country=br")).toEqual(q({ country: "BR" }));
    expect(readQuery("?status=soon&student=maybe&country=IND")).toEqual(DEFAULT_QUERY);
  });

  it("omits defaults from the built params", () => {
    expect(queryToParams(DEFAULT_QUERY)).toEqual({});
    expect(queryToParams(q({ student: "unknown" }))).toEqual({ student: "unknown" });
  });
});
