/* ══ model.ts — what the guard can prove, and what it cannot ═════════
   The recovery screen must not overclaim. Cyrus has two real identity
   sources, and this module names them precisely:

   1. The server session (`/api/me`). A GitHub sign-in that reaches the
      server yields a verified `login`; an email sign-in yields a verified
      email. This is the only identity the guard treats as proof.
   2. The browser profile (`agenthub.user`). Signing in with GitHub through
      the popup keeps the name, email and avatar in localStorage, but the
      GitHub login is discarded. The email is useful as a key; it is not
      proof of anything.

   There is no third source, so a browser profile with no email has no
   stable key at all, and the guard says so instead of guessing from a
   display name. All copy that mentions detection is generated here, once,
   beside the rule it describes.
   ═══════════════════════════════════════════════════════════════════ */
import { normalizeLogin, ownerLabel, type LedgerOwnerStamp, type OwnershipState } from "../../lib/ledgerIdentity";
import type { ServerUser } from "../../lib/api";
import type { User } from "../../lib/util";

export type IdentitySource = "github-session" | "account-session" | "browser-profile";

export type CurrentIdentity = {
  login: string;
  label: string;
  source: IdentitySource;
  /** true only when the server session (not localStorage) supplied the key */
  verified: boolean;
  /** provider reported by the session, when there is one */
  provider: string | null;
};

export const IDENTITY_SOURCE: Record<IdentitySource, { label: string; note: string }> = {
  "github-session": {
    label: "GitHub session",
    note: "The server answered /api/me with this GitHub login. This is the strongest identity the app has.",
  },
  "account-session": {
    label: "Account session",
    note: "The server verified this account, but it has no GitHub login attached. The email is the account key.",
  },
  "browser-profile": {
    label: "Browser profile only",
    note: "This browser remembers a profile with this email, but no server session confirms it. Treat it as a name tag, not proof.",
  },
};

/** Resolve the one identity the guard may compare, in strict precedence:
 *  a verified GitHub login beats a verified account email, which beats a
 *  remembered browser email. No key is ever derived from a display name -
 *  two people can share one. */
export function currentIdentityOf(input: {
  user: User | null;
  serverUser: ServerUser | null;
}): CurrentIdentity | null {
  const server = input.serverUser;
  const serverLogin = server ? normalizeLogin(server.login) : null;
  if (serverLogin) {
    return {
      login: serverLogin,
      label: ownerLabel(serverLogin),
      source: "github-session",
      verified: true,
      provider: server?.provider ?? "GitHub",
    };
  }
  const serverEmail = server ? normalizeLogin(server.email) : null;
  if (serverEmail) {
    return {
      login: serverEmail,
      label: ownerLabel(serverEmail),
      source: "account-session",
      verified: true,
      provider: server?.provider ?? null,
    };
  }
  const browserEmail = input.user ? normalizeLogin(input.user.email) : null;
  if (browserEmail) {
    return {
      login: browserEmail,
      label: ownerLabel(browserEmail),
      source: "browser-profile",
      verified: false,
      provider: input.user?.provider ?? null,
    };
  }
  return null;
}

export type StateTone = "ok" | "warn" | "alert" | "info";

export type StateCopy = {
  /** short badge text, monospaced upper-case in the UI */
  badge: string;
  title: string;
  body: string;
  tone: StateTone;
  role: "status" | "alert";
};

/** One sentence per state, written with the actual accounts and count. */
export function stateCopy(
  state: OwnershipState,
  ctx: { owner: LedgerOwnerStamp | null; current: CurrentIdentity | null; entryCount: number },
): StateCopy {
  const owner = ctx.owner ? ownerLabel(ctx.owner.login) : "an account this browser no longer has";
  const current = ctx.current ? ctx.current.label : "no account";
  const count = ctx.entryCount;
  switch (state) {
    case "same":
      return {
        badge: "Owner matches",
        title: `This board belongs to ${owner}`,
        body: `The owner stamp and the connected account agree. ${count === 0 ? "The board is empty." : `${count} tracked issue${count === 1 ? "" : "s"} stay visible and editable.`}`,
        tone: "ok",
        role: "status",
      };
    case "changed":
      return {
        badge: "Different account",
        title: "A different account is connected",
        body: `This board was last confirmed by ${owner}, but ${current} is connected now. The ${count} tracked issue${count === 1 ? "" : "s"} are hidden from this view until you keep the board on one account, export it, or clear it.`,
        tone: "alert",
        role: "alert",
      };
    case "unlinked":
      return {
        badge: "No account connected",
        title: "The board is not linked to a live session",
        body: `This board was last confirmed by ${owner}. It stays in this browser and stays editable; if a different account signs in later, the board is blocked before anything is shown.`,
        tone: "warn",
        role: "status",
      };
    case "unclaimed":
    default:
      return {
        badge: count > 0 ? "Stamp required" : "Not stamped yet",
        title: count > 0 ? "This board predates ownership stamps" : "Ready to stamp this board",
        body: count > 0
          ? `${count} tracked issue${count === 1 ? " has" : "s have"} no owner yet. Keep the board on ${current} to migrate it in place - the entries are not deleted or rewritten.`
          : `There are no tracked issues yet. The first account to add one becomes the owner of this board.`,
        tone: "info",
        role: "status",
      };
  }
}

/** Why the keep action is unavailable, or null when it can run. */
export function keepBlockedReason(state: OwnershipState, current: CurrentIdentity | null): string | null {
  if (!current) return "Sign in first. A stamp needs an account, and this browser has no verified key.";
  if (state === "same") return "The board is already stamped to this account.";
  return null;
}

/** Honest limits, shown on the recovery page. Each one is a thing the
 *  guard genuinely cannot see, not a disclaimer for its own sake. */
export const GUARD_LIMITS: { title: string; body: string }[] = [
  {
    title: "GitHub sign-in here drops the login",
    body: "The popup flow keeps your name, email and avatar in this browser, but not your GitHub login. Ownership becomes verifiable when the server session answers with that login, or when a verified email can stand in as the key.",
  },
  {
    title: "An email is weaker than a login",
    body: "A verified email is unique per account, so it works as a key. Two people who share one address are indistinguishable to the guard, and a browser-only email is a reminder of who signed in, not proof.",
  },
  {
    title: "A signed-out board is still local",
    body: "With no session there is no second account to leak into, so the board remains readable and editable in this browser. The guard catches the next account change, not who was physically at the keyboard.",
  },
  {
    title: "Clearing cannot be undone",
    body: "The clear action removes every tracked issue from this browser. Export first if the entries matter; the JSON file keeps their stage, date and snapshot metadata exactly as stored.",
  },
];

/** Short provenance line for the page footer. */
export const STAMP_PROVENANCE =
  "Ownership is a stamp in this browser (cyrus.ledger.owner.v1). It is a local note, not a server-side permission; the board itself never leaves this browser except through the export button.";
