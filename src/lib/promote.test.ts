import { afterEach, describe, expect, it } from "vitest";
import { dirname, join } from "node:path";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, existsSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import {
  openStaging, promoteSnapshot, readManifest, validateSnapshot, formatPromotion,
} from "../../scripts/lib/promote.mjs";

/* The whole point of promotion is what the live directory looks like after a
   run that failed, so these tests write real files in a real temp directory and
   read them back. The only fake is the filesystem call that fails mid-swap. */
const STAMP = "2026-11-14";
const dirs: string[] = [];

function sandbox() {
  const root = mkdtempSync(join(tmpdir(), "cyrus-promote-"));
  dirs.push(root);
  const dataDir = join(root, "data");
  mkdirSync(dataDir, { recursive: true });
  const staging = (name = "program-projects", stamp = STAMP) => openStaging({ dataDir, name, stamp });
  const put = (s: any, rel: string, body: unknown) =>
    writeFileSync(s.stage(rel), typeof body === "string" ? body : JSON.stringify(body, null, 1));
  const live = (rel: string) => join(dataDir, rel);
  const seed = (rel: string, body: unknown) => {
    mkdirSync(dirname(live(rel)), { recursive: true });
    writeFileSync(live(rel), typeof body === "string" ? body : JSON.stringify(body));
  };
  const readLive = (rel: string) => JSON.parse(readFileSync(live(rel), "utf8"));
  return { root, dataDir, staging, put, live, seed, readLive };
}

afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

type Io = Record<string, (...args: any[]) => any>;

/** an io that lets the nth rename through the promotion swap throw, so a test
    can put the failure in the middle of the swap rather than before it */
function breakRename(st: any, at: number, message: string): Io {
  const io: Io = st.io;
  let n = 0;
  return {
    ...io,
    renameSync: (from: string, to: string) => {
      n += 1;
      if (n === at) throw new Error(message);
      return io.renameSync(from, to);
    },
  };
}

describe("staging", () => {
  it("puts a run's output under a directory nobody reads from", () => {
    const s = sandbox();
    const st = s.staging();
    expect(st.dir).toBe(join(s.dataDir, ".staging", `program-projects-${STAMP}`));
    expect(st.file("program-projects/gsoc.json")).toBe(join(st.dir, "program-projects/gsoc.json"));
    expect(st.live("program-projects/gsoc.json")).toBe(join(s.dataDir, "program-projects/gsoc.json"));
  });

  it("versions the directory by stamp so a re-run does not clobber the last one", () => {
    const s = sandbox();
    const a = s.staging("program-projects", "2026-11-13");
    const b = s.staging("program-projects", STAMP);
    expect(a.dir).not.toBe(b.dir);
    s.put(a, "program-projects.json", { generated: "2026-11-13" });
    s.put(b, "program-projects.json", { generated: STAMP });
    expect(JSON.parse(readFileSync(join(a.dir, "program-projects.json"), "utf8")).generated).toBe("2026-11-13");
  });

  it("makes the parent directories a nested dataset needs", () => {
    const s = sandbox();
    const st = s.staging();
    const p = st.stage("program-projects/deep/nsoc.json");
    expect(() => writeFileSync(p, "{}")).not.toThrow();
  });

  it("refuses to open a staging directory it cannot version", () => {
    const s = sandbox();
    expect(() => openStaging({ dataDir: s.dataDir, name: "", stamp: STAMP })).toThrow(/name/);
    expect(() => openStaging({ dataDir: s.dataDir, name: "x", stamp: "" })).toThrow(/stamp/);
  });
});

describe("validation", () => {
  it("names a required dataset this run never wrote", () => {
    const s = sandbox();
    const st = s.staging();
    s.put(st, "program-projects.json", { programs: {} });
    const v = validateSnapshot({ staging: st, files: ["program-projects.json", "program-projects/gsoc.json"] });
    expect(v.ok).toBe(false);
    expect(v.problems).toEqual([{ file: "program-projects/gsoc.json", problem: "this run wrote no such file" }]);
    expect(v.checked).toEqual(["program-projects.json"]);
  });

  it("reads an unparsable and an empty file as failures, not as absent", () => {
    const s = sandbox();
    const st = s.staging();
    s.put(st, "a.json", "{ this is not json");
    s.put(st, "b.json", "   ");
    const v = validateSnapshot({ staging: st, files: ["a.json", "b.json"] });
    expect(v.ok).toBe(false);
    expect(v.problems[0].file).toBe("a.json");
    expect(v.problems[0].problem).toContain("does not parse");
    expect(v.problems[1]).toEqual({ file: "b.json", problem: "written but empty" });
  });

  it("collects every problem the caller's contract reports for a parsed file", () => {
    const s = sandbox();
    const st = s.staging();
    s.put(st, "program-projects/gsoc.json", { program: "kde", projects: 3, list: [{ t: "a" }] });
    const v = validateSnapshot({
      staging: st,
      files: ["program-projects/gsoc.json"],
      check: (rel: string, j: any) => {
        const bad: string[] = [];
        if (j.projects !== j.list.length) bad.push(`projects ${j.projects} !== list.length ${j.list.length}`);
        if (rel.split("/").pop() !== `${j.program}.json`) bad.push(`shard says program ${j.program}`);
        return bad;
      },
    });
    expect(v.problems).toEqual([
      { file: "program-projects/gsoc.json", problem: "projects 3 !== list.length 1" },
      { file: "program-projects/gsoc.json", problem: "shard says program kde" },
    ]);
    expect(v.checked).toEqual(["program-projects/gsoc.json"]);
  });

  it("accepts a single string from the contract as one problem", () => {
    const s = sandbox();
    const st = s.staging();
    s.put(st, "x.json", { n: 0 });
    const v = validateSnapshot({ staging: st, files: ["x.json"], check: () => "degraded: no rows" });
    expect(v.ok).toBe(false);
    expect(v.problems).toEqual([{ file: "x.json", problem: "degraded: no rows" }]);
  });
});

describe("promotion", () => {
  it("swaps every dataset so the index and its shards arrive together", () => {
    const s = sandbox();
    s.seed("program-projects.json", { generated: "2026-11-01", programs: { gsoc: { projects: 1 } } });
    s.seed("program-projects/gsoc.json", { program: "gsoc", projects: 1, list: [{ t: "old" }] });
    const st = s.staging();
    s.put(st, "program-projects.json", { generated: STAMP, programs: { gsoc: { projects: 2 } } });
    s.put(st, "program-projects/gsoc.json", { program: "gsoc", projects: 2, list: [{ t: "new" }, { t: "other" }] });

    const r = promoteSnapshot({ staging: st, files: ["program-projects.json", "program-projects/gsoc.json"], now: () => `${STAMP}T06:00:00Z` });
    expect(r.ok).toBe(true);
    expect(r.promoted).toEqual(["program-projects.json", "program-projects/gsoc.json"]);
    expect(s.readLive("program-projects.json").generated).toBe(STAMP);
    expect(s.readLive("program-projects/gsoc.json").projects).toBe(2);
  });

  it("writes shared metadata that says which files belong to this snapshot", () => {
    const s = sandbox();
    const st = s.staging();
    s.put(st, "a.json", { ok: 1 });
    s.put(st, "b.json", { ok: 2 });
    const r = promoteSnapshot({
      staging: st, files: ["a.json", "b.json"], meta: { readAt: STAMP }, now: () => `${STAMP}T06:00:00Z`,
    });
    expect(r.manifestFile).toBe("program-projects-snapshot.json");
    const manifest = readManifest({ dataDir: s.dataDir, name: "program-projects" });
    expect(manifest.stamp).toBe(STAMP);
    expect(manifest.promotedAt).toBe(`${STAMP}T06:00:00Z`);
    expect(manifest.readAt).toBe(STAMP);
    expect(manifest.files.map((f: any) => f.file)).toEqual(["a.json", "b.json"]);
    expect(manifest.files.every((f: any) => f.bytes > 0)).toBe(true);
  });

  it("keeps the previous snapshot so a bad release is recoverable", () => {
    const s = sandbox();
    s.seed("a.json", { v: 1 });
    const first = s.staging("program-projects", "2026-11-13");
    s.put(first, "a.json", { v: 2 });
    promoteSnapshot({ staging: first, files: ["a.json"] });
    const second = s.staging();
    s.put(second, "a.json", { v: 3 });
    const r = promoteSnapshot({ staging: second, files: ["a.json"] });
    const kept = join(s.dataDir, ".snapshots", "program-projects", STAMP, "a.json");
    expect(JSON.parse(readFileSync(kept, "utf8"))).toEqual({ v: 2 });
    expect(r.backupDir).toBe(join(s.dataDir, ".snapshots", "program-projects", STAMP));
    expect(s.readLive("a.json")).toEqual({ v: 3 });
  });

  it("leaves the live snapshot untouched when a source failed validation", () => {
    const s = sandbox();
    s.seed("program-projects.json", { generated: "2026-11-01" });
    s.seed("program-projects/gsoc.json", { program: "gsoc", projects: 4, list: [{ t: "keep me" }] });
    const st = s.staging();
    s.put(st, "program-projects.json", { generated: STAMP });
    // the gsoc fetch failed, so nothing was staged for it: the shards must stay put
    const r = promoteSnapshot({
      staging: st,
      files: ["program-projects.json", "program-projects/gsoc.json"],
      check: (_rel: string, j: any) => (j.program && j.program !== "gsoc" ? "wrong program" : null),
    });
    expect(r.ok).toBe(false);
    expect(r.problems).toEqual([{ file: "program-projects/gsoc.json", problem: "this run wrote no such file" }]);
    expect(s.readLive("program-projects/gsoc.json").list[0].t).toBe("keep me");
    expect(s.readLive("program-projects.json").generated).toBe("2026-11-01");
    expect(existsManifest(s.dataDir)).toBe(false);
  });

  it("rolls the files it already swapped back when the swap itself fails", () => {
    const s = sandbox();
    s.seed("a.json", { v: "old-a" });
    s.seed("b.json", { v: "old-b" });
    const st = s.staging();
    s.put(st, "a.json", { v: "new-a" });
    s.put(st, "b.json", { v: "new-b" });
    const r = promoteSnapshot({ staging: st, files: ["a.json", "b.json"], io: breakRename(st, 2, "EBUSY: resource busy or locked") });
    expect(r.ok).toBe(false);
    expect(r.rolledBack).toBe(true);
    expect(r.failedFile).toBe("b.json");
    expect(r.problems[0].problem).toContain("EBUSY");
    expect(s.readLive("a.json")).toEqual({ v: "old-a" });
    expect(s.readLive("b.json")).toEqual({ v: "old-b" });
  });

  it("removes a dataset that had no previous version when the swap fails", () => {
    const s = sandbox();
    s.seed("a.json", { v: "old-a" });
    const st = s.staging();
    s.put(st, "a.json", { v: "new-a" });
    s.put(st, "brand-new.json", { v: "new" });
    const r = promoteSnapshot({ staging: st, files: ["a.json", "brand-new.json"], io: breakRename(st, 2, "ENOSPC: no space left on device") });
    expect(r.rolledBack).toBe(true);
    expect(existsSync(s.live("a.json"))).toBe(true);
    expect(s.readLive("a.json")).toEqual({ v: "old-a" });
    expect(existsSync(s.live("brand-new.json"))).toBe(false);
  });

  it("keeps a run's scratch out of the directory the site serves", () => {
    const s = sandbox();
    const workDir = join(s.root, "work");
    const st = openStaging({ dataDir: s.dataDir, name: "program-projects", stamp: STAMP, workDir });
    expect(st.dir).toBe(join(workDir, ".staging", `program-projects-${STAMP}`));
    writeFileSync(st.stage("a.json"), JSON.stringify({ v: 1 }));
    const r = promoteSnapshot({ staging: st, files: ["a.json"] });
    expect(r.ok).toBe(true);
    expect(existsSync(join(s.dataDir, ".staging"))).toBe(false);
    expect(s.readLive("a.json")).toEqual({ v: 1 });
    expect(r.backupDir).toBe(join(workDir, ".snapshots", "program-projects", STAMP));
    /* the staged directory held nothing after the rename, so a finished run
       does not leave it behind */
    expect(existsSync(st.dir)).toBe(false);
  });

  it("keeps the staged output of a run that did not promote", () => {
    const s = sandbox();
    const st = s.staging();
    s.put(st, "a.json", "{ broken");
    promoteSnapshot({ staging: st, files: ["a.json"] });
    expect(existsSync(st.dir)).toBe(true);
    expect(existsSync(join(s.dataDir, ".snapshots"))).toBe(false);
  });

  it("keeps only the newest snapshots so the archive does not grow forever", () => {
    const s = sandbox();
    for (const stamp of ["2026-11-10", "2026-11-11", "2026-11-12", STAMP]) {
      const st = s.staging("program-projects", stamp);
      s.put(st, "a.json", { stamp });
      const r = promoteSnapshot({ staging: st, files: ["a.json"], keep: 2 });
      if (stamp === STAMP) expect(r.pruned).toEqual(["2026-11-11"]);
    }
    const kept = readdirSorted(join(s.dataDir, ".snapshots", "program-projects"));
    expect(kept).toEqual(["2026-11-12", STAMP]);
  });
});

describe("the report a run prints", () => {
  it("names the failing source and where the temporary output is", () => {
    const s = sandbox();
    s.seed("a.json", { v: 1 });
    const st = s.staging();
    s.put(st, "a.json", "{ broken");
    const text = formatPromotion(promoteSnapshot({ staging: st, files: ["a.json", "program-projects/gsoc.json"] }));
    expect(text).toContain("NOT PROMOTED");
    expect(text).toContain("validation failed; the live snapshot was never written to");
    expect(text).toContain("a.json: does not parse as JSON");
    expect(text).toContain("program-projects/gsoc.json: this run wrote no such file");
    expect(text).toContain(st.dir);
  });

  it("says what was rolled back when a swap failed halfway", () => {
    const s = sandbox();
    s.seed("a.json", { v: "old" });
    const st = s.staging();
    s.put(st, "a.json", { v: "new" });
    s.put(st, "b.json", { v: "new" });
    const text = formatPromotion(promoteSnapshot({ staging: st, files: ["a.json", "b.json"], io: breakRename(st, 2, "EPERM: operation not permitted") }));
    expect(text).toContain("swap failed; every file already moved was put back");
    expect(text).toContain("- b.json: swap failed");
    expect(text).toContain("EPERM");
    expect(s.readLive("a.json")).toEqual({ v: "old" });
  });

  it("reports a successful promotion with its metadata file", () => {
    const s = sandbox();
    const st = s.staging();
    s.put(st, "a.json", { v: 1 });
    const text = formatPromotion(promoteSnapshot({ staging: st, files: ["a.json"] }));
    expect(text).toContain("snapshot program-projects @ 2026-11-14: promoted 1 file(s)");
    expect(text).toContain("metadata -> program-projects-snapshot.json");
    expect(text).not.toContain("NOT PROMOTED");
  });

  it("has no metadata to read before the first promotion", () => {
    const s = sandbox();
    expect(readManifest({ dataDir: s.dataDir, name: "program-projects" })).toBeNull();
    expect(readManifest({ dataDir: s.dataDir, name: "never-promoted" })).toBeNull();
  });
});

function existsManifest(dataDir: string) {
  return existsSync(join(dataDir, "program-projects-snapshot.json"));
}

const readdirSorted = (dir: string) => readdirSync(dir).sort();
