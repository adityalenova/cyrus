/* ══ programFields.test.ts — a field the record does not publish reads as an
   honest gap, never a zero, a blank, or an inferred fact. Both the catalog card
   and the detail page call these same helpers, so the wording is asserted here
   once and the tests below prove both surfaces agree.                    ══ */
import { describe, expect, it } from "vitest";
import { PROGRAMS } from "@/data/orgs";
import { PROGRAM_DETAILS } from "@/data/programDetails";
import type { Program } from "@/lib/types";
import {
  NOT_AVAILABLE,
  NOT_PUBLISHED,
  eligibilityText,
  fieldText,
  isPublished,
  reachText,
  stipendMeta,
  stipendPhrase,
  stipendText,
  windowText,
} from "@/lib/programFields";

/* a fully published record: every field the surfaces read carries source prose */
const complete: Program = {
  id: "fixture-full", name: "Full Fixture", owner: "org", img: "/a.png", url: "https://x",
  tag: "A complete record.", pay: "$1,500 – $3,000", payNote: "PER TERM",
  status: "live", window: "Term opens Sep", orgs: "47 host projects", slots: "1,303 projects",
  phases: [],
};

/* the same record with the stipend, window, reach and note unpublished — the
   shape that used to leak a blank or a "$0" onto the card and detail page */
const partial: Program = {
  id: "fixture-partial", name: "Partial Fixture", owner: "org", img: "", url: "https://x",
  tag: "A record with gaps.", status: "upcoming", phases: [],
};

describe("isPublished", () => {
  it("treats only non-empty prose as published", () => {
    expect(isPublished("Real value")).toBe(true);
    expect(isPublished("   ")).toBe(false);
    expect(isPublished("")).toBe(false);
    expect(isPublished(undefined)).toBe(false);
    expect(isPublished(null)).toBe(false);
  });
});

describe("complete record", () => {
  it("renders the published value verbatim on every surface", () => {
    expect(stipendText(complete.pay)).toBe("$1,500 – $3,000");
    expect(windowText(complete.window)).toBe("Term opens Sep");
    expect(reachText(complete.orgs)).toBe("47 host projects");
    expect(stipendMeta(complete.pay, complete.payNote)).toBe("$1,500 – $3,000 (per term)");
  });
});

describe("partial record", () => {
  it("shows the fallback instead of a zero, blank or guess", () => {
    for (const got of [
      stipendText(partial.pay),
      windowText(partial.window),
      reachText(partial.orgs),
      eligibilityText(partial.tag === "" ? "" : undefined),
    ]) {
      expect(got).toBe(NOT_PUBLISHED);
      expect(got).not.toBe("$0");
      expect(got.trim()).not.toBe("");
    }
  });

  it("drops the unit rather than leaving an empty parenthesis on the detail row", () => {
    expect(stipendMeta(complete.pay, undefined)).toBe("$1,500 – $3,000");
    expect(stipendMeta(complete.pay, "")).toBe("$1,500 – $3,000");
    expect(stipendMeta(undefined, "PER TERM")).toBe(NOT_PUBLISHED);
  });

  it("contributes nothing to the SEO description when pay is absent", () => {
    expect(stipendPhrase(partial.pay, partial.payNote)).toBe("");
  });
});

describe("the card and the detail page agree on the wording", () => {
  it("every gap surfaces the exact same string on both surfaces", () => {
    const cardStipend = stipendText(undefined);
    const detailStipend = stipendMeta(undefined, undefined);
    const cardWindow = windowText(undefined);
    const detailWindow = windowText(undefined);
    const detailEligibility = eligibilityText(undefined);
    expect(new Set([cardStipend, detailStipend, cardWindow, detailWindow, detailEligibility]))
      .toEqual(new Set([NOT_PUBLISHED]));
  });

  it("fieldText exposes the not-applicable wording for a source that states none", () => {
    expect(fieldText(undefined, NOT_AVAILABLE)).toBe(NOT_AVAILABLE);
    expect(NOT_AVAILABLE).not.toBe(NOT_PUBLISHED);
  });
});

describe("stipendPhrase mirrors the old published behaviour", () => {
  it("pairs a dollar figure with its unit and leaves prose alone", () => {
    expect(stipendPhrase("$8,000 USD", "PER INTERNSHIP")).toBe("$8,000 USD per internship");
    expect(stipendPhrase("Badge + tree", "GIFT TO MAINTAINERS")).toBe("Badge + tree");
    expect(stipendPhrase("€500 – €1,200", "PER PROJECT")).toBe("€500 – €1,200");
  });
});

describe("against the shipped catalog", () => {
  it("renders every real program's fields as published, never a fallback", () => {
    for (const p of PROGRAMS) {
      expect(stipendText(p.pay)).toBe(p.pay?.trim());
      expect(windowText(p.window)).toBe(p.window?.trim());
    }
  });

  it("keeps each program's eligibility attached to its own record", () => {
    for (const p of PROGRAMS) {
      const d = PROGRAM_DETAILS[p.id];
      if (!d) continue;
      const shown = eligibilityText(d.eligibility);
      if (isPublished(d.eligibility)) {
        expect(shown).toBe(d.eligibility!.trim());
        expect(shown).not.toBe(NOT_PUBLISHED);
      }
    }
  });
});
