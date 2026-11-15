/* ══ email.ts — email sign-in verification codes ══════════════════════
   A 6-digit one-time code is generated with crypto.randomInt, stored as a
   sha256 hash (10-minute TTL, 6 tries, 30s resend lock) and delivered via
   the Resend HTTP API through plain fetch - no SDK, no new dependency.
   Storage prefers the Neon email_codes table. Without DATABASE_URL the code
   hash travels back to the browser inside an HMAC-signed envelope (needs
   SESSION_SECRET), because a serverless verify request usually lands on an
   instance that never saw the start request - a plain in-memory Map would
   strand it there. The Map stays as the last resort so the flow also works
   with neither variable. Without RESEND_API_KEY the routes run in demo mode
   and hand the code back to the UI instead of emailing it.            ═ */
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { emailCodes } from "../db/schema";

const TTL_MS = 10 * 60 * 1000;
const MAX_TRIES = 6;
const RESEND_LOCK_MS = 30 * 1000;

export type CodeResult = { ok: true } | { ok: false; reason: "too_soon" | "expired" | "wrong" | "no_code" | "locked" };

export const validEmail = (e: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim().toLowerCase()) && e.trim().length <= 254;

export const normalizeEmail = (e: string): string => e.trim().toLowerCase();

export function genCode(): string {
  return randomInt(100000, 999999).toString();
}

const hash = (code: string): string => createHash("sha256").update(code).digest("hex");

/* ── in-memory fallback (no DATABASE_URL) ───────────────────────────── */
type Mem = { codeHash: string; expiresAt: number; tries: number; lastSent: number };
const mem = new Map<string, Mem>();

/** true when we can actually store+send; demo mode is handled by the caller */
export const dbBacked = (): boolean => Boolean(getDb());

/** store a fresh code. Returns false when the 30s resend lock is still on. */
export async function storeCode(email: string, code: string): Promise<boolean> {
  const now = Date.now();
  const db = getDb();
  if (db) {
    const rows = await db.select().from(emailCodes).where(eq(emailCodes.email, email)).limit(1);
    const existing = rows[0];
    if (existing) {
      const lastSentMs = new Date(existing.createdAt).getTime();
      if (now - lastSentMs < RESEND_LOCK_MS && existing.expiresAt.getTime() > now) return false;
      await db.update(emailCodes)
        .set({ codeHash: hash(code), expiresAt: new Date(now + TTL_MS), tries: 0, createdAt: new Date(now) })
        .where(eq(emailCodes.email, email));
      return true;
    }
    await db.insert(emailCodes).values({
      email, codeHash: hash(code), expiresAt: new Date(now + TTL_MS), tries: 0, createdAt: new Date(now),
    });
    return true;
  }
  const m = mem.get(email);
  if (m && now - m.lastSent < RESEND_LOCK_MS && m.expiresAt > now) return false;
  mem.set(email, { codeHash: hash(code), expiresAt: now + TTL_MS, tries: 0, lastSent: now });
  return true;
}

export async function checkCode(
  email: string, code: string, challenge?: string,
): Promise<CodeResult & { challenge?: string | null }> {
  const now = Date.now();
  const db = getDb();
  if (db) {
    const rows = await db.select().from(emailCodes).where(eq(emailCodes.email, email)).limit(1);
    const r = rows[0];
    if (!r) return { ok: false, reason: "no_code" };
    if (r.expiresAt.getTime() < now) {
      await db.delete(emailCodes).where(eq(emailCodes.email, email));
      return { ok: false, reason: "expired" };
    }
    if (r.tries >= MAX_TRIES) {
      await db.delete(emailCodes).where(eq(emailCodes.email, email));
      return { ok: false, reason: "locked" };
    }
    if (r.codeHash === hash(code)) {
      await db.delete(emailCodes).where(eq(emailCodes.email, email));
      return { ok: true };
    }
    await db.update(emailCodes).set({ tries: r.tries + 1 }).where(eq(emailCodes.email, email));
    return { ok: false, reason: "wrong" };
  }
  /* No table: a signed envelope from this client beats this instance's
     memory, because the start request may well have been served elsewhere. */
  if (challenge && secret().length >= 16) {
    const r = checkEnvelope(email, code, challenge);
    if (r.res.ok) return r.res;
    if (r.res.reason === "wrong") return { ...r.res, challenge: r.challenge };
    if (r.res.reason !== "no_code") return { ...r.res, challenge: null };
  }
  const m = mem.get(email);
  if (!m) return { ok: false, reason: "no_code" };
  if (m.expiresAt < now) { mem.delete(email); return { ok: false, reason: "expired" }; }
  if (m.tries >= MAX_TRIES) { mem.delete(email); return { ok: false, reason: "locked" }; }
  if (m.codeHash === hash(code)) { mem.delete(email); return { ok: true }; }
  m.tries += 1;
  return { ok: false, reason: "wrong" };
}

/** active code window for an email, used for resend countdowns and cleanup */
export async function dropCode(email: string): Promise<void> {
  const db = getDb();
  if (db) { await db.delete(emailCodes).where(eq(emailCodes.email, email)); return; }
  mem.delete(email);
}

/* exported for tests: the raw memory store so cases can reset between runs */
export const __mem = mem;

/* ── stateless envelope (no DATABASE_URL) ─────────────────────────────
   { email, code hash, expiry, tries, id } signed with HMAC-SHA256 over
   SESSION_SECRET. The browser holds it between the two steps and hands it
   back on verify, so any instance can check the code it was issued for.
   The envelope never contains the code - only its hash - and the try
   counter is re-signed on every miss. Strict single-use (retiring an
   envelope the moment it is spent) needs the table; here spent ids are
   remembered per instance as well, which is enough to stop casual replay.
   ─────────────────────────────────────────────────────────────────── */
type Envelope = { e: string; h: string; x: number; t: number; j: string };
const spent = new Set<string>();

const secret = (): string => (process.env.SESSION_SECRET ?? "").trim();

/** the signed-envelope path is used only when there is no table to fall back on */
export const envelopeReady = (): boolean => !dbBacked() && secret().length >= 16;

const mac = (body: string): string => createHmac("sha256", secret()).update(body).digest("base64url");

const pack = (env: Envelope): string => {
  const body = Buffer.from(JSON.stringify(env)).toString("base64url");
  return `${body}.${mac(body)}`;
};

function unpack(token: string): Envelope | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const want = Buffer.from(mac(body));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const env = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Envelope;
    return typeof env.e === "string" && typeof env.h === "string" ? env : null;
  } catch {
    return null;
  }
}

/** sign a fresh envelope for this address + code (null when unusable) */
export function issueEnvelope(email: string, code: string): string | null {
  if (!envelopeReady()) return null;
  return pack({ e: email, h: hash(code), x: Date.now() + TTL_MS, t: 0, j: randomBytes(9).toString("base64url") });
}

/** check a code against an envelope; returns a re-signed one when it missed.
   Re-signing rotates the id, which retires the token the client was holding. */
export function checkEnvelope(email: string, code: string, token: string): { res: CodeResult; challenge: string | null } {
  const env = unpack(token);
  if (!env || env.e !== email || spent.has(env.j)) return { res: { ok: false, reason: "no_code" }, challenge: null };
  const now = Date.now();
  if (env.x < now) { spent.add(env.j); return { res: { ok: false, reason: "expired" }, challenge: null }; }
  if (env.t >= MAX_TRIES) { spent.add(env.j); return { res: { ok: false, reason: "locked" }, challenge: null }; }
  if (env.h === hash(code)) { spent.add(env.j); return { res: { ok: true }, challenge: null }; }
  const next = { ...env, t: env.t + 1, j: randomBytes(9).toString("base64url") };
  spent.add(env.j);
  return { res: { ok: false, reason: "wrong" }, challenge: pack(next) };
}

/** exported for tests: the spent-id ledger */
export const __spent = spent;

/* ── sending via Resend (fetch only) ────────────────────────────────── */
export type SendResult = { sent: true } | { sent: false; demo: true; code: string } | { sent: false; error: string };

const TEST_FROM = "cyrus.ai <onboarding@resend.dev>";

/** "missing_key" = demo mode, "unverified_from" = key but no sender Resend will
   deliver from (EMAIL_FROM unset, or still the shared testing address),
   "ok" = key plus an EMAIL_FROM. Whether the domain is really verified is only
   known to Resend. */
export type EmailStatus = "missing_key" | "unverified_from" | "ok";

export function emailStatus(): EmailStatus {
  if (!(process.env.RESEND_API_KEY ?? "").trim()) return "missing_key";
  const from = (process.env.EMAIL_FROM ?? "").trim();
  if (!from || from.toLowerCase().includes("@resend.dev")) return "unverified_from";
  return "ok";
}

/** short, safe reason from a Resend error response. Only the `name` and
   `message` fields are used, any email address in the message is masked
   (Resend can echo the recipient or the account owner) and the result is
   capped. The raw body never leaves this function, and a body that is not
   JSON falls back to a generic line instead of throwing. */
async function resendReason(r: Response): Promise<string> {
  const generic = `resend rejected the request (${r.status})`;
  try {
    const j = (await r.json()) as { name?: unknown; message?: unknown } | null;
    const name = typeof j?.name === "string" ? j.name.trim() : "";
    const message = typeof j?.message === "string"
      ? j.message.replace(/[^\s<>()"',;:]+@[^\s<>()"',;:]+/g, "[address]").trim()
      : "";
    const reason = [name, message].filter(Boolean).join(": ").slice(0, 200);
    return reason ? `resend ${r.status}: ${reason}` : generic;
  } catch {
    return generic;
  }
}

export async function sendCodeEmail(email: string, code: string): Promise<SendResult> {
  const key = (process.env.RESEND_API_KEY ?? "").trim();
  email = email.trim();
  if (!key) return { sent: false, demo: true, code }; // demo mode: caller shows the code
  /* Resend's testing sender only reaches the account owner, so it is a local
     convenience. In production an unset EMAIL_FROM is a config error. */
  const from = (process.env.EMAIL_FROM ?? "").trim();
  if (!from && process.env.NODE_ENV === "production") {
    return { sent: false, error: "email not configured: EMAIL_FROM must be a sender on a domain verified in Resend" };
  }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: from || TEST_FROM,
        to: [email],
        subject: `${code} is your cyrus.ai sign-in code`,
        text: `Your cyrus.ai verification code is ${code}. It expires in 10 minutes. ` +
          `If you didn't ask to sign in, ignore this email.\n\n— cyrus.ai, the agent skill index`,
        html: `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;background:#f5efe7;padding:32px">
  <div style="max-width:440px;margin:0 auto;background:#fff;border:1px solid #e7dccd;border-radius:16px;padding:28px">
    <div style="font-weight:800;font-size:15px;color:#241b13;letter-spacing:.02em">cyrus.ai</div>
    <p style="color:#241b13;font-size:14px;margin:16px 0 8px">Your verification code is</p>
    <div style="font-family:ui-monospace,Menlo,monospace;font-size:34px;font-weight:700;letter-spacing:.28em;color:#b4602c;margin:8px 0 16px">${code}</div>
    <p style="color:#6e6153;font-size:13px;margin:0">It expires in 10 minutes. If you didn't ask to sign in to cyrus.ai, you can safely ignore this email.</p>
  </div>
</div>`,
      }),
    });
    if (!r.ok) return { sent: false, error: await resendReason(r) };
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : "send failed" };
  }
}
