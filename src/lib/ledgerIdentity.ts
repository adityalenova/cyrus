/* ══ ledgerIdentity.ts — who owns the local issue board ══════════════
   The issue board lives in one browser key (`cyrus.issues.v1`) and the
   visitor's account lives somewhere else entirely. When the two drift
   apart - a session expires, a different GitHub account signs in - the
   board must not quietly become somebody else's.

   This module is the whole ownership rule, with no React and no storage:
   a stamp records the account that last confirmed the board, a current
   identity is whatever the app can prove right now, and classify() says
   how those two relate. A missing stamp is not a mismatch: boards created
   before this guard existed are "unclaimed" and are adopted explicitly,
   never by guessing.

   `login` is the account key. It is a GitHub login when the server session
   proves one; otherwise it is the verified account email, lowercased. The
   two are kept in the same field so one comparison covers both, and
   ownerLabel() prints whichever it is without pretending it is a handle.
   ═══════════════════════════════════════════════════════════════════ */

/** Browser key holding the owner stamp. The board itself stays in LEDGER_KEY. */
export const LEDGER_OWNER_KEY = "cyrus.ledger.owner.v1";

/** Versioned shape of the JSON download. Consumers may branch on this string. */
export const LEDGER_EXPORT_SCHEMA = "cyrus.ledger.export.v1";

export type LedgerOwnerStamp = { login: string; linkedAt: string };
export type LedgerIdentity = { login: string };

export type OwnershipState = "same" | "changed" | "unlinked" | "unclaimed";

/** The subset of a ledger row the export needs; money-free and pure. */
export type LedgerRow = { stage: string; added: string; meta?: unknown };
export type LedgerRecord = Record<string, LedgerRow>;

export type LedgerExportRow = { url: string; stage: string; added: string; meta: unknown | null };
export type LedgerExport = {
  schema: string;
  exportedAt: string;
  owner: LedgerOwnerStamp | null;
  currentIdentity: LedgerIdentity | null;
  count: number;
  entries: LedgerExportRow[];
};

/* ── keys ──────────────────────────────────────────────────────────
   GitHub treats logins case-insensitively and so do email domains in
   practice. Trim, drop a pasted leading "@", and lower-case once so a
   stamp written as "OctoCat" still matches "octocat". Whitespace inside
   a key is never valid - a login has none and an email has none - so a
   value carrying it is rejected rather than silently rewritten.        */
export function normalizeLogin(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().replace(/^@+/, "").trim();
  if (!trimmed || /\s/.test(trimmed) || trimmed.length > 200) return null;
  return trimmed.toLowerCase();
}

/** Printable form of a key: handles stay @handles, emails stay emails. */
export function ownerLabel(login: string | null | undefined): string {
  const key = normalizeLogin(login);
  if (!key) return "No account";
  return key.includes("@") ? key : `@${key}`;
}

const isoOf = (now: Date | string): string | null => {
  const d = now instanceof Date ? now : new Date(now);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

/** Build a stamp for an account at a known time; null when either is unusable. */
export function makeStamp(login: string | null | undefined, now: Date | string = new Date()): LedgerOwnerStamp | null {
  const key = normalizeLogin(login);
  const at = isoOf(now);
  if (!key || !at) return null;
  return { login: key, linkedAt: at };
}

/** Read a stamp written to storage, from an object or a JSON string.
 *  Anything malformed is null: a corrupt stamp must not invent an owner. */
export function parseStamp(raw: unknown): LedgerOwnerStamp | null {
  if (raw == null) return null;
  let value: unknown = raw;
  if (typeof raw === "string") {
    try { value = JSON.parse(raw); } catch { return null; }
  }
  if (typeof value !== "object" || value === null) return null;
  const rec = value as Record<string, unknown>;
  const login = typeof rec.login === "string" ? normalizeLogin(rec.login) : null;
  const at = typeof rec.linkedAt === "string" ? isoOf(rec.linkedAt) : null;
  if (!login || !at) return null;
  return { login, linkedAt: at };
}

/** How the stamped owner relates to whoever is signed in right now. */
export function classify(previous: LedgerOwnerStamp | null, current: LedgerIdentity | null): OwnershipState {
  const previousLogin = previous ? normalizeLogin(previous.login) : null;
  const currentLogin = current ? normalizeLogin(current.login) : null;
  if (!previousLogin) return "unclaimed";
  if (!currentLogin) return "unlinked";
  return previousLogin === currentLogin ? "same" : "changed";
}

/** May a write land on the board in this state?
 *
 *  - same: yes, the stamp and the session agree.
 *  - unlinked: yes. There is no second account to leak into; the board stays
 *    exactly where it is, and the next different sign-in is caught as
 *    "changed" before anything is shown.
 *  - unclaimed with an empty board: yes, and the first write stamps it.
 *  - unclaimed with entries: no. An existing board must be kept on an
 *    account explicitly, otherwise a stranger's sign-in could inherit it.
 *  - changed with entries: no. That is the whole point of the guard.
 *  - changed with nothing on the board: yes, and adoption re-stamps it.
 *    There is no saved data to cross an account boundary.               */
export function canMutate(state: OwnershipState, entryCount: number): boolean {
  if (state === "same" || state === "unlinked") return true;
  if (state === "unclaimed") return entryCount === 0;
  return state === "changed" && entryCount === 0;
}

/** True when the visitor must choose before anything is written or shown. */
export function needsResolution(state: OwnershipState, entryCount: number): boolean {
  if (state === "changed") return entryCount > 0;
  return state === "unclaimed" && entryCount > 0;
}

/** A changed identity hides the rows until the visitor chooses a recovery
 *  action; every other state can display this browser's own board. */
export function canShowEntries(state: OwnershipState): boolean {
  return state !== "changed";
}

/** The only automatic adoption: a board that holds no entries. There is no
 *  prior data to inherit, so stamping it costs nothing - including when the
 *  previous stamp names a different account, because an empty board has no
 *  rows to leak. A board that already holds entries is adopted only through
 *  keepStamp(), from the recovery screen, with the count in front of the
 *  visitor. */
export function adoptionStamp(
  state: OwnershipState,
  current: LedgerIdentity | null,
  entryCount: number,
  now: Date | string = new Date(),
): LedgerOwnerStamp | null {
  if (!current || entryCount > 0) return null;
  if (state === "same") return null;
  return makeStamp(current.login, now);
}

/** Explicit "keep this board on this account": re-stamps, deletes nothing.
 *  This is also the migration path for a pre-guard board. */
export function keepStamp(current: LedgerIdentity | null, now: Date | string = new Date()): LedgerOwnerStamp | null {
  if (!current) return null;
  return makeStamp(current.login, now);
}

/** After a clear, an empty board belongs to whoever is signed in now - or to
 *  nobody, if nobody is. Either way the old stamp must not survive a clear
 *  it did not authorise. */
export function clearBoardStamp(current: LedgerIdentity | null, now: Date | string = new Date()): LedgerOwnerStamp | null {
  if (!current) return null;
  return makeStamp(current.login, now);
}

/** Deterministic export rows: oldest first, ties broken by URL. */
export function rowsFromLedger(ledger: LedgerRecord): LedgerExportRow[] {
  const rows: LedgerExportRow[] = Object.entries(ledger).map(([url, row]) => ({
    url,
    stage: typeof row?.stage === "string" ? row.stage : "saved",
    added: typeof row?.added === "string" ? row.added : "",
    meta: row?.meta ?? null,
  }));
  const stampKey = (r: LedgerExportRow) => r.added || "9999-12-31";
  return rows.sort((a, b) => {
    const byDate = stampKey(a).localeCompare(stampKey(b));
    return byDate !== 0 ? byDate : a.url.localeCompare(b.url);
  });
}

/** The downloadable board, with its provenance attached. The schema string
 *  is part of the contract: entries keep the exact stage/date/metadata this
 *  browser held, and no row is dropped or rewritten. */
export function buildLedgerExport(
  ledger: LedgerRecord,
  opts: {
    owner?: LedgerOwnerStamp | null;
    currentIdentity?: LedgerIdentity | null;
    exportedAt?: Date | string;
  } = {},
): LedgerExport {
  const owner = parseStamp(opts.owner);
  const currentLogin = opts.currentIdentity ? normalizeLogin(opts.currentIdentity.login) : null;
  const when = opts.exportedAt ?? new Date();
  const exportedAt = isoOf(when);
  if (!exportedAt) throw new RangeError("buildLedgerExport: exportedAt is not a date");
  const entries = rowsFromLedger(ledger);
  return {
    schema: LEDGER_EXPORT_SCHEMA,
    exportedAt,
    owner,
    currentIdentity: currentLogin ? { login: currentLogin } : null,
    count: entries.length,
    entries,
  };
}

/** Stable file name for the download; the date comes from the export time. */
export function exportFileName(at: Date | string = new Date()): string {
  const iso = isoOf(at);
  return `cyrus-issue-board-${iso ? iso.slice(0, 10) : "undated"}.json`;
}
