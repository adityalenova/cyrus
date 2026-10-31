import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { snapshotLabel, updateSnapshotBadge } from "../../scripts/readme-snapshot.mjs";

const root = new URL("../../", import.meta.url);
const badge = '<img src="https://img.shields.io/badge/snapshot-12_Oct_2026-221a13?style=for-the-badge" alt="Data snapshot"/>';
const catalog = (...dates: string[]) => `export const REPOS: Repo[] = ${JSON.stringify(dates.map(updated => ({ updated })))};\n`;
const fixtures: string[] = [];
afterEach(() => fixtures.splice(0).forEach(path => rmSync(path, { recursive: true, force: true })));

describe("README snapshot", () => {
  it("uses the newest catalog date, without depending on catalog order or local timezone", () => {
    expect(snapshotLabel(catalog("2026-01-31", "2025-12-31", "2026-01-01"))).toBe("31_Jan_2026");
  });

  it.each(["not-a-date", "2026-02-30", "2026-13-01"])("rejects invalid catalog date %s", date => {
    expect(() => snapshotLabel(catalog(date))).toThrow("Invalid catalog updated date");
  });

  it("rejects an empty catalog or missing declaration instead of inventing a snapshot date", () => {
    expect(() => snapshotLabel(catalog())).toThrow("empty catalog");
    expect(() => snapshotLabel("export const SOMETHING_ELSE = [];\n")).toThrow("Cannot find the REPOS catalog");
  });

  it("preserves the badge styling and is idempotent", () => {
    const expected = badge.replace("12_Oct_2026", "1_Jan_2027");
    expect(updateSnapshotBadge(badge, "1_Jan_2027")).toBe(expected);
    expect(updateSnapshotBadge(expected, "1_Jan_2027")).toBe(expected);
    expect(() => updateSnapshotBadge("No badge", "1_Jan_2027")).toThrow("Cannot find the README snapshot badge");
  });

  it("keeps the checked-in README stamp consistent with the catalog", () => {
    const readme = readFileSync(new URL("README.md", root), "utf8");
    const label = snapshotLabel(readFileSync(new URL("src/data/repos.ts", root), "utf8"));
    expect(updateSnapshotBadge(readme, label)).toBe(readme);
  });

  it.each(["refresh.mjs", "fetch-orgs.mjs"])("%s updates the badge after its refresh, using only local fixtures", script => {
    const fixture = mkdtempSync(join(tmpdir(), "cyrus-snapshot-"));
    fixtures.push(fixture);
    mkdirSync(join(fixture, "scripts"));
    mkdirSync(join(fixture, "src/data"), { recursive: true });
    for (const file of [script, "readme-snapshot.mjs"]) {
      cpSync(new URL(`scripts/${file}`, root), join(fixture, "scripts", file));
    }
    writeFileSync(join(fixture, "README.md"), badge);
    writeFileSync(join(fixture, "src/data/repos.ts"), catalog("2027-01-01", "2026-12-31"));
    // Run the real entry points with all remote calls replaced before imports execute.
    const hook = join(fixture, "offline.mjs");
    writeFileSync(hook, `
import childProcess from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
childProcess.execFileSync = () => JSON.stringify({ public_repos: 1, items: [] });
syncBuiltinESMExports();
globalThis.fetch = async () => ({ ok: true, json: async () => ({ hackathons: [] }) });
const setTimeout = globalThis.setTimeout;
globalThis.setTimeout = (callback) => setTimeout(callback, 0);
`);
    execFileSync(process.execPath, ["--import", pathToFileURL(hook).href, join(fixture, "scripts", script), "gsoc"], {
      cwd: fixture, stdio: "pipe", timeout: 10000,
    });
    expect(readFileSync(join(fixture, "README.md"), "utf8")).toBe(badge.replace("12_Oct_2026", "1_Jan_2027"));
  });
});
