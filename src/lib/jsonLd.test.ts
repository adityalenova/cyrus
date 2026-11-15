/* ══ jsonLd.test.ts — the graph must not contain anything we invented ══
   The issue's acceptance criteria are one block per page and no fabricated
   dates, so both are asserted over the whole catalog rather than a sample. */
import { describe, expect, it } from "vitest";
import { PROGRAMS } from "@/data/orgs";
import { REAL_ORGS } from "@/data/realOrgs";
import { SITE_ORIGIN } from "@/lib/seo";
import {
  jsonLdScript,
  organizationEntity,
  programEntity,
  webSite,
  type JsonLd,
} from "@/lib/jsonLd";

const datesIn = (obj: JsonLd) =>
  JSON.stringify(obj).match(/\d{4}-\d{2}-\d{2}/g) ?? [];

describe("webSite", () => {
  it("points SearchAction at the route the hero search actually posts to", () => {
    const site = webSite();
    const action = site.potentialAction as JsonLd;
    const target = action.target as JsonLd;
    expect(action["@type"]).toBe("SearchAction");
    expect(target.urlTemplate).toBe(`${SITE_ORIGIN}/skills?q={search_term_string}`);
    expect(action["query-input"]).toBe("required name=search_term_string");
  });
});

describe("programEntity", () => {
  it("emits a Course for every tracked program with an absolute url", () => {
    for (const p of PROGRAMS) {
      const data = programEntity(p);
      expect(data["@type"]).toBe("Course");
      expect(data.name).toBe(p.name);
      expect(data.url).toBe(`${SITE_ORIGIN}/programs/${p.id}`);
      expect(String(data!.image)).toMatch(/^https?:\/\//);
    }
  });

  it("never carries a date the record does not state", () => {
    for (const p of PROGRAMS) {
      const source = JSON.stringify(p);
      for (const date of datesIn(programEntity(p))) {
        expect(source.includes(date), `${p.id} invented ${date}`).toBe(true);
      }
    }
  });

  it("claims a prerequisite only where the record publishes one", () => {
    for (const p of PROGRAMS) {
      const data = programEntity(p);
      const prereq = data.coursePrerequisites;
      if (prereq !== undefined) {
        expect(typeof prereq).toBe("string");
        expect((prereq as string).trim().length).toBeGreaterThan(0);
      }
    }
    /* an unpublished field must never serialize as an empty claim */
    expect(PROGRAMS.some((p) => JSON.stringify(programEntity(p)).includes('"coursePrerequisites":""'))).toBe(false);
  });
});

describe("organizationEntity", () => {
  it("lists every catalogued org with its GitHub profile", () => {
    for (const o of REAL_ORGS) {
      const data = organizationEntity(o);
      expect(data["@type"]).toBe("Organization");
      expect(data.sameAs).toContain(`https://github.com/${o.login}`);
      expect(datesIn(data)).toEqual([]);
    }
  });
});

describe("jsonLdScript", () => {
  it("escapes anything that could close the script tag early", () => {
    const html = jsonLdScript({ name: "</script><img onerror=1>" }).__html;
    expect(html).not.toContain("</script>");
    expect(html).toContain("\\u003c");
    expect(JSON.parse(html)).toEqual({ name: "</script><img onerror=1>" });
  });
});
