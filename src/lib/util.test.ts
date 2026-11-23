/* ══ src/lib/util.test.ts ══
   One guard on the catalog derivation. The route tests cover the rest. ═ */
import { describe, expect, it } from "vitest";
import { REPOS } from "../data/repos";
import { PROGRAM_REPOS } from "../data/programRepos";
import { CATALOG } from "./util";

describe("CATALOG", () => {
  /* Why the guard exists: CATALOG is meant to be nothing but the two source
     arrays concatenated, so any filter, dedupe or extra entry added to that
     line shows up as a length mismatch here instead of silently shrinking the
     site's catalog. */
  it("is exactly REPOS.length + PROGRAM_REPOS.length rows", () => {
    expect(CATALOG.length).toBe(REPOS.length + PROGRAM_REPOS.length);
  });
});
