/* ══ orgs.test.ts — the directory is a program directory ══════════════
 * scripts/build-roster-orgs.mjs writes realOrgs.ts from live GitHub data, and
 * that fetch has no opinion about programs: it happily returns Microsoft,
 * OpenAI and Anthropic because their repositories are popular. This file is
 * the gate that keeps those out of the published directory, so a refresh
 * cannot quietly reintroduce a profile with no participation record behind it.
 */
import { describe, expect, it } from "vitest";
import { ORGS, UNASSOCIATED_ORGS } from "@/data/orgs";
import { REAL_ORGS } from "@/data/realOrgs";
import { programsOf } from "@/data/programAssoc";

describe("organization directory", () => {
  it("lists only organizations a program's record names", () => {
    const bare = ORGS.filter((o) => programsOf(o.login).length === 0);
    expect(bare.map((o) => o.login), "unassociated orgs reached the directory").toEqual([]);
  });

  it("splits the fetched profiles exactly once", () => {
    expect(ORGS.length + UNASSOCIATED_ORGS.length).toBe(REAL_ORGS.length);
    const both = ORGS.filter((o) => UNASSOCIATED_ORGS.some((x) => x.login === o.login));
    expect(both).toEqual([]);
  });

  it("keeps the accounts with no program record out, whatever their stars", () => {
    for (const login of ["microsoft", "google", "openai", "anthropics", "huggingface", "vercel"]) {
      expect(ORGS.some((o) => o.login === login), `${login} is listed`).toBe(false);
      expect(REAL_ORGS.some((o) => o.login === login), `${login} should still be fetched data`).toBe(true);
    }
  });

  it("gives every listed org a profile worth linking to", () => {
    for (const o of ORGS) {
      expect(o.login).toBeTruthy();
      expect(programsOf(o.login).length).toBeGreaterThan(0);
    }
  });
});
