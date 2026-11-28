/* ══ server/discussions.ts — the discussion tables, read and written ═══
   Data access for #195. The shape rules (depth, ordering, what a body may
   contain, how a vote moves a tally) all come from src/lib/discussions.ts;
   this file only moves rows between those rules and Postgres, in the one
   style the rest of the backend uses: small awaited helpers that assume
   backendReady() and a signed-in user were checked by the caller.      ═ */
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "../db";
import {
  comments, commentVotes, discussions,
  type CommentRow, type DiscussionRow, type UserRow,
} from "../db/schema";
import {
  MAX_DEPTH, applyVote, clampTitle, cleanBody, excerpt, safeHref, validBody,
  type ProjectKind, type RawComment, type ThreadHead, type VoteValue,
} from "../discussions";

const PAGE = 50;

export interface ThreadPage {
  head: ThreadHead;
  url: string | null;
  comments: RawComment[];
}

const ms = (d: Date | string | null | undefined) => (d ? new Date(d).getTime() : 0);
const kind = (v: string): ProjectKind => (v === "program" || v === "org" ? v : "repo");

/** the opening post of each thread, so the list can quote it without a join */
async function openings(ids: string[]): Promise<Map<string, CommentRow>> {
  if (!ids.length) return new Map();
  const db = getDb()!;
  const rows = await db
    .select()
    .from(comments)
    .where(and(inArray(comments.discussionId, ids), isNull(comments.parentId)))
    .orderBy(asc(comments.createdAt));
  const map = new Map<string, CommentRow>();
  for (const r of rows) if (!map.has(r.discussionId)) map.set(r.discussionId, r);
  return map;
}

function head(d: DiscussionRow, root?: CommentRow): ThreadHead {
  return {
    id: d.id,
    projectId: d.projectId,
    projectKind: kind(d.projectKind),
    title: d.title,
    author: root?.authorName || d.authorName,
    authorLogin: root?.authorLogin ?? d.authorLogin,
    replies: d.replies,
    score: root ? root.upvotes - root.downvotes : 0,
    pinned: d.pinned,
    locked: d.locked,
    createdAt: ms(d.createdAt),
    lastCommentAt: ms(d.lastCommentAt),
    opening: root ? excerpt(root.body) : "",
  };
}

/* ── reading ─────────────────────────────────────────────────────── */

export async function listThreads(projectKind: ProjectKind, projectId: string): Promise<ThreadHead[]> {
  const db = getDb()!;
  const heads = await db
    .select()
    .from(discussions)
    .where(and(eq(discussions.projectKind, projectKind), eq(discussions.projectId, projectId)))
    .orderBy(desc(discussions.pinned), desc(discussions.lastCommentAt))
    .limit(PAGE);
  const roots = await openings(heads.map((d) => d.id));
  return heads.map((d) => head(d, roots.get(d.id)));
}

/** one thread plus its comments, oldest first; the tree is built by the caller */
export async function readThread(id: string, userId: string | null): Promise<ThreadPage | null> {
  const db = getDb()!;
  const [row] = await db.select().from(discussions).where(eq(discussions.id, id)).limit(1);
  if (!row) return null;
  const rows = await db.select().from(comments).where(eq(comments.discussionId, id)).orderBy(asc(comments.createdAt));
  const mine = userId && rows.length
    ? await db.select().from(commentVotes).where(and(eq(commentVotes.userId, userId), inArray(commentVotes.commentId, rows.map((r) => r.id))))
    : [];
  const voted = new Map(mine.map((v) => [v.commentId, v.value as VoteValue]));
  const root = rows.find((r) => !r.parentId);
  return {
    head: head(row, root),
    url: root ? safeHref(pickUrl(root.body)) : null,
    comments: rows.map((r) => ({
      id: r.id,
      parentId: r.parentId,
      author: r.authorName,
      authorLogin: r.authorLogin,
      body: r.body,
      createdAt: ms(r.createdAt),
      upvotes: r.upvotes,
      downvotes: r.downvotes,
      myVote: voted.get(r.id) ?? 0,
      flagged: r.flagged,
      flagReason: r.flagReason,
    })),
  };
}

/** the first link in a body, for the "linked resource" line under the opening post */
function pickUrl(body: string): string {
  const m = /https?:\/\/[^\s<>"'`()[\]]+/.exec(body);
  return m ? m[0] : "";
}

/* ── writing ─────────────────────────────────────────────────────── */

export type WriteResult = { ok: true; id: string } | { error: string; status: number };

export async function createThread(input: {
  projectKind: ProjectKind;
  projectId: string;
  title: string;
  body: string;
  user: UserRow;
}): Promise<WriteResult> {
  const title = clampTitle(input.title);
  const body = cleanBody(input.body);
  if (!title) return { error: "a discussion needs a title", status: 400 };
  if (!validBody(body)) return { error: "write something to reply to", status: 400 };
  const db = getDb()!;
  const [row] = await db
    .insert(discussions)
    .values({
      projectId: input.projectId,
      projectKind: input.projectKind,
      title,
      authorId: input.user.id,
      authorName: input.user.name,
      authorLogin: input.user.login,
    })
    .returning({ id: discussions.id });
  const opened = await db
    .insert(comments)
    .values({
      discussionId: row.id,
      parentId: null,
      authorId: input.user.id,
      authorName: input.user.name,
      authorLogin: input.user.login,
      body,
    })
    .returning({ id: comments.id });
  return { ok: true, id: opened[0]?.id ?? row.id };
}

/** how deep a comment sits: 0 for an opening post, capped walk up the chain */
async function depthOf(db: NonNullable<ReturnType<typeof getDb>>, id: string | null): Promise<number> {
  let depth = 0;
  let cursor = id;
  while (cursor && depth < MAX_DEPTH + 2) {
    const [row] = await db.select({ parentId: comments.parentId }).from(comments).where(eq(comments.id, cursor)).limit(1);
    if (!row) break;
    cursor = row.parentId;
    depth += 1;
  }
  return depth;
}

export async function addReply(input: {
  discussionId: string;
  parentId: string | null;
  body: string;
  user: UserRow;
}): Promise<WriteResult> {
  const body = cleanBody(input.body);
  if (!validBody(body)) return { error: "write something first", status: 400 };
  const db = getDb()!;
  const [thread] = await db.select().from(discussions).where(eq(discussions.id, input.discussionId)).limit(1);
  if (!thread) return { error: "that discussion is gone", status: 404 };
  if (thread.locked) return { error: "this thread is closed to new replies", status: 403 };

  let parentId = input.parentId;
  if (parentId) {
    const [parent] = await db.select().from(comments).where(eq(comments.id, parentId)).limit(1);
    if (!parent || parent.discussionId !== thread.id) return { error: "that comment is not in this thread", status: 400 };
    // past the third level the reply joins its parent's parent instead of vanishing
    if ((await depthOf(db, parent.id)) >= MAX_DEPTH) parentId = parent.parentId;
  }

  const [row] = await db
    .insert(comments)
    .values({
      discussionId: thread.id,
      parentId,
      authorId: input.user.id,
      authorName: input.user.name,
      authorLogin: input.user.login,
      body,
    })
    .returning({ id: comments.id });
  await db
    .update(discussions)
    .set({ replies: thread.replies + 1, lastCommentAt: new Date() })
    .where(eq(discussions.id, thread.id));
  return { ok: true, id: row.id };
}

/** the reader's own arrow: stored once per comment, counters move by the difference */
export async function setVote(input: { commentId: string; value: VoteValue; user: UserRow }): Promise<
  { ok: true; upvotes: number; downvotes: number; myVote: VoteValue } | { error: string; status: number }
> {
  const db = getDb()!;
  const [row] = await db.select().from(comments).where(eq(comments.id, input.commentId)).limit(1);
  if (!row) return { error: "that comment is gone", status: 404 };
  const [prior] = await db
    .select()
    .from(commentVotes)
    .where(and(eq(commentVotes.commentId, row.id), eq(commentVotes.userId, input.user.id)))
    .limit(1);
  const next = applyVote({ upvotes: row.upvotes, downvotes: row.downvotes, myVote: (prior?.value as VoteValue) ?? 0 }, input.value);

  await db
    .update(comments)
    .set({ upvotes: next.upvotes, downvotes: next.downvotes })
    .where(eq(comments.id, row.id));
  if (input.value === 0) {
    if (prior) await db.delete(commentVotes).where(eq(commentVotes.id, prior.id));
  } else if (prior) {
    await db.update(commentVotes).set({ value: input.value }).where(eq(commentVotes.id, prior.id));
  } else {
    await db.insert(commentVotes).values({ commentId: row.id, userId: input.user.id, value: input.value });
  }
  return { ok: true, ...next };
}

export async function setFlag(input: { commentId: string; reason: string }): Promise<{ ok: true } | { error: string; status: number }> {
  const db = getDb()!;
  const [row] = await db.select({ id: comments.id }).from(comments).where(eq(comments.id, input.commentId)).limit(1);
  if (!row) return { error: "that comment is gone", status: 404 };
  await db.update(comments).set({ flagged: true, flagReason: input.reason }).where(eq(comments.id, row.id));
  return { ok: true };
}
