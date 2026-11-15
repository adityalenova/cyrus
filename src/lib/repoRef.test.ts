/* ══ repoRef.test.ts — one repository, every spelling it arrives in ══ */
import { describe, expect, it } from "vitest";
import { isSameRepo, parseRepoRef, repoId, repoUrl } from "./repoRef";

/* One repository, every spelling the catalog and the analyser actually meet.
   The point of the table is that all of these arrive as the same id: a crawler
   row keyed "acme/widget" and an analyser paste of the SSH remote have to be
   one record, not two.                                          ═ */
const WIDGET = [
  "acme/widget",
  "Acme/Widget",
  "acme/widget.git",
  "acme/widget/",
  "https://github.com/acme/widget",
  "https://github.com/Acme/Widget.git",
  "http://github.com/acme/widget",
  "https://www.github.com/acme/widget",
  "//github.com/acme/widget",
  "git@github.com:acme/widget.git",
  "ssh://git@github.com/acme/widget.git",
  "git://github.com/acme/widget",
  "https://github.com/acme/widget/",
  "https://github.com/acme/widget/tree/main/src/lib/app.ts",
  "https://github.com/acme/widget/blob/v1.2.3/README.md",
  "https://github.com/acme/widget/issues/144",
  "https://github.com/acme/widget/pulls?q=is%3Aopen",
  "https://github.com/acme/widget?utm_source=share#readme",
  "  https://github.com/acme/widget  ",
];

describe("parseRepoRef", () => {
  it("collapses every supported spelling onto one owner/repo identity", () => {
    for (const input of WIDGET) expect(parseRepoRef(input)?.id).toBe("acme/widget");
  });

  it("keeps the spelling it was given for display and the input for provenance", () => {
    const ref = parseRepoRef("git@github.com:Acme/Widget.git");
    expect(ref).toEqual({ owner: "Acme", repo: "Widget", id: "acme/widget", source: "git@github.com:Acme/Widget.git" });
  });

  it("names the two segments separately so a caller need not resplit", () => {
    const ref = parseRepoRef("https://github.com/KDE/latte-dock");
    expect([ref?.owner, ref?.repo]).toEqual(["KDE", "latte-dock"]);
  });

  it("reads dots and dashes in a name as part of the name", () => {
    expect(repoId("https://github.com/foo-bar/baz.qux-x")).toBe("foo-bar/baz.qux-x");
  });
});

describe("rejections", () => {
  /* Malformed input must return null rather than throw: the crawl loops over
     thousands of rows and a page renders whatever a user pasted. */
  const BAD = [
    "",
    "   ",
    "acme",
    "/acme/widget",
    "acme//widget",
    "acme/wid get",
    "https://gitlab.com/acme/widget",
    "https://github.example.com/acme/widget",
    "https://notgithub.com/acme/widget",
    "git@gitlab.com:acme/widget.git",
    "https://github.com",
    "https://github.com/acme",
    "https://github.com/topics/rust",
    "https://github.com/sponsors/acme",
    "https://github.com/settings/hooks",
    "not a url at all",
    "acme/-widget",
    "acme/widget^bad",
  ];

  for (const [i, input] of BAD.entries()) {
    it(`rejects entry ${i}: ${JSON.stringify(input)} without throwing`, () => {
      expect(() => parseRepoRef(input)).not.toThrow();
      expect(parseRepoRef(input)).toBeNull();
    });
  }

  it("rejects the non-string values a crawler can hand over", () => {
    for (const input of [null, undefined, 0, {}, [], true]) expect(repoId(input)).toBeNull();
  });
});

describe("isSameRepo", () => {
  it("matches two different spellings of one repository", () => {
    expect(isSameRepo("git@github.com:Acme/Widget.git", "https://github.com/acme/widget/issues/3")).toBe(true);
    expect(isSameRepo("acme/widget", "acme/other")).toBe(false);
    expect(isSameRepo("acme/widget", "https://gitlab.com/acme/widget")).toBe(false);
  });

  it("never calls two malformed inputs equal", () => {
    expect(isSameRepo("acme", "acme")).toBe(false);
  });
});

describe("repoUrl", () => {
  it("renders one href regardless of the input form", () => {
    for (const input of WIDGET) expect(repoUrl(input)).toBe("https://github.com/acme/widget");
    expect(repoUrl("https://gitlab.com/acme/widget")).toBeNull();
  });
});

/* The two migrated call sites fed different shapes to two different regexes.
   Both now go through this file, so the fixtures each site actually passes have
   to resolve the same way: the analyser gets a paste, the archive builder gets
   a URL, a bare key, or an owner_repo field from a program board. */
describe("call-site fixtures", () => {
  it("resolves what the repo analyser receives pasted", () => {
    expect(repoId("https://github.com/srbhr/Resume-Matcher")).toBe("srbhr/resume-matcher");
    expect(repoId("srbhr/Resume-Matcher")).toBe("srbhr/resume-matcher");
    expect(repoId("srbhr/Resume-Matcher/")).toBe("srbhr/resume-matcher");
    expect(repoId("srbhr")).toBeNull();
  });

  it("resolves the three field shapes the program archive reads", () => {
    expect(repoId("https://github.com/beagleboard/bb.org-overlays")).toBe("beagleboard/bb.org-overlays");
    expect(repoId("beagleboard/bb.org-overlays")).toBe("beagleboard/bb.org-overlays");
    expect(repoId("https://github.com/beagleboard/BeagleBoard-DeviceTrees/tree/master")).toBe("beagleboard/beagleboard-devicetrees");
  });

  it("does not invent an identity out of an owner and a project title", () => {
    expect(repoId("Google/Animate the periodic table")).toBeNull();
  });
});
