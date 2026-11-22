/* == server/notificationPrefs.ts - persistence for the preferences panel ====
   Data access only. Every function assumes the caller already checked
   backendReady(), so the db is non-null here exactly as in notifications.ts.

   Two tables: notification_preferences (one row per user, written the first
   time someone changes something) and notification_outbox (email-channel
   items waiting for the next digest). The rules about what the values mean
   live in lib/notificationPrefs.ts. == */
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "../db";
import { notificationOutbox, notificationPreferences, users, type NotificationOutboxRow } from "../db/schema";
import { normalizePrefs, type Category, type Prefs } from "../notificationPrefs";

export type StoredPrefs = { prefs: Prefs; lastDigestAt: Date | null };

/** a user with no row gets the defaults; nothing is written until they change something */
export async function getStoredPrefs(userId: string): Promise<StoredPrefs> {
  const db = getDb()!;
  const rows = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId)).limit(1);
  const row = rows[0];
  return { prefs: normalizePrefs(row), lastDigestAt: row?.lastDigestAt ?? null };
}

export async function getPrefs(userId: string): Promise<Prefs> {
  return (await getStoredPrefs(userId)).prefs;
}

export async function savePrefs(userId: string, prefs: Prefs): Promise<Prefs> {
  const db = getDb()!;
  const values = {
    categories: prefs.categories,
    frequency: prefs.frequency,
    timezone: prefs.timezone,
    digestHour: prefs.digestHour,
    unsubscribedAll: prefs.unsubscribedAll,
    updatedAt: new Date(),
  };
  await db.insert(notificationPreferences).values({ userId, ...values })
    .onConflictDoUpdate({ target: notificationPreferences.userId, set: values });
  return prefs;
}

/** the one-click unsubscribe: false when the id belongs to no user. It also
 *  drops anything still waiting for a digest, so switching email off cannot be
 *  followed by one last email. The other settings are left as they were. */
export async function unsubscribeAll(userId: string): Promise<boolean> {
  const db = getDb()!;
  const found = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  if (!found[0]) return false;
  await db.insert(notificationPreferences).values({ userId, unsubscribedAll: true })
    .onConflictDoUpdate({ target: notificationPreferences.userId, set: { unsubscribedAll: true, updatedAt: new Date() } });
  await discardPending(userId);
  return true;
}

/** drop everything still waiting for a digest */
export async function discardPending(userId: string): Promise<void> {
  const db = getDb()!;
  await db.delete(notificationOutbox).where(and(eq(notificationOutbox.userId, userId), isNull(notificationOutbox.sentAt)));
}

export async function emailOf(userId: string): Promise<string | null> {
  const db = getDb()!;
  const rows = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  return rows[0]?.email ?? null;
}

/* -- the outbox ----------------------------------------------------------- */

export type OutboxInput = { category: Category; title: string; body: string; href: string };

export async function enqueue(userId: string, input: OutboxInput): Promise<void> {
  const db = getDb()!;
  await db.insert(notificationOutbox).values({
    userId,
    category: input.category,
    title: input.title.slice(0, 200),
    body: input.body.slice(0, 500),
    href: input.href.slice(0, 500),
  });
}

/** users who have something waiting, oldest waiting first */
export async function usersWithPending(limit = 500): Promise<string[]> {
  const db = getDb()!;
  const rows = await db
    .select({ userId: notificationOutbox.userId })
    .from(notificationOutbox)
    .where(isNull(notificationOutbox.sentAt))
    .groupBy(notificationOutbox.userId)
    .orderBy(sql`min(${notificationOutbox.createdAt})`)
    .limit(limit);
  return rows.map((r) => r.userId);
}

export async function pendingFor(userId: string, limit = 50): Promise<NotificationOutboxRow[]> {
  const db = getDb()!;
  return db.select().from(notificationOutbox)
    .where(and(eq(notificationOutbox.userId, userId), isNull(notificationOutbox.sentAt)))
    .orderBy(asc(notificationOutbox.createdAt))
    .limit(Math.max(1, Math.min(limit, 200)));
}

/** Take the rows for sending. The update only matches rows still unsent, so
 *  two runs that overlap cannot both get the same row, and whatever comes back
 *  is the set this caller owns. */
export async function claim(userId: string, ids: string[], at: Date): Promise<NotificationOutboxRow[]> {
  if (!ids.length) return [];
  const db = getDb()!;
  return db.update(notificationOutbox).set({ sentAt: at })
    .where(and(eq(notificationOutbox.userId, userId), inArray(notificationOutbox.id, ids), isNull(notificationOutbox.sentAt)))
    .returning();
}

/** put claimed rows back after a failed send, so the next run tries again */
export async function release(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const db = getDb()!;
  await db.update(notificationOutbox).set({ sentAt: null }).where(inArray(notificationOutbox.id, ids));
}

export async function stampDigest(userId: string, at: Date): Promise<void> {
  const db = getDb()!;
  await db.insert(notificationPreferences).values({ userId, lastDigestAt: at })
    .onConflictDoUpdate({ target: notificationPreferences.userId, set: { lastDigestAt: at } });
}

/** the oldest unsent row's time, for someone who has never had a digest */
export async function oldestPending(userId: string): Promise<Date | null> {
  const rows = await pendingFor(userId, 1);
  const t = rows[0]?.createdAt;
  return t ? (t instanceof Date ? t : new Date(t)) : null;
}
