/* ══ api.ts — thin fetch client for the Next API routes ═════════
   Same-origin, so the httpOnly session cookie rides along on every
   call. Every function returns null (or false) when the backend is
   offline or the session isn't there - callers keep localStorage as
   the source of truth and treat the server as a sync layer.       ═ */

export type ServerUser = {
  id: string; name: string; login: string | null;
  email: string | null; picture: string | null; provider: string;
};
export type SavedRow = { itemType: string; itemId: string; title?: string | null };
export type EmailStartRes = {
  ok: boolean; sent?: boolean; demo?: boolean; code?: string; challenge?: string | null;
  reason?: string; error?: string; expires_in_seconds?: number;
};
export type Health = {
  ok: boolean; db: boolean; auth: boolean;
  /** can this server finish a Google / GitHub sign-in (booleans, never keys) */
  google?: boolean; github?: boolean; captcha?: boolean;
  /** email sign-in: no key, a key with no verified sender, or ready */
  email?: "missing_key" | "unverified_from" | "ok";
};
export type EmailVerifyRes = {
  ok: boolean; user?: ServerUser; offline?: boolean; reason?: string; challenge?: string | null;
};
export type AppRow = {
  id: string; kind: "program" | "hackathon"; targetId: string; targetTitle: string | null;
  status: string; notes?: unknown; createdAt: string; updatedAt: string;
};

const JSON_INIT: RequestInit = { headers: { "content-type": "application/json" }, credentials: "same-origin" };

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { credentials: "same-origin" });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

async function postJson<T>(url: string, body: unknown, method: "POST" | "PATCH" | "DELETE" = "POST"): Promise<T | null> {
  try {
    const r = await fetch(url, { ...JSON_INIT, method, body: JSON.stringify(body) });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

async function fire(url: string, body: unknown, method: "POST" | "DELETE"): Promise<boolean> {
  try {
    const r = await fetch(url, { ...JSON_INIT, method, body: JSON.stringify(body) });
    return r.ok;
  } catch {
    return false;
  }
}

export const api = {
  health: () => getJson<Health>("/api/health"),
  me: () => getJson<{ user: ServerUser | null }>("/api/me"),
  logout: () => fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).then((r) => r.ok).catch(() => false),

  authGithub: (code: string, verifier: string) =>
    postJson<{ ok: true; user: ServerUser }>("/api/auth/github", { code, verifier }),
  authGoogle: (idToken: string) => postJson<{ ok: true; user: ServerUser }>("/api/auth/google", { idToken }),

  emailStart: (email: string, turnstile?: string) =>
    postJson<EmailStartRes>("/api/auth/email/start", { email, turnstile }),
  emailVerify: (email: string, code: string, name?: string, challenge?: string) =>
    postJson<EmailVerifyRes>("/api/auth/email/verify", { email, code, name, challenge }),

  savedList: () => getJson<{ items: SavedRow[] }>("/api/me/saved"),
  savedAdd: (itemType: string, itemId: string, title?: string) =>
    fire("/api/me/saved", { itemType, itemId, title }, "POST"),
  savedRemove: (itemType: string, itemId: string) =>
    fire("/api/me/saved", { itemType, itemId }, "DELETE"),

  submit: (kind: string, payload: unknown, extra?: { name?: string; email?: string }) =>
    postJson<{ ok: true; id: string }>("/api/submissions", { kind, payload, ...extra }),

  appList: () => getJson<{ applications: AppRow[] }>("/api/me/applications"),
  appUpsert: (kind: string, targetId: string, targetTitle?: string) =>
    postJson<{ application: AppRow }>("/api/me/applications", { kind, targetId, targetTitle }),
  appPatch: (id: string, patch: { status?: string; notes?: unknown }) =>
    postJson<{ application: AppRow }>("/api/me/applications", { id, ...patch }, "PATCH"),
  appDelete: (id: string) => postJson<{ ok: boolean }>("/api/me/applications", { id }, "DELETE"),
};

/* What this deploy can do, asked once per page load. `/api/health` answers
   with booleans only, so the sign-in sheet and the OAuth helpers can tell the
   difference between "the server will finish this" and "this button has no
   backend yet" instead of discovering it from a failed request. */
let healthCache: Promise<Health | null> | null = null;
export const getHealth = (): Promise<Health | null> => (healthCache ??= api.health());

/** can the server mint a real session cookie? (a database is not required) */
export async function serverAuthReady(): Promise<boolean> {
  return Boolean((await getHealth())?.auth);
}

/** can this server complete a provider's exchange, secret and all? */
export async function providerReady(p: "google" | "github"): Promise<boolean> {
  const h = await getHealth();
  return Boolean(h?.auth && h?.[p]);
}
