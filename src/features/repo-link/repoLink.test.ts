import { describe, expect, it } from "vitest";
import { normalizeRepoUrl, repoKey } from "../../lib/repoLink";

/* input, owner, name, key, url - the spelling kept, the identity derived */
const ACCEPTED: Array<[string, string, string, string, string]> = [
  // the bare form people type
  ["owner/name", "owner", "name", "owner/name", "https://github.com/owner/name"],
  ["Owner/Name", "Owner", "Name", "owner/name", "https://github.com/Owner/Name"],
  ["a/b", "a", "b", "a/b", "https://github.com/a/b"],
  ["owner/.github", "owner", ".github", "owner/.github", "https://github.com/owner/.github"],
  ["owner/n_ame-1.0", "owner", "n_ame-1.0", "owner/n_ame-1.0", "https://github.com/owner/n_ame-1.0"],
  // an optional .git suffix and trailing slashes
  ["owner/name.git", "owner", "name", "owner/name", "https://github.com/owner/name"],
  ["owner/name/", "owner", "name", "owner/name", "https://github.com/owner/name"],
  ["owner/name.git/", "owner", "name", "owner/name", "https://github.com/owner/name"],
  // http(s) URLs, with and without www, in either scheme case
  ["https://github.com/owner/name", "owner", "name", "owner/name", "https://github.com/owner/name"],
  ["http://github.com/owner/name.git", "owner", "name", "owner/name", "https://github.com/owner/name"],
  ["https://www.github.com/Owner/Name/", "Owner", "Name", "owner/name", "https://github.com/Owner/Name"],
  ["HTTPS://GITHUB.COM/owner/name", "owner", "name", "owner/name", "https://github.com/owner/name"],
  // protocol-relative, and the schemeless host people copy out of a browser
  ["//github.com/owner/name", "owner", "name", "owner/name", "https://github.com/owner/name"],
  ["github.com/owner/name", "owner", "name", "owner/name", "https://github.com/owner/name"],
  ["www.github.com/owner/name/", "owner", "name", "owner/name", "https://github.com/owner/name"],
  // git remotes
  ["git@github.com:owner/name.git", "owner", "name", "owner/name", "https://github.com/owner/name"],
  ["git@github.com:owner/name", "owner", "name", "owner/name", "https://github.com/owner/name"],
  ["git@github.com:owner/name/", "owner", "name", "owner/name", "https://github.com/owner/name"],
  ["ssh://git@github.com/owner/name.git", "owner", "name", "owner/name", "https://github.com/owner/name"],
  ["ssh://git@www.github.com/Owner/Name", "Owner", "Name", "owner/name", "https://github.com/Owner/Name"],
];

const REJECTED = [
  // nothing to read
  "",
  "   ",
  // a path that is not exactly owner/name
  "owner",
  "owner/",
  "/owner/name",
  "owner//name",
  "owner/name/extra",
  "https://github.com/owner",
  "https://github.com/",
  "https://github.com/owner/",
  "https://github.com/owner/name.git/extra",
  // deep links name something inside a repository, not a repository
  "https://github.com/owner/name/issues/1",
  "https://github.com/owner/name/pull/7",
  "https://github.com/owner/name/pulls?q=is%3Apr",
  "https://github.com/owner/name/tree/main",
  "https://github.com/owner/name/blob/main/README.md",
  "git@github.com:owner/name/issues/1",
  // query, fragment, encoding, dot segments, backslashes
  "https://github.com/owner/name?tab=readme-ov-file",
  "https://github.com/owner/name#readme",
  "https://github.com/owner/name%2f..%2fevil",
  "https://github.com/owner/name/../other",
  "owner/na\\me",
  // other hosts, and hosts that only look like GitHub
  "https://gitlab.com/owner/name",
  "https://bitbucket.org/owner/name",
  "https://github.com.evil.io/owner/name",
  "https://notgithub.com/owner/name",
  "https://gіthub.com/owner/name",
  "git@github.com.evil.io:owner/name.git",
  "https://github.com/owner/name@evil.io",
  // site pages that sit where an owner would
  "https://github.com/topics/rust",
  "https://github.com/orgs/nodejs/teams",
  "https://github.com/features/copilot",
  // userinfo, ports and other schemes
  "https://github.com@evil.io/owner/name",
  "https://evil.io@github.com/owner/name",
  "https://github.com:8443/owner/name",
  "ssh://evil@github.com/owner/name",
  "ssh://git:secret@github.com/owner/name",
  "user@github.com:owner/name",
  "ftp://github.com/owner/name",
  "https:////github.com/owner/name",
  "javascript:alert(1)",
  "javascript://github.com/owner/name",
  "data:text/html,<script>alert(1)</script>",
  // characters GitHub does not put in an owner or repository name
  "owner/na\u200Bme",
  "owner/å",
  "owner/name with space",
  "owner/na\tme",
  "-owner/name",
];

describe("normalizeRepoUrl", () => {
  it.each(ACCEPTED)("reads %s as %s/%s", (input, owner, name, key, url) => {
    expect(normalizeRepoUrl(input)).toEqual({ owner, name, key, url });
  });

  it("converges every spelling of one repository on one key", () => {
    const spellings = [
      "Owner/Name",
      "owner/name.git",
      "https://github.com/Owner/Name/",
      "http://www.github.com/owner/name",
      "//github.com/Owner/Name",
      "git@github.com:owner/name.git",
      "ssh://git@github.com/Owner/Name",
    ];
    expect(new Set(spellings.map((s) => repoKey(s)))).toEqual(new Set(["owner/name"]));
  });

  it.each(REJECTED)("rejects %s", (input) => {
    expect(normalizeRepoUrl(input)).toBeNull();
  });

  it("rejects non-string input without throwing", () => {
    const values: unknown[] = [null, undefined, 42, true, {}, [], Symbol("repo"), () => "owner/name"];
    for (const value of values) {
      expect(normalizeRepoUrl(value as string)).toBeNull();
    }
  });

  it("does not throw on any rejected or hostile string", () => {
    for (const input of REJECTED) {
      expect(() => normalizeRepoUrl(input)).not.toThrow();
      expect(() => repoKey(input)).not.toThrow();
    }
  });
});

describe("repoKey", () => {
  it.each(ACCEPTED)("keys %s as %s/%s", (input, _owner, _name, key) => {
    expect(repoKey(input)).toBe(key);
  });

  it.each(REJECTED)("has no key for %s", (input) => {
    expect(repoKey(input)).toBeNull();
  });

  it("lowercases only the key, never the spelling it reports", () => {
    expect(normalizeRepoUrl("GitHub/Repo")).toEqual({
      owner: "GitHub",
      name: "Repo",
      key: "github/repo",
      url: "https://github.com/GitHub/Repo",
    });
  });
});
