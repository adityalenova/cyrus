/* ══ auth.ts — server-side sessions + user upsert ═══════════════════
   Sessions are stateless signed JWTs (jose) kept in an httpOnly cookie,
   so no extra table is needed and the Neon HTTP driver stays request-scoped.
   SESSION_SECRET alone is enough to finish a sign-in: with no DATABASE_URL
   the user is described by the provider's own verified claims rather than a
   row, and the database only adds cross-device saved items on top. Without
   SESSION_SECRET every route treats the backend as offline (503) and the
   frontend keeps working on localStorage.                            ═ */
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { users, type UserRow } from "../db/schema";

const COOKIE = "cyrus.session";
const MONTH = 30 * 86400;

export type SessionUser = { uid: string; name: string; provider: string };
export type PublicUser = { id: string; name: string; login: string | null; email: string | null; picture: string | null; provider: string };

export const publicUser = (u: UserRow): PublicUser => ({
  id: u.id, name: u.name, login: u.login, email: u.email, picture: u.picture, provider: u.provider,
});

function secretKey(): Uint8Array | null {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) return null;
  return new TextEncoder().encode(s);
}

/** true only when both halves of the backend can actually work */
export function backendReady(): boolean {
  return Boolean(secretKey()) && Boolean(process.env.DATABASE_URL);
}

/** true when the deploy can sign a session cookie. The database is not part
    of this: it adds cross-device saved items, it is not what makes a sign-in
    complete, and plenty of deploys (including this one) run without it. */
export function sessionsReady(): boolean {
  return Boolean(secretKey());
}

/** can /api/auth/google finish a sign-in on this server? */
export const googleReady = (): boolean =>
  sessionsReady() && Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);

/** can /api/auth/github finish a sign-in? Needs the app id and its secret. */
export const githubReady = (): boolean =>
  sessionsReady() &&
  Boolean(process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);

export const OFFLINE = () => Response.json({ error: "backend offline" }, { status: 503 });

export type ProviderIdentity = {
  provider: "google" | "github" | "email"; providerId: string;
  login?: string | null; name: string; email?: string | null; picture?: string | null;
};

/** the id a deploy without a database gives an identity: the provider's own
    stable subject, so the same account resolves to the same id everywhere */
export const identityId = (p: ProviderIdentity) => `${p.provider}:${p.providerId}`;

/** Complete a sign-in: store the user when there is a database, then always
    mint the httpOnly session cookie from SESSION_SECRET. Returns the shape
    the client renders. */
export async function issueSession(p: ProviderIdentity): Promise<PublicUser> {
  const db = getDb();
  if (db) {
    const row = await upsertUser(p);
    await setSession({ uid: row.id, name: row.name, provider: row.provider });
    return publicUser(row);
  }
  const uid = identityId(p);
  await setSession({ uid, name: p.name, provider: p.provider });
  return {
    id: uid, name: p.name, login: p.login ?? null,
    email: p.email ?? null, picture: p.picture ?? null, provider: p.provider,
  };
}

export async function setSession(user: SessionUser): Promise<void> {
  const key = secretKey();
  if (!key) throw new Error("SESSION_SECRET is missing or too short (needs 16+ chars)");
  const token = await new SignJWT({ name: user.name, provider: user.provider })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.uid)
    .setIssuer("cyrus.ai")
    .setIssuedAt()
    .setExpirationTime(`${MONTH}s`)
    .sign(key);
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: MONTH,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export async function readSession(): Promise<SessionUser | null> {
  const key = secretKey();
  if (!key) return null;
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key, { issuer: "cyrus.ai" });
    if (!payload.sub) return null;
    return { uid: payload.sub, name: String(payload.name ?? ""), provider: String(payload.provider ?? "") };
  } catch {
    return null;
  }
}

/** session cookie -> fresh user row from the database (null if gone) */
export async function currentUser(): Promise<UserRow | null> {
  const s = await readSession();
  if (!s) return null;
  const db = getDb();
  if (!db) return null;
  const rows = await db.select().from(users).where(eq(users.id, s.uid)).limit(1);
  return rows[0] ?? null;
}

/** session cookie -> the public shape, from the row when a database exists
    and from the signed claims when it does not. /api/me uses this so a cookie
    this server minted is always worth reading back. */
export async function currentPublicUser(): Promise<PublicUser | null> {
  const row = await currentUser();
  if (row) return publicUser(row);
  const s = await readSession();
  if (!s || getDb()) return null;
  return { id: s.uid, name: s.name, login: null, email: null, picture: null, provider: s.provider };
}

export async function upsertUser(input: {
  provider: "google" | "github" | "email"; providerId: string;
  login?: string | null; name: string; email?: string | null; picture?: string | null;
}): Promise<UserRow> {
  const db = getDb();
  if (!db) throw new Error("db offline");
  const values = {
    provider: input.provider, providerId: input.providerId,
    login: input.login ?? null, name: input.name,
    email: input.email ?? null, picture: input.picture ?? null,
  };
  const rows = await db
    .insert(users)
    .values(values)
    .onConflictDoUpdate({ target: [users.provider, users.providerId], set: values })
    .returning();
  return rows[0];
}
