import { describe, expect, it } from "vitest";
import { parseIssueUrl } from "./shared";

describe("parseIssueUrl", () => {
  it("parses full https GitHub issue URLs", () => {
    const res = parseIssueUrl("https://github.com/vercel/next.js/issues/123");
    expect(res).toEqual({
      url: "https://github.com/vercel/next.js/issues/123",
      repo: "vercel/next.js",
      number: 123,
    });
  });

  it("parses schemeless github.com URLs", () => {
    const res = parseIssueUrl("github.com/vercel/next.js/issues/456");
    expect(res).toEqual({
      url: "https://github.com/vercel/next.js/issues/456",
      repo: "vercel/next.js",
      number: 456,
    });
  });

  it("parses protocol-relative URLs", () => {
    const res = parseIssueUrl("//github.com/owner/repo/issues/789");
    expect(res).toEqual({
      url: "https://github.com/owner/repo/issues/789",
      repo: "owner/repo",
      number: 789,
    });
  });

  it("handles trailing slashes and whitespace", () => {
    const res = parseIssueUrl("  github.com/owner/repo/issues/99/  ");
    expect(res).toEqual({
      url: "https://github.com/owner/repo/issues/99",
      repo: "owner/repo",
      number: 99,
    });
  });

  it("rejects non-github URLs and malformed strings", () => {
    expect(parseIssueUrl("https://gitlab.com/owner/repo/issues/1")).toBeNull();
    expect(parseIssueUrl("github.com/owner/repo/pull/1")).toBeNull();
    expect(parseIssueUrl("not a url")).toBeNull();
    expect(parseIssueUrl("")).toBeNull();
  });
});
