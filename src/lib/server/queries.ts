/* ══ queries.ts — data access + validation for the API routes ══
   Small, honest helpers: every function assumes the caller already
   checked backendReady() / requireUser(). Kept separate from the route
   files so the unit tests (vitest) can import them without Next.    ═ */
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  applications, repos as reposTable, savedItems, submissions,
  type ApplicationRow, type SavedItemRow,
} from "../db/schema";

/* Saved items and applications cover what the site has pages for now:
   repositories, organizations, programs and issues. Rows written before
   the rebuild can still carry a retired type ("hackathon", "resource",
   "artifact"); they read back untouched, they just cannot be created. */
export const ITEM_TYPES = ["repo", "org", "program", "issue"] as const;
export type ItemType = (typeof ITEM_TYPES)[number];
export const APP_KINDS = ["program"] as const;
export const APP_STATUSES = ["drafting", "roadmap", "drafting_done", "submitted", "interview", "accepted", "rejected"] as const;
export const SUBMISSION_KINDS = ["org_nomination", "data_fix", "feedback", "newsletter"] as const;

const ok = (v: unknown, list: readonly string[]) => typeof v === "string" && (list as readonly string[]).includes(v);
export const validItemType = (v: unknown): v is ItemType => ok(v, ITEM_TYPES);
export const validAppKind = (v: unknown): v is (typeof APP_KINDS)[number] => ok(v, APP_KINDS);
export const validAppStatus = (v: unknown): v is (typeof APP_STATUSES)[number] => ok(v, APP_STATUSES);
export const validSubmissionKind = (v: unknown): v is (typeof SUBMISSION_KINDS)[number] => ok(v, SUBMISSION_KINDS);
export const validId = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 200;
export const smallJson = (v: unknown): boolean => {
  if (v == null) return true;
  if (typeof v !== "object") return false;
  try { return JSON.stringify(v).length <= 8000; } catch { return false; }
};
export const validEmail = (v: unknown): v is string => typeof v === "string" && /^[^@\s]+@[^@\s.]+\.[^@\s]{2,}$/.test(v) && v.length <= 200;

/* ── saved items ─────────────────────────────────────────────── */

export async function listSaved(userId: string): Promise<SavedItemRow[]> {
  const db = getDb()!;
  return db.select().from(savedItems).where(eq(savedItems.userId, userId)).orderBy(desc(savedItems.createdAt));
}

export async function addSaved(userId: string, itemType: ItemType, itemId: string, title?: string | null, meta?: unknown) {
  const db = getDb()!;
  const rows = await db
    .insert(savedItems)
    .values({ userId, itemType, itemId, title: title ?? null, meta: smallJson(meta) ? (meta as object) ?? null : null })
    .onConflictDoNothing({ target: [savedItems.userId, savedItems.itemType, savedItems.itemId] })
    .returning();
  return rows[0] ?? (await listSaved(userId)).find((r) => r.itemType === itemType && r.itemId === itemId) ?? null;
}

export async function removeSaved(userId: string, itemType: ItemType, itemId: string): Promise<boolean> {
  const db = getDb()!;
  const rows = await db
    .delete(savedItems)
    .where(and(eq(savedItems.userId, userId), eq(savedItems.itemType, itemType), eq(savedItems.itemId, itemId)))
    .returning({ id: savedItems.id });
  return rows.length > 0;
}

/* ── applications ────────────────────────────────────────────── */

export async function listApplications(userId: string): Promise<ApplicationRow[]> {
  const db = getDb()!;
  return db.select().from(applications).where(eq(applications.userId, userId)).orderBy(desc(applications.updatedAt));
}

export async function upsertApplication(userId: string, kind: (typeof APP_KINDS)[number], targetId: string, targetTitle?: string | null, notes?: unknown) {
  const db = getDb()!;
  const rows = await db
    .insert(applications)
    .values({ userId, kind, targetId, targetTitle: targetTitle ?? null, notes: smallJson(notes) ? (notes as object) ?? null : null })
    .onConflictDoUpdate({
      target: [applications.userId, applications.kind, applications.targetId],
      set: { updatedAt: new Date(), ...(targetTitle ? { targetTitle } : {}) },
    })
    .returning();
  return rows[0];
}

export async function patchApplication(userId: string, id: string, patch: { status?: string; notes?: unknown }) {
  const db = getDb()!;
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.status) set.status = patch.status;
  if (patch.notes !== undefined && smallJson(patch.notes)) set.notes = patch.notes;
  const rows = await db
    .update(applications)
    .set(set)
    .where(and(eq(applications.id, id), eq(applications.userId, userId)))
    .returning();
  return rows[0] ?? null;
}

export async function deleteApplication(userId: string, id: string): Promise<boolean> {
  const db = getDb()!;
  const rows = await db
    .delete(applications)
    .where(and(eq(applications.id, id), eq(applications.userId, userId)))
    .returning({ id: applications.id });
  return rows.length > 0;
}

/* ── public submissions ──────────────────────────────────────── */

export async function addSubmission(input: { kind: (typeof SUBMISSION_KINDS)[number]; name?: string | null; email?: string | null; payload: unknown }) {
  const db = getDb()!;
  const rows = await db
    .insert(submissions)
    .values({ kind: input.kind, name: input.name ?? null, email: input.email ?? null, payload: input.payload as object })
    .returning({ id: submissions.id, kind: submissions.kind, createdAt: submissions.createdAt });
  return rows[0];
}

/* ── catalog: counts + repo listing ──────────────────────────── */

export async function catalogCounts() {
  const db = getDb()!;
  type CountTable = "repos" | "orgs" | "program_projects";
  const one = (table: CountTable) => rowCount(db, table);
  const [reposN, orgsN, projectsN] = await Promise.all([
    one("repos"), one("orgs"), one("program_projects"),
  ]);
  return { repos: reposN, orgs: orgsN, programProjects: projectsN };
}

async function rowCount(db: NonNullable<ReturnType<typeof getDb>>, table: "repos" | "orgs" | "program_projects"): Promise<number> {
  const q = sql`select count(*)::int as n from ${sql.raw(`"${table}"`)}`;
  const res = await (db as unknown as { execute: (s: unknown) => Promise<unknown> }).execute(q);
  const row = (Array.isArray(res) ? res[0] : res) as { n: number } | undefined;
  return Number(row?.n ?? 0);
}

export type RepoQuery = {
  cat?: string; q?: string; domain?: string; model?: string; format?: string; framework?: string;
  page?: number; perPage?: number;
};

export async function queryRepos(params: RepoQuery) {
  const db = getDb()!;
  const page = Math.max(1, params.page ?? 1);
  const per = Math.min(60, Math.max(1, params.perPage ?? 24));
  const conds = [];
  if (params.cat) conds.push(eq(reposTable.cat, params.cat));
  if (params.q) {
    const like = `%${params.q.replace(/[%_]/g, "")}%`;
    conds.push(or(ilike(reposTable.fullName, like), ilike(reposTable.description, like)));
  }
  if (params.domain) conds.push(sql`${reposTable.domain} && ARRAY[${params.domain}::text]`);
  if (params.model) conds.push(sql`${reposTable.models} && ARRAY[${params.model}::text]`);
  if (params.format) conds.push(eq(reposTable.format, params.format));
  if (params.framework) conds.push(sql`${reposTable.frameworks} && ARRAY[${params.framework}::text]`);
  const where = conds.length ? and(...conds) : undefined;
  const base = db.select().from(reposTable);
  const countBase = db.select({ count: sql<number>`count(*)::int` }).from(reposTable);
  const [rows, countRes] = await Promise.all([
    (where ? base.where(where) : base)
      .orderBy(desc(reposTable.stars))
      .limit(per)
      .offset((page - 1) * per),
    where ? countBase.where(where) : countBase,
  ]);
  const total = Number(countRes[0]?.count ?? 0);
  return { rows, total };
}
