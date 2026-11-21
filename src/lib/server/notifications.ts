/* ══ server/notifications.ts — persistence for the SSE feed ══════════
   Data access only: every function assumes the caller already checked
   backendReady() and requireUser(), so the db is non-null here exactly as in
   queries.ts. It maps NotificationRow (a Postgres row) onto the wire shape
   the client and the pure lib agree on, and keeps ordering, read state and
   the cursor the stream resumes from in one place.                     ═ */
import { and, asc, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { getDb } from "../db";
import { notifications, type NotificationRow } from "../db/schema";
import type { NotifKind, Notification } from "../notifications";

const shape = (r: NotificationRow): Notification => ({
  id: r.id,
  kind: r.kind as NotifKind,
  title: r.title,
  body: r.body,
  href: r.href,
  read: r.read,
  createdAt: (r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt)).toISOString(),
});

/** the newest `limit` rows, oldest first so a cursor can advance forward. */
export async function listNotifications(userId: string, limit = 50): Promise<Notification[]> {
  const db = getDb()!;
  const rows = await db
    .select().from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(Math.max(1, Math.min(limit, 200)));
  return rows.reverse().map(shape);
}

export async function countUnread(userId: string): Promise<number> {
  const db = getDb()!;
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
  return row?.n ?? 0;
}

/** rows created strictly after `afterId`, oldest first - the stream tail.
    `afterId` is a createdAt cursor encoded as an ISO string.             */
export async function notificationsSince(userId: string, after: string): Promise<Notification[]> {
  const db = getDb()!;
  const rows = await db
    .select().from(notifications)
    .where(and(eq(notifications.userId, userId), gt(notifications.createdAt, new Date(after))))
    .orderBy(asc(notifications.createdAt));
  return rows.map(shape);
}

export type NewNotification = { kind: NotifKind; title: string; body: string; href: string };

/** fan one event out to a user; returns the row as it now reads. */
export async function createNotification(userId: string, input: NewNotification): Promise<Notification | null> {
  const db = getDb()!;
  const rows = await db
    .insert(notifications)
    .values({
      userId,
      kind: input.kind,
      title: input.title.slice(0, 200),
      body: input.body.slice(0, 500),
      href: input.href.slice(0, 500),
    })
    .returning();
  return rows[0] ? shape(rows[0]) : null;
}

export async function markNotificationsRead(userId: string, ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  const db = getDb()!;
  const rows = await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.userId, userId), inArray(notifications.id, ids)))
    .returning({ id: notifications.id });
  return rows.length;
}

export async function markAllNotificationsRead(userId: string): Promise<number> {
  const db = getDb()!;
  const rows = await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)))
    .returning({ id: notifications.id });
  return rows.length;
}
