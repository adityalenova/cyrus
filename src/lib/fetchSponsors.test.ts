/* ══ fetchSponsors.test.ts - the funding scan tells its outcomes apart ══
   "No sponsors" must never be inferred from a broken crawl: the directory
   publishes only repos whose FUNDING.yml was actually readable, and the
   refresh counts the other three results separately. The stubbed transport
   below is the point - fundingOutcome decides from (status, body, parse)
   alone, so a 404, a rate limit and a corrupt file cannot fold together. */
import { describe, expect, it } from "vitest";
import { fundingOutcome, parseFunding, tallyLine } from "../../scratch/fetch-sponsors.mjs";

const yml = (text: string) => Buffer.from(text, "utf8").toString("base64");

type Stub = number | Error | { status?: number; body?: unknown; badJson?: boolean };

/** a stand-in for the script's `get`: answers with a status, throws, or
    returns a 200 whose body (or JSON read) is whatever the case needs */
function transport(steps: Stub[]) {
  const calls: string[] = [];
  let i = 0;
  const get = async (url: string) => {
    calls.push(url);
    const s = steps[Math.min(i++, steps.length - 1)];
    if (s instanceof Error) throw s;
    const step = typeof s === "number" ? { status: s } : s;
    const status = step.status ?? 200;
    return {
      status,
      ok: status >= 200 && status < 300,
      json: async () => {
        if (step.badJson) throw new TypeError("Unexpected token");
        return step.body;
      },
    };
  };
  return { get, calls };
}

describe("fundingOutcome", () => {
  it("publishes a repo whose funding file names a platform", async () => {
    const { get, calls } = transport([{ status: 200, body: { content: yml("github: foo\ncustom: https://foo.dev\n") } }]);
    expect(await fundingOutcome("foo/bar", get)).toEqual({
      outcome: "funded",
      platforms: { github: ["foo"], custom: ["https://foo.dev"] },
    });
    expect(calls[0]).toBe("https://api.github.com/repos/foo/bar/contents/.github/FUNDING.yml");
  });

  it("counts a missing funding file as absent, not as a failure", async () => {
    const { get } = transport([404]);
    expect(await fundingOutcome("foo/bar", get)).toEqual({ outcome: "absent" });
    expect(await fundingOutcome("foo/bar", async () => null)).toEqual({ outcome: "absent" });
  });

  it("counts a rate-limited or errored fetch as failed", async () => {
    for (const status of [403, 429, 502]) {
      const { get } = transport([status]);
      expect(await fundingOutcome("foo/bar", get)).toEqual({ outcome: "failed" });
    }
    const { get } = transport([new TypeError("fetch failed")]);
    expect(await fundingOutcome("foo/bar", get)).toEqual({ outcome: "failed" });
  });

  it("counts a file that arrives but cannot be read as config as unparseable", async () => {
    const cases: Stub[] = [
      { status: 200, body: {} },                       // no content field at all
      { status: 200, body: { content: yml("# only a comment\n") } }, // parses to nothing
      { status: 200, badJson: true },                  // body is not JSON
    ];
    for (const s of cases) {
      const { get } = transport([s]);
      expect(await fundingOutcome("foo/bar", get)).toEqual({ outcome: "unparseable" });
    }
  });

  it("only the funded outcome carries platforms for the published record", async () => {
    const outcomes = await Promise.all([
      fundingOutcome("a/b", transport([200]).get),
      fundingOutcome("a/b", transport([404]).get),
      fundingOutcome("a/b", transport([403]).get),
    ]);
    expect(outcomes.map((o) => o.outcome)).toEqual(["unparseable", "absent", "failed"]);
    expect(JSON.stringify(outcomes)).not.toContain("platforms");
  });
});

describe("parseFunding", () => {
  it("reads scalars, inline lists and list items", () => {
    const p: Record<string, string[]> = parseFunding(yml('github: [solo, two]\npatreon: name\nlfx_campfund:\n  - camp\n'));
    expect(p.github).toEqual(["solo", "two"]);
    expect(p.patreon).toEqual(["name"]);
    expect(p.lfx_campfund).toEqual(["camp"]);
  });
});

describe("tallyLine", () => {
  it("names the three non-published outcomes separately", () => {
    const line = tallyLine({ scanned: 260, funded: 38, absent: 200, failed: 17, unparseable: 5 });
    expect(line).toContain("38 funded repos of 260 scanned");
    expect(line).toContain("200 absent");
    expect(line).toContain("17 failed to fetch");
    expect(line).toContain("5 unparseable");
    expect(line).not.toMatch(/no sponsors/i);
  });

  it("says so plainly when a snapshot carries no breakdown", () => {
    expect(tallyLine({ scanned: 260, funded: 38 })).toContain("not recorded");
  });
});
