/* ══ discussions.ts — the rules a discussion thread lives by ═══════════
   Project pages get threaded conversations (#195). Everything that decides
   what a reader sees is here rather than in the component: which characters
   a body may contain, how markdown-lite becomes renderable tokens, how a
   flat comment table becomes a tree capped at three reply levels, how a
   vote changes a tally and how the roots are ordered.

   The body parser returns tokens, never an HTML string - the component
   maps them to elements, so a crafted comment cannot inject markup.     ═ */

export const MAX_DEPTH = 3;
export const MAX_TITLE = 140;
export const MAX_BODY = 4000;
export const PROJECT_KINDS = ["repo", "program", "org"] as const;

export type ProjectKind = (typeof PROJECT_KINDS)[number];
export type SortKey = "top" | "new" | "old";

export const validProjectKind = (v: unknown): v is ProjectKind =>
  typeof v === "string" && (PROJECT_KINDS as readonly string[]).includes(v);

export const validProjectId = (v: unknown): v is string =>
  typeof v === "string" && v.trim().length > 0 && v.length <= 200;

export const validThreadId = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f-]{8,64}$/i.test(v);

/** a comment id is the same uuid shape as a thread id */
export const validCommentId = (v: unknown): v is string => validThreadId(v);

export const clampTitle = (v: unknown): string =>
  String(v ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_TITLE);

/** control characters except newline and tab, plus the zero-width crowd */
export const cleanBody = (v: unknown): string =>
  String(v ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200d\ufeff]/g, "")
    .slice(0, MAX_BODY);

export const validBody = (v: unknown): boolean => typeof v === "string" && cleanBody(v).trim().length > 0;

/** http(s) only, and only with something that looks like a host */
export function safeHref(raw: string): string | null {
  const url = String(raw ?? "").trim().replace(/[.,;:!?)\]]+$/, "");
  if (!/^https?:\/\//i.test(url)) return null;
  try {
    const u = new URL(url);
    return u.hostname.includes(".") || u.hostname === "localhost" ? u.href : null;
  } catch {
    return null;
  }
}

export interface Token {
  t: "text" | "bold" | "italic" | "code" | "link" | "break";
  v: string;
  href?: string;
}

export interface Segment {
  kind: "p" | "code";
  /** paragraph tokens; absent on a fenced block */
  tokens?: Token[];
  /** fenced block content; absent on a paragraph */
  text?: string;
  lang?: string;
}

const INLINE =
  /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|((?<![\w_])_[^_\s](?:[^_\n]*[^_\s])?_(?![\w_]))|(\[[^[\]\n]*\]\([^()\s]+\))|(https?:\/\/[^\s<>"'`()[\]]+)/g;

const LINK = /^\[([^[\]\n]*)\]\(([^()\s]+)\)$/;

function inline(text: string): Token[] {
  const out: Token[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  INLINE.lastIndex = 0;
  while ((m = INLINE.exec(text))) {
    if (m.index > last) out.push({ t: "text", v: text.slice(last, m.index) });
    const s = m[0];
    if (s.startsWith("`")) out.push({ t: "code", v: s.slice(1, -1) });
    else if (s.startsWith("**")) out.push({ t: "bold", v: s.slice(2, -2) });
    else if (s.startsWith("_")) out.push({ t: "italic", v: s.slice(1, -1) });
    else if (s.startsWith("[")) {
      const mm = LINK.exec(s);
      const href = mm ? safeHref(mm[2]) : null;
      out.push(href ? { t: "link", v: mm![1] || href, href } : { t: "text", v: s });
    } else {
      const href = safeHref(s);
      out.push(href ? { t: "link", v: s, href } : { t: "text", v: s });
    }
    last = m.index + s.length;
  }
  if (last < text.length) out.push({ t: "text", v: text.slice(last) });
  return out;
}

/** markdown-lite -> segments: fenced blocks, paragraphs, one break per newline */
export function parseBody(src: unknown): Segment[] {
  const body = cleanBody(src);
  if (!body.trim()) return [];
  const out: Segment[] = [];
  let block: string[] = [];
  let code: string[] | null = null;
  let lang = "";

  const flush = () => {
    if (!block.length) return;
    const para = block.join("\n");
    block = [];
    const lines = para.split("\n");
    const seg: Segment = { kind: "p", tokens: [] };
    lines.forEach((ln, i) => {
      if (i) seg.tokens!.push({ t: "break", v: "\n" });
      seg.tokens!.push(...inline(ln));
    });
    out.push(seg);
  };

  for (const line of body.split("\n")) {
    const fence = /^\s*```([a-zA-Z0-9+#._-]*)\s*$/.exec(line);
    if (fence && code === null) {
      flush();
      code = [];
      lang = fence[1] || "";
      continue;
    }
    if (code !== null) {
      if (fence) {
        out.push({ kind: "code", text: code.join("\n"), lang });
        code = null;
        lang = "";
      } else code.push(line);
      continue;
    }
    if (!line.trim()) flush();
    else block.push(line.trimEnd());
  }
  if (code !== null) out.push({ kind: "code", text: code.join("\n"), lang }); // unclosed fence still renders as code
  flush();
  return out;
}

/** the same segments stripped to text, for previews, aria labels and search */
export function plainText(segs: Segment[]): string {
  return segs
    .map((s) => (s.kind === "code" ? s.text ?? "" : (s.tokens ?? []).map((t) => (t.t === "break" ? "\n" : t.v)).join("")))
    .join("\n\n")
    .trim();
}

export function excerpt(src: unknown, len = 160): string {
  const flat = plainText(parseBody(src)).replace(/\s+/g, " ");
  return flat.length <= len ? flat : `${flat.slice(0, len - 1).trimEnd()}…`;
}

/* ── what the API moves ───────────────────────────────────────────── */

/** one row of a project's thread list, with the opening post quoted so the
 *  list needs no second request */
export interface ThreadHead {
  id: string;
  projectId: string;
  projectKind: ProjectKind;
  title: string;
  author: string;
  authorLogin: string | null;
  replies: number;
  score: number;
  pinned: boolean;
  locked: boolean;
  createdAt: number;
  lastCommentAt: number;
  opening: string;
}

/* ── the tree ─────────────────────────────────────────────────────── */

export type VoteValue = -1 | 0 | 1;

export interface RawComment {
  id: string;
  parentId: string | null;
  author: string;
  authorLogin: string | null;
  body: string;
  createdAt: number;
  upvotes: number;
  downvotes: number;
  myVote: VoteValue;
  flagged: boolean;
  /** why a reader reported it, shown so the collapse is not a silent deletion */
  flagReason: string | null;
}

export interface ThreadNode extends RawComment {
  depth: number;
  children: ThreadNode[];
  /** every descendant, not just direct replies */
  replies: number;
  score: number;
}

export const scoreOf = (c: Pick<RawComment, "upvotes" | "downvotes">) => c.upvotes - c.downvotes;

const orderRoots = (nodes: ThreadNode[], sort: SortKey): ThreadNode[] => {
  const by = [...nodes];
  if (sort === "top") by.sort((a, b) => b.score - a.score || b.createdAt - a.createdAt);
  else if (sort === "old") by.sort((a, b) => a.createdAt - b.createdAt);
  else by.sort((a, b) => b.createdAt - a.createdAt);
  return by;
};

/** flat rows -> a forest, children oldest first, replies past the third
 *  level flattened under their deepest allowed ancestor. A reply whose parent
 *  is not in the batch (a deleted post) becomes a root rather than vanishing. */
export function buildTree(rows: RawComment[], sort: SortKey = "top"): ThreadNode[] {
  const byId = new Map<string, ThreadNode>();
  for (const r of rows) byId.set(r.id, { ...r, depth: 0, children: [], replies: 0, score: scoreOf(r) });

  const kids = new Map<string, ThreadNode[]>();
  const tops: ThreadNode[] = [];
  for (const r of rows) {
    const node = byId.get(r.id)!;
    const parent = r.parentId ? byId.get(r.parentId) : null;
    if (!parent) {
      tops.push(node);
      continue;
    }
    const list = kids.get(parent.id) ?? [];
    list.push(node);
    kids.set(parent.id, list);
  }

  const attach = (node: ThreadNode, depth: number): ThreadNode => {
    node.depth = depth;
    const raw = (kids.get(node.id) ?? []).sort((a, b) => a.createdAt - b.createdAt);
    const childDepth = Math.min(depth + 1, MAX_DEPTH);
    if (childDepth === depth) {
      /* the thread is already as deep as it may go: keep showing the rest of
         the argument, at this level, instead of nesting it out of the page */
      const flat: ThreadNode[] = [];
      const sink = (list: ThreadNode[]) => {
        for (const c of list) {
          c.depth = depth;
          c.children = [];
          c.replies = 0;
          flat.push(c);
          sink(kids.get(c.id) ?? []);
        }
      };
      sink(raw);
      node.children = flat;
      node.replies = flat.length;
      return node;
    }
    node.children = raw.map((c) => attach(c, childDepth));
    node.replies = node.children.reduce((n, c) => n + 1 + c.replies, 0);
    return node;
  };

  return orderRoots(tops.map((t) => attach(t, 0)), sort);
}

/** depth-first, the order a reader scrolls through */
export function flattenTree(nodes: ThreadNode[]): ThreadNode[] {
  const out: ThreadNode[] = [];
  const walk = (list: ThreadNode[]) => {
    for (const n of list) {
      out.push(n);
      walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

/** replies only: a row without a parent, or whose parent is missing from the
 *  same batch, opens its own branch and so is not counted as a reply */
export function countReplies(rows: RawComment[]): number {
  const ids = new Set(rows.map((r) => r.id));
  return rows.filter((r) => r.parentId && ids.has(r.parentId)).length;
}

/** the level a reply to `parent` lands on, capped where the tree caps: the
 *  server re-parents a reply past that level rather than losing it */
export const depthForReply = (parent: ThreadNode | null) => (parent ? Math.min(parent.depth + 1, MAX_DEPTH) : 0);

/* ── votes and flags ──────────────────────────────────────────────── */

export const validVote = (v: unknown): v is VoteValue => v === 1 || v === -1 || v === 0;

/** clicking the arrow you are already on clears it, like GitHub's 👍 */
export function applyVote(c: Pick<RawComment, "upvotes" | "downvotes" | "myVote">, next: VoteValue) {
  const had = c.myVote;
  const up = c.upvotes - (had === 1 ? 1 : 0) + (next === 1 ? 1 : 0);
  const down = c.downvotes - (had === -1 ? 1 : 0) + (next === -1 ? 1 : 0);
  return { upvotes: Math.max(0, up), downvotes: Math.max(0, down), myVote: next };
}

export const FLAG_REASONS = ["spam", "harassment", "off_topic", "misinformation"] as const;
export type FlagReason = (typeof FLAG_REASONS)[number];
export const validFlagReason = (v: unknown): v is FlagReason =>
  typeof v === "string" && (FLAG_REASONS as readonly string[]).includes(v);
