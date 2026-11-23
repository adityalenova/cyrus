/* ══ scripts/promote-snapshot.test.mjs — the gate, exercised on temp dirs ══
   node --test scripts/

   Nothing here reads or writes public/data. Each test builds its own staging
   and target directories under the OS temp dir, so a failure in these tests
   can never leave the served snapshot half-promoted.
   ════════════════════════════════════════════════════════════════════════ */
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import * as nodeFs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import {
  planPromotion,
  promote,
  requiredDatasets,
  SNAPSHOT_META,
  SnapshotError,
  validateDataset,
} from "./lib/snapshot.mjs";

const roots = [];
async function workspace() {
  const dir = await mkdtemp(join(tmpdir(), "cyrus-snapshot-"));
  roots.push(dir);
  return dir;
}
after(async () => {
  for (const dir of roots) await rm(dir, { recursive: true, force: true });
});

const gsocRows = (n) => Array.from({ length: n }, (_, i) => ({ y: 2026, t: `Project ${i}`, o: "Org" }));

const valid = () => ({
  "gsoc-projects.json": { projects: gsocRows(5000), orgs: { Org: { url: "", category: "" } } },
  "otherProjects.json": {
    projects: [
      { y: 2024, t: "LFX project", o: "Org", program: "LFX" },
      { y: 2024, t: "Outreachy internship", o: "Org", program: "Outreachy" },
      { y: 2024, t: "SoB project", o: "Org", program: "Summer of Bitcoin" },
    ],
  },
  "program-roster.json": {
    generated: "2026-01-01",
    totals: { programs: 1 },
    programs: { gsoc: { label: "Google Summer of Code", projects: 5000, orgs: 1 } },
  },
  "mentor-index.json": {
    generated: "2026-01-01",
    programs: { gsoc: { label: "Google Summer of Code", mentors: 42 } },
  },
});

async function stage(dir, overrides = {}) {
  const staging = join(dir, "staging");
  await mkdir(staging, { recursive: true });
  const data = { ...valid(), ...overrides };
  for (const [name, value] of Object.entries(data)) {
    const text = typeof value === "string" ? value : JSON.stringify(value);
    await writeFile(join(staging, name), text);
  }
  return staging;
}

async function serve(dir, overrides = {}) {
  const target = join(dir, "target");
  await mkdir(target, { recursive: true });
  const data = { ...valid(), ...overrides };
  for (const [name, value] of Object.entries(data)) {
    await writeFile(join(target, name), `OLD ${name} ${typeof value === "string" ? "" : JSON.stringify(value).length}`);
  }
  return target;
}

async function snapshotFiles(dir) {
  const out = {};
  for (const name of [...(await readdir(dir))].sort()) {
    const s = await stat(join(dir, name));
    if (s.isFile()) out[name] = await readFile(join(dir, name), "utf8");
  }
  return out;
}

const NOW = () => new Date("2026-11-22T10:00:00.000Z");

describe("requiredDatasets", () => {
  it("names the four catalog datasets a snapshot consists of", () => {
    assert.deepEqual(
      requiredDatasets().map((d) => d.name),
      ["gsoc-projects.json", "otherProjects.json", "program-roster.json", "mentor-index.json"],
    );
  });

  it("takes its minimum from the builder that writes each dataset", () => {
    const byName = Object.fromEntries(requiredDatasets().map((d) => [d.name, d]));
    assert.equal(byName["gsoc-projects.json"].minRows, 5000);
    assert.match(byName["gsoc-projects.json"].threshold, /refresh\.mjs/);
    assert.equal(byName["otherProjects.json"].minRows, 3);
    assert.match(byName["otherProjects.json"].threshold, /build-program-roster\.mjs/);
    assert.equal(byName["program-roster.json"].minRows, 1);
    assert.equal(byName["mentor-index.json"].minRows, 1);
    for (const spec of requiredDatasets()) assert.ok(spec.source.trim().length > 0, `${spec.name} must name a source`);
  });
});

describe("validateDataset", () => {
  it("accepts every dataset and reports its row count", () => {
    for (const [name, value] of Object.entries(valid())) {
      const checked = validateDataset(name, JSON.stringify(value));
      assert.equal(checked.name, name);
      assert.ok(checked.rows > 0);
      assert.ok(checked.source.length > 0);
    }
    assert.equal(validateDataset("gsoc-projects.json", valid()["gsoc-projects.json"]).rows, 5000);
    assert.equal(validateDataset("program-roster.json", valid()["program-roster.json"]).rows, 1);
  });

  it("names the dataset and the problem when the bytes are not JSON", () => {
    assert.throws(
      () => validateDataset("gsoc-projects.json", "{ not json"),
      (err) => err instanceof SnapshotError && err.dataset === "gsoc-projects.json" && /does not parse as JSON/.test(err.message),
    );
  });

  it("rejects the wrong top-level shape", () => {
    assert.throws(() => validateDataset("gsoc-projects.json", []), /top level must be a JSON object/);
    assert.throws(
      () => validateDataset("gsoc-projects.json", { projects: [] }),
      /missing top-level key orgs/,
    );
    assert.throws(
      () => validateDataset("program-roster.json", { programs: {}, totals: { programs: 0 } }),
      /carries no rows/,
    );
    assert.throws(
      () => validateDataset("mentor-index.json", { programs: { gsoc: { label: "GSoC" } } }),
      /mentors must be a non-negative number/,
    );
    assert.throws(
      () => validateDataset("program-roster.json", { programs: { gsoc: { label: "GSoC" } }, totals: { programs: 2 } }),
      /totals\.programs \(2\) disagrees/,
    );
  });

  it("rejects a dataset below the minimum the builder enforces", () => {
    const small = { projects: gsocRows(4999), orgs: {} };
    assert.throws(
      () => validateDataset("gsoc-projects.json", small),
      (err) => /carries 4999 rows, below the minimum of 5000/.test(err.message)
        && /refresh\.mjs/.test(err.message),
    );
  });

  it("rejects a dataset with no rows at all", () => {
    assert.throws(
      () => validateDataset("otherProjects.json", { projects: [] }),
      /carries no rows/,
    );
  });

  it("refuses an unknown dataset instead of waving it through", () => {
    assert.throws(() => validateDataset("unknown.json", {}), /unknown dataset/);
  });
});

describe("planPromotion", () => {
  it("backs up what exists first, then moves every dataset and the metadata", () => {
    const staging = join(tmpdir(), "plan-staging");
    const target = join(tmpdir(), "plan-target");
    const plan = planPromotion({
      stagingDir: staging,
      targetDir: target,
      present: ["gsoc-projects.json", "mentor-index.json"],
      withMeta: true,
    });

    assert.equal(plan.metadataPath, join(target, SNAPSHOT_META));
    const ops = plan.steps.map((s) => `${s.op}:${s.name}`);
    assert.deepEqual(ops, [
      "backup:gsoc-projects.json",
      "backup:mentor-index.json",
      "backup:" + SNAPSHOT_META,
      "promote:gsoc-projects.json",
      "promote:otherProjects.json",
      "promote:program-roster.json",
      "promote:mentor-index.json",
      "promote:" + SNAPSHOT_META,
    ]);
    for (const step of plan.steps) {
      if (step.op === "backup") {
        assert.ok(step.from.startsWith(target), `${step.name} must be read from the target`);
        assert.ok(step.to.startsWith(plan.backupDir), `${step.name} must be parked in the backup`);
      } else {
        assert.ok(step.from.startsWith(staging), `${step.name} must come from staging`);
        assert.ok(step.to.startsWith(target), `${step.name} must land in the target`);
      }
    }
  });

  it("promotes without backups into an empty target", () => {
    const plan = planPromotion({
      stagingDir: join(tmpdir(), "plan-staging"),
      targetDir: join(tmpdir(), "plan-target"),
    });
    assert.ok(plan.steps.every((s) => s.op === "promote"));
    assert.equal(plan.steps.at(-1).name, SNAPSHOT_META);
  });
});

describe("promote", () => {
  it("moves every dataset and writes one metadata file", async () => {
    const dir = await workspace();
    const staging = await stage(dir);
    const target = await serve(dir);
    const staged = await snapshotFiles(staging);

    const result = await promote({ stagingDir: staging, targetDir: target, fs: nodeFs, now: NOW });

    assert.deepEqual(result.files.sort(), Object.keys(valid()).sort());
    const served = await snapshotFiles(target);
    for (const [name, text] of Object.entries(staged)) assert.equal(served[name], text, `${name} must be promoted byte for byte`);
    assert.deepEqual(Object.keys(served).sort(), [...Object.keys(staged), SNAPSHOT_META].sort());

    const meta = JSON.parse(await readFile(join(target, SNAPSHOT_META), "utf8"));
    assert.equal(meta.promotedAt, "2026-11-22T10:00:00.000Z");
    assert.deepEqual(Object.keys(meta.datasets).sort(), Object.keys(valid()).sort());
    assert.equal(meta.datasets["gsoc-projects.json"].rows, 5000);
    assert.match(meta.datasets["gsoc-projects.json"].source, /refresh\.mjs|summerofcode/);
    assert.equal(meta.datasets["program-roster.json"].rows, 1);

    assert.equal(await exists(join(target, ".snapshot-backup")), false, "the backup must be cleaned up");
    assert.equal(await exists(join(staging, "gsoc-projects.json")), false, "staged files must move, not copy");
  });

  it("leaves the served snapshot byte-identical when one dataset fails validation", async () => {
    const dir = await workspace();
    const target = await serve(dir);
    const before = await snapshotFiles(target);

    const staging = await stage(dir, {
      "gsoc-projects.json": { projects: gsocRows(4999), orgs: {} },
    });

    await assert.rejects(
      () => promote({ stagingDir: staging, targetDir: target, fs: nodeFs, now: NOW }),
      (err) => err instanceof SnapshotError
        && err.dataset === "gsoc-projects.json"
        && /below the minimum of 5000/.test(err.message)
        && err.stagingDir === staging,
    );

    assert.deepEqual(await snapshotFiles(target), before);
    assert.equal(await exists(join(target, SNAPSHOT_META)), false, "no metadata may be written for a rejected set");
    assert.equal(await exists(join(staging, SNAPSHOT_META)), false, "validation runs before the metadata file exists");
    assert.equal(await exists(join(staging, "gsoc-projects.json")), true, "the rejected set stays in staging");
  });

  it("reports a dataset that never reached staging", async () => {
    const dir = await workspace();
    const staging = await stage(dir);
    const target = await serve(dir);
    await rm(join(staging, "mentor-index.json"));

    await assert.rejects(
      () => promote({ stagingDir: staging, targetDir: target, fs: nodeFs, now: NOW }),
      (err) => /mentor-index\.json: is missing from staging/.test(err.message)
        && err.message.includes(staging),
    );
    assert.equal(await exists(join(target, "mentor-index.json")), true);
  });

  it("rolls a partial move back and leaves the old snapshot in place", async () => {
    const dir = await workspace();
    const staging = await stage(dir);
    const target = await serve(dir);
    const before = await snapshotFiles(target);

    let moves = 0;
    const failingFs = {
      ...nodeFs,
      rename: async (from, to) => {
        moves += 1;
        /* the second dataset into the target fails, after the first landed;
           the rollback renames go the other way and must be allowed to work */
        if (from.startsWith(staging) && to === join(target, "mentor-index.json")) {
          const err = new Error("simulated disk failure");
          err.code = "EIO";
          throw err;
        }
        return nodeFs.rename(from, to);
      },
    };

    await assert.rejects(
      () => promote({ stagingDir: staging, targetDir: target, fs: failingFs, now: NOW }),
      (err) => err instanceof SnapshotError
        && err.dataset === "mentor-index.json"
        && /promotion failed while moving/.test(err.message)
        && /every file this run moved was put back/.test(err.message)
        && err.stagingDir === staging,
    );

    assert.ok(moves > 0);
    assert.deepEqual(await snapshotFiles(target), before, "the served snapshot must be restored, not left half-new");
    assert.equal(await exists(join(target, SNAPSHOT_META)), false);
  });

  it("keeps the staging path on the error so a caller can point at it", async () => {
    const dir = await workspace();
    const staging = await stage(dir);
    const target = await serve(dir);

    await assert.rejects(
      () => promote({ stagingDir: join(dir, "does-not-exist"), targetDir: target, fs: nodeFs, now: NOW }),
      (err) => err.stagingDir === join(dir, "does-not-exist") && err.dataset === "gsoc-projects.json",
    );
    assert.ok(staging);
  });
});

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
