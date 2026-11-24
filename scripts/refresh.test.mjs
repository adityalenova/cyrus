/* ══ scripts/refresh.test.mjs — what a refresh may claim it refreshed ═══
   node --test, pointed at the .test.mjs files under scripts/
   (see the README for the exact invocation used in this repository)

   Nothing here runs a builder, fetches a URL, or writes the repository
   README: planRefresh/stampPlan/renderRefreshLine are pure, and
   updateReadmeSnapshot takes the file functions it uses.
   ═════════════════════════════════════════════════════════════════════ */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyRefreshStamp,
  DATASETS,
  parseRefreshLine,
  planRefresh,
  renderRefreshLine,
  stampPlan,
  updateReadmeSnapshot,
} from "./refresh.mjs";

const DATE = "2026-11-22";
const ids = (plan) => plan.datasets.map((d) => d.id);

describe("planRefresh", () => {
  it("runs only the GSoC archive for the existing `gsoc` flag", () => {
    const plan = planRefresh("gsoc");
    assert.equal(plan.ok, true);
    assert.deepEqual(ids(plan), ["gsoc"]);
    assert.equal(plan.datasets[0].skip, null);
  });

  it("makes `all` every credential-free builder, and no crawl", () => {
    // GH_TOKEN unset is the point: no step in `all` may need a credential
    const plan = planRefresh("all", { env: {}, hasCrawlInput: true });
    assert.deepEqual(ids(plan), ["gsoc", "issues", "roster", "mentors"]);
    assert.ok(plan.datasets.every((d) => d.skip === null), "with crawl input on disk nothing is skipped");
  });

  it("accepts one dataset by name", () => {
    for (const id of ["issues", "roster", "mentors"]) {
      const plan = planRefresh(id);
      assert.deepEqual(ids(plan), [id]);
    }
    assert.deepEqual(ids(planRefresh("mentors")), ["mentors"]);
  });

  it("is case-insensitive and falls back to `all`", () => {
    assert.deepEqual(ids(planRefresh("ALL")), ["gsoc", "issues", "roster", "mentors"]);
    assert.deepEqual(ids(planRefresh(undefined)), ["gsoc", "issues", "roster", "mentors"]);
  });

  it("refuses an unknown flag instead of silently doing nothing", () => {
    const plan = planRefresh("everything");
    assert.equal(plan.ok, false);
    assert.equal(plan.usage, true);
    assert.deepEqual(plan.datasets, []);
  });

  it("names GH_TOKEN when the crawl input is missing and the variable is unset", () => {
    const plan = planRefresh("issues", { env: {}, hasCrawlInput: false });
    const step = plan.datasets[0];
    assert.match(step.skip, /data\/crawl\/issues\.jsonl/);
    assert.match(step.skip, /GH_TOKEN is not set/);
    assert.match(step.skip, /crawl-github\.mjs/);
  });

  it("points at the crawl script, not the variable, when GH_TOKEN is set", () => {
    const plan = planRefresh("all", { env: { GH_TOKEN: "ghp_example" }, hasCrawlInput: false });
    const issueStep = plan.datasets.find((d) => d.id === "issues");
    assert.match(issueStep.skip, /scripts\/crawl-github\.mjs --phase issues/);
    assert.match(issueStep.skip, /GH_TOKEN is set/);
    assert.equal(plan.datasets.find((d) => d.id === "roster").skip, null);
  });

  it("does not skip the issue snapshot when its input is on disk", () => {
    const plan = planRefresh("issues", { env: {}, hasCrawlInput: true });
    assert.equal(plan.datasets[0].skip, null);
  });
});

describe("stampPlan", () => {
  const previous = {
    gsoc: "2026-10-25",
    issues: "2026-10-21",
    roster: "2026-10-25",
    mentors: "2026-10-25",
  };

  it("stamps only what the `gsoc` run rebuilt and carries the rest forward", () => {
    const plan = stampPlan({
      results: [
        { id: "gsoc", status: "rebuilt" },
        { id: "issues", status: "skipped", reason: "GH_TOKEN is not set" },
        { id: "roster", status: "skipped", reason: "not requested" },
        { id: "mentors", status: "skipped", reason: "not requested" },
      ],
      previous,
      date: DATE,
    });
    assert.equal(plan.write, true);
    assert.deepEqual(plan.rebuilt, ["gsoc"]);
    assert.deepEqual(plan.dates, { ...previous, gsoc: DATE });
  });

  it("stamps all four when `all` rebuilt all four", () => {
    const plan = stampPlan({
      results: DATASETS.map((d) => ({ id: d.id, status: "rebuilt" })),
      previous: {},
      date: DATE,
    });
    assert.equal(plan.write, true);
    assert.deepEqual(plan.dates, { gsoc: DATE, issues: DATE, roster: DATE, mentors: DATE });
    assert.equal(plan.rebuilt.length, 4);
  });

  it("stamps one dataset when one dataset was asked for", () => {
    const plan = stampPlan({ results: [{ id: "roster", status: "rebuilt" }], previous, date: DATE });
    assert.equal(plan.write, true);
    assert.deepEqual(plan.dates, { ...previous, roster: DATE });
    assert.deepEqual(plan.rebuilt, ["roster"]);
  });

  it("writes nothing when a builder failed", () => {
    const plan = stampPlan({
      results: [
        { id: "gsoc", status: "rebuilt" },
        { id: "roster", status: "failed", code: 1 },
      ],
      previous,
      date: DATE,
    });
    assert.equal(plan.write, false);
    assert.match(plan.reason, /roster failed/);
    assert.deepEqual(plan.dates, previous, "a failed run must not move any date");
  });

  it("writes nothing when every requested dataset was skipped", () => {
    const plan = stampPlan({
      results: [{ id: "issues", status: "skipped", reason: "GH_TOKEN is not set" }],
      previous,
      date: DATE,
    });
    assert.equal(plan.write, false);
    assert.match(plan.reason, /no dataset was rebuilt/);
    assert.deepEqual(plan.dates, previous);
  });
});

describe("renderRefreshLine", () => {
  it("keeps a date for every dataset in a full run", () => {
    const line = renderRefreshLine({ gsoc: DATE, issues: DATE, roster: DATE, mentors: DATE });
    for (const dataset of DATASETS) {
      assert.match(line, new RegExp(`${dataset.label} ${DATE}`));
    }
    assert.match(line, /dataset rebuild/i);
  });

  it("lists only the datasets that have a date, with that date", () => {
    const line = renderRefreshLine({ roster: "2026-10-25", gsoc: DATE });
    assert.match(line, new RegExp(`GSoC archive ${DATE}`));
    assert.match(line, /program roster 2026-10-25/);
    assert.doesNotMatch(line, /mentor index/);
    assert.doesNotMatch(line, /issue snapshot/);
  });

  it("refuses to render an empty line instead of dropping the date", () => {
    assert.throws(() => renderRefreshLine({}), /no dated dataset/);
  });
});

describe("README stamp", () => {
  const readme = [
    "# project",
    "",
    "<!--refresh:datasets-->",
    "**Dataset rebuild** - GSoC archive 2026-10-25; issue snapshot 2026-10-21; program roster 2026-10-25; mentor index 2026-10-25. Each date is the day that dataset was last rebuilt by `npm run refresh`.",
    "<!--/refresh:datasets-->",
    "",
    "body",
  ].join("\n");

  it("reads the dates already recorded per dataset", () => {
    assert.deepEqual(parseRefreshLine(readme), {
      gsoc: "2026-10-25",
      issues: "2026-10-21",
      roster: "2026-10-25",
      mentors: "2026-10-25",
    });
  });

  it("replaces the block in place and is idempotent", () => {
    const once = applyRefreshStamp(readme, { gsoc: DATE, roster: DATE });
    assert.match(once, /^# project/);
    assert.match(once, /body$/);
    assert.equal(applyRefreshStamp(once, { gsoc: DATE, roster: DATE }), once);
    assert.deepEqual(parseRefreshLine(once), { gsoc: DATE, roster: DATE });
    assert.equal(once.match(/<!--refresh:datasets-->/g).length, 1);
  });

  it("fails loudly when the markers are gone", () => {
    assert.throws(() => applyRefreshStamp("# no markers here", { gsoc: DATE }), /Cannot find the dataset rebuild markers/);
  });

  it("writes the README only for datasets this run rebuilt", () => {
    let written = null;
    const result = updateReadmeSnapshot("/repo", {
      results: [
        { id: "gsoc", status: "rebuilt" },
        { id: "issues", status: "skipped" },
        { id: "roster", status: "skipped" },
        { id: "mentors", status: "skipped" },
      ],
      date: DATE,
      readFile: () => readme,
      writeFile: (_path, text) => { written = text; },
    });
    assert.equal(result.written, true);
    assert.deepEqual(result.rebuilt, ["gsoc"]);
    assert.deepEqual(parseRefreshLine(written), {
      gsoc: DATE,
      issues: "2026-10-21",
      roster: "2026-10-25",
      mentors: "2026-10-25",
    });
    assert.match(written, /GSoC archive 2026-11-22/);
    assert.doesNotMatch(written, /program roster 2026-11-22/);
  });

  it("writes nothing when a builder failed", () => {
    let writes = 0;
    const result = updateReadmeSnapshot("/repo", {
      results: [
        { id: "roster", status: "rebuilt" },
        { id: "mentors", status: "failed", code: 1 },
      ],
      date: DATE,
      readFile: () => readme,
      writeFile: () => { writes += 1; },
    });
    assert.equal(result.written, false);
    assert.equal(writes, 0);
    assert.match(result.reason, /mentors failed/);
  });

  it("writes nothing when nothing was rebuilt", () => {
    const result = updateReadmeSnapshot("/repo", {
      results: [{ id: "issues", status: "skipped", reason: "GH_TOKEN is not set" }],
      date: DATE,
      readFile: () => readme,
      writeFile: () => { throw new Error("must not write"); },
    });
    assert.equal(result.written, false);
    assert.match(result.reason, /no dataset was rebuilt/);
  });
});
