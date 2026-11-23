import { describe, expect, it } from "vitest";
import {
  LEDGER_EXPORT_SCHEMA, adoptionStamp, buildLedgerExport, canMutate, canShowEntries, classify,
  clearBoardStamp, exportFileName, keepStamp, makeStamp, needsResolution, normalizeLogin, ownerLabel,
  parseStamp, rowsFromLedger, type LedgerOwnerStamp, type LedgerRecord,
} from "../../lib/ledgerIdentity";
import { currentIdentityOf, keepBlockedReason, stateCopy } from "./model";
import type { ServerUser } from "../../lib/api";
import type { User } from "../../lib/util";

const AT = "2026-11-22T09:30:00.000Z";
const stampOf = (login: string): LedgerOwnerStamp => ({ login, linkedAt: AT });

const serverUser = (over: Partial<ServerUser> = {}): ServerUser => ({
  id: "u1", name: "Ada Lovelace", login: null, email: null, picture: null, provider: "email", ...over,
});
const browserUser = (over: Partial<User> = {}): User => ({
  name: "Ada Lovelace", provider: "GitHub", ...over,
});

describe("normalizeLogin", () => {
  it("trims, drops a pasted @, and lower-cases the key", () => {
    expect(normalizeLogin("  @OctoCat ")).toBe("octocat");
    expect(normalizeLogin("ADA@Example.COM")).toBe("ada@example.com");
  });

  it("rejects empty, internal whitespace, and non-strings", () => {
    expect(normalizeLogin("")).toBeNull();
    expect(normalizeLogin("   ")).toBeNull();
    expect(normalizeLogin("@")).toBeNull();
    expect(normalizeLogin("octo cat")).toBeNull();
    expect(normalizeLogin("octo\ncat")).toBeNull();
    expect(normalizeLogin(null)).toBeNull();
    expect(normalizeLogin(undefined)).toBeNull();
  });

  it("prints handles with @ and emails without one", () => {
    expect(ownerLabel("OctoCat")).toBe("@octocat");
    expect(ownerLabel("ada@example.com")).toBe("ada@example.com");
    expect(ownerLabel(null)).toBe("No account");
  });
});

describe("stamp lifecycle", () => {
  it("builds a lowercase stamp with a canonical timestamp", () => {
    expect(makeStamp("@OctoCat", "2026-11-22T09:30:00Z")).toEqual({
      login: "octocat", linkedAt: "2026-11-22T09:30:00.000Z",
    });
  });

  it("refuses to build a stamp without a key or a real date", () => {
    expect(makeStamp("", AT)).toBeNull();
    expect(makeStamp("octocat", "not a date")).toBeNull();
  });

  it("parses an object and a JSON string, ignoring extra fields", () => {
    const expected = stampOf("octocat");
    expect(parseStamp({ login: "OctoCat", linkedAt: AT, note: "extra" })).toEqual(expected);
    expect(parseStamp(JSON.stringify(expected))).toEqual(expected);
  });

  it("returns null for every malformed stamp instead of inventing an owner", () => {
    expect(parseStamp(null)).toBeNull();
    expect(parseStamp("")).toBeNull();
    expect(parseStamp("not json")).toBeNull();
    expect(parseStamp({})).toBeNull();
    expect(parseStamp({ login: "", linkedAt: AT })).toBeNull();
    expect(parseStamp({ login: "octocat", linkedAt: "nope" })).toBeNull();
    expect(parseStamp([1, 2, 3])).toBeNull();
  });
});

describe("classify: every transition", () => {
  it("unclaimed when no stamp exists, with or without a session", () => {
    expect(classify(null, null)).toBe("unclaimed");
    expect(classify(null, { login: "octocat" })).toBe("unclaimed");
  });

  it("matches a stamp to the same account, case and @ insensitive", () => {
    expect(classify(stampOf("octocat"), { login: "OctoCat" })).toBe("same");
    expect(classify(stampOf("ada@example.com"), { login: "ADA@example.com" })).toBe("same");
  });

  it("reports a disconnected session as unlinked, preserving the stamp", () => {
    expect(classify(stampOf("octocat"), null)).toBe("unlinked");
  });

  it("reports a different account as changed", () => {
    expect(classify(stampOf("octocat"), { login: "hubot" })).toBe("changed");
    expect(classify(stampOf("ada@example.com"), { login: "grace@example.com" })).toBe("changed");
  });

  it("walks disconnect -> reconnect same -> disconnect -> reconnect different", () => {
    const first = makeStamp("octocat", AT)!;

    /* signed in as octocat, then the session drops */
    expect(classify(first, { login: "octocat" })).toBe("same");
    expect(classify(first, null)).toBe("unlinked");

    /* reconnecting the same account is safe and needs no action */
    expect(classify(first, { login: "octocat" })).toBe("same");

    /* a different account is caught before anything is displayed */
    expect(classify(first, null)).toBe("unlinked");
    expect(classify(first, { login: "hubot" })).toBe("changed");
  });

  it("treats a corrupt previous login as no stamp at all", () => {
    expect(classify({ login: "  ", linkedAt: AT }, { login: "octocat" })).toBe("unclaimed");
  });
});

describe("adoption rules", () => {
  it("claims an empty board for the connected account", () => {
    expect(adoptionStamp("unclaimed", { login: "octocat" }, 0, AT)).toEqual(stampOf("octocat"));
  });

  it("lets an empty board follow a new account, since there is no data to leak", () => {
    expect(adoptionStamp("changed", { login: "hubot" }, 0, AT)).toEqual(stampOf("hubot"));
    expect(adoptionStamp("unlinked", { login: "hubot" }, 0, AT)).toEqual(stampOf("hubot"));
  });

  it("never auto-claims a board that holds entries", () => {
    expect(adoptionStamp("unclaimed", { login: "octocat" }, 1, AT)).toBeNull();
    expect(adoptionStamp("changed", { login: "hubot" }, 3, AT)).toBeNull();
    expect(adoptionStamp("unlinked", { login: "hubot" }, 2, AT)).toBeNull();
  });

  it("does nothing without an identity, or when the stamp already matches", () => {
    expect(adoptionStamp("unlinked", null, 0, AT)).toBeNull();
    expect(adoptionStamp("same", { login: "octocat" }, 0, AT)).toBeNull();
  });

  it("re-stamps without deleting: keepStamp works in a changed state", () => {
    expect(keepStamp({ login: "Hubot" }, AT)).toEqual(stampOf("hubot"));
    expect(keepStamp(null, AT)).toBeNull();
  });

  it("clears the stamp when a clear happens with nobody signed in", () => {
    expect(clearBoardStamp({ login: "octocat" }, AT)).toEqual(stampOf("octocat"));
    expect(clearBoardStamp(null, AT)).toBeNull();
  });
});

describe("write and display gates", () => {
  it("allows writes when the owner matches or no session exists", () => {
    expect(canMutate("same", 4)).toBe(true);
    expect(canMutate("unlinked", 4)).toBe(true);
  });

  it("allows writes to an empty board and blocks a populated changed board", () => {
    expect(canMutate("changed", 0)).toBe(true);
    expect(canMutate("changed", 4)).toBe(false);
    expect(canMutate("unclaimed", 0)).toBe(true);
    expect(canMutate("unclaimed", 4)).toBe(false);
  });

  it("asks for a decision only when there is data at stake", () => {
    expect(needsResolution("changed", 1)).toBe(true);
    expect(needsResolution("changed", 0)).toBe(false);
    expect(needsResolution("unclaimed", 1)).toBe(true);
    expect(needsResolution("unclaimed", 0)).toBe(false);
    expect(needsResolution("same", 9)).toBe(false);
    expect(needsResolution("unlinked", 9)).toBe(false);
  });

  it("hides rows only for a changed account", () => {
    expect(canShowEntries("same")).toBe(true);
    expect(canShowEntries("unlinked")).toBe(true);
    expect(canShowEntries("unclaimed")).toBe(true);
    expect(canShowEntries("changed")).toBe(false);
  });
});

describe("export payload", () => {
  const ledger: LedgerRecord = {
    "https://github.com/vercel/next.js/issues/900": {
      stage: "working", added: "2026-03-03", meta: { repo: "vercel/next.js", number: 900, title: "Nine hundred" },
    },
    "https://github.com/facebook/react/issues/1": {
      stage: "saved", added: "2026-01-01", meta: { repo: "facebook/react", number: 1, title: "First" },
    },
    "https://github.com/cyrus/example/issues/7": {
      stage: "done", added: "2026-03-03",
    },
  };

  it("sorts oldest first, ties by URL, and keeps absent metadata null", () => {
    const rows = rowsFromLedger(ledger);
    expect(rows.map((r) => r.url)).toEqual([
      "https://github.com/facebook/react/issues/1",
      "https://github.com/cyrus/example/issues/7",
      "https://github.com/vercel/next.js/issues/900",
    ]);
    expect(rows[1].meta).toBeNull();
    expect(rows[2].meta).toEqual({ repo: "vercel/next.js", number: 900, title: "Nine hundred" });
  });

  it("writes the versioned envelope with owner and current identity", () => {
    const payload = buildLedgerExport(ledger, {
      owner: { login: "OctoCat", linkedAt: "2026-10-01T12:00:00Z" },
      currentIdentity: { login: "OctoCat" },
      exportedAt: "2026-11-22T10:00:00Z",
    });
    expect(payload.schema).toBe(LEDGER_EXPORT_SCHEMA);
    expect(payload.schema).toBe("cyrus.ledger.export.v1");
    expect(payload.count).toBe(3);
    expect(payload.exportedAt).toBe("2026-11-22T10:00:00.000Z");
    expect(payload.owner).toEqual({ login: "octocat", linkedAt: "2026-10-01T12:00:00.000Z" });
    expect(payload.currentIdentity).toEqual({ login: "octocat" });
    expect(payload.entries).toHaveLength(3);
    /* every stored field survives the trip */
    expect(payload.entries[2]).toMatchObject({ stage: "working", added: "2026-03-03" });
  });

  it("omits absent owner and identity rather than guessing", () => {
    const payload = buildLedgerExport({}, { exportedAt: AT });
    expect(payload).toMatchObject({ count: 0, owner: null, currentIdentity: null, entries: [] });
  });

  it("round-trips through JSON unchanged", () => {
    const payload = buildLedgerExport(ledger, { owner: stampOf("octocat"), exportedAt: AT });
    expect(JSON.parse(JSON.stringify(payload))).toEqual(payload);
  });

  it("names the download after the export date", () => {
    expect(exportFileName("2026-11-22T10:00:00Z")).toBe("cyrus-issue-board-2026-11-22.json");
    expect(exportFileName("bad")).toBe("cyrus-issue-board-undated.json");
  });
});

describe("identity resolution", () => {
  it("prefers a verified GitHub login over every email", () => {
    const id = currentIdentityOf({
      user: browserUser({ email: "browser@example.com" }),
      serverUser: serverUser({ login: "OctoCat", email: "server@example.com", provider: "github" }),
    });
    expect(id).toEqual({
      login: "octocat", label: "@octocat", source: "github-session", verified: true, provider: "github",
    });
  });

  it("falls back to the verified account email and marks its source", () => {
    const id = currentIdentityOf({
      user: browserUser({ email: "browser@example.com" }),
      serverUser: serverUser({ email: "Server@Example.com", provider: "email" }),
    });
    expect(id).toMatchObject({
      login: "server@example.com", source: "account-session", verified: true, provider: "email",
    });
  });

  it("uses a remembered browser email, unverified, when there is no session", () => {
    const id = currentIdentityOf({
      user: browserUser({ email: "browser@example.com" }),
      serverUser: null,
    });
    expect(id).toMatchObject({
      login: "browser@example.com", source: "browser-profile", verified: false, provider: "GitHub",
    });
  });

  it("returns null rather than keying off a display name", () => {
    expect(currentIdentityOf({ user: browserUser(), serverUser: null })).toBeNull();
    expect(currentIdentityOf({ user: null, serverUser: serverUser() })).toBeNull();
  });

  it("explains the keep gate for a signed-out or already-stamped board", () => {
    const identity = currentIdentityOf({ user: null, serverUser: serverUser({ login: "octocat" }) });
    expect(keepBlockedReason("changed", null)).toMatch(/sign in/i);
    expect(keepBlockedReason("same", identity)).toMatch(/already/i);
    expect(keepBlockedReason("changed", identity)).toBeNull();
  });

  it("gives each ownership state a role and a sentence with the real owner", () => {
    const owner = stampOf("octocat");
    const current = currentIdentityOf({ user: null, serverUser: serverUser({ login: "hubot" }) });
    for (const state of ["same", "changed", "unlinked", "unclaimed"] as const) {
      const copy = stateCopy(state, { owner, current, entryCount: 2 });
      expect(copy.title.length).toBeGreaterThan(0);
      expect(copy.body.length).toBeGreaterThan(0);
      expect(copy.role).toBe(state === "changed" ? "alert" : "status");
    }
    expect(stateCopy("changed", { owner, current, entryCount: 2 }).body).toContain("@octocat");
    expect(stateCopy("changed", { owner, current, entryCount: 2 }).body).toContain("@hubot");
  });
});
