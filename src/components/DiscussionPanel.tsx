"use client"
/* ══ DiscussionPanel.tsx — the conversation on a project page ═════════
   Threads live in Postgres and are read through /api/discussions; every rule
   about them (how a body becomes renderable pieces, how flat rows become a
   tree no deeper than three reply levels, what a vote does to a tally) sits in
   src/lib/discussions.ts so this file only decides what it looks like.

   The renderer maps parser tokens to elements and never to HTML, so a comment
   full of angle brackets is still just text. Offline - a deploy with no
   database - the panel says so instead of showing an empty box that implies
   nobody has anything to say.                                         ═ */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FLAG_REASONS, MAX_BODY, MAX_DEPTH, MAX_TITLE, buildTree, depthForReply, flattenTree, parseBody,
  type FlagReason, type ProjectKind, type RawComment, type Segment, type SortKey,
  type ThreadHead, type ThreadNode, type VoteValue,
} from "@/lib/discussions";
import { Avatar, btn } from "@/components/ui";
import { useStore } from "@/lib/store";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "top", label: "Top" },
  { key: "new", label: "Newest" },
  { key: "old", label: "Oldest" },
];

/* the tree stops at MAX_DEPTH; the gutter indents one step per level */
const INDENT = ["", "ml-[24px]", "ml-[48px]", "ml-[72px]"];

function ago(ms: number): string {
  if (!ms) return "just now";
  const s = Math.max(1, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 31) return `${d}d ago`;
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/* ── the markdown-lite renderer ──────────────────────────────────── */

function Body({ segs }: { segs: Segment[] }) {
  return (
    <div className="grid gap-2.5">
      {segs.map((seg, i) =>
        seg.kind === "code" ? (
          <pre key={i} className="overflow-x-auto rounded-[10px] border border-liness bg-sand px-3.5 py-3 font-mono text-[12.5px] leading-[1.6] text-cocoa">
            {seg.text}
          </pre>
        ) : (
          <p key={i} className="text-[13.5px] leading-[1.7] text-ink">
            {(seg.tokens ?? []).map((t, j) => {
              if (t.t === "break") return <br key={j} />;
              if (t.t === "code") return <code key={j} className="rounded-[5px] bg-clay px-1.5 py-0.5 font-mono text-[12px] text-rust">{t.v}</code>;
              if (t.t === "bold") return <strong key={j} className="font-semibold text-foam">{t.v}</strong>;
              if (t.t === "italic") return <em key={j}>{t.v}</em>;
              if (t.t === "link") return (
                <a key={j} href={t.href} target="_blank" rel="noopener noreferrer nofollow" className="text-denim underline decoration-denim/40 underline-offset-2">
                  {t.v}
                </a>
              );
              return <span key={j}>{t.v}</span>;
            })}
          </p>
        ),
      )}
      {!segs.length && <p className="text-[13px] text-dim">Nothing readable is left of this comment once the site has stripped its markup.</p>}
    </div>
  );
}

/* ── the vote column ─────────────────────────────────────────────── */

function Vote({ node, canWrite, busy, onVote }: {
  node: { id: string; score: number; myVote: VoteValue };
  canWrite: boolean;
  busy: boolean;
  onVote: (id: string, v: VoteValue) => void;
}) {
  const arrow = (dir: 1 | -1, glyph: string, label: string) => (
    <button
      type="button"
      disabled={!canWrite || busy}
      onClick={() => onVote(node.id, node.myVote === dir ? 0 : dir)}
      aria-pressed={node.myVote === dir}
      aria-label={label}
      title={canWrite ? (node.myVote === dir ? "Take back your vote" : label) : "Sign in to vote"}
      className={`h-6 w-6 rounded-[7px] border text-[10px] leading-none transition-colors ${
        node.myVote === dir ? "border-accent bg-peach text-accent" : "border-liness text-dim hover:border-rule hover:text-ink"
      } ${canWrite && !busy ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}
    >
      {glyph}
    </button>
  );
  return (
    <div className="flex shrink-0 flex-col items-center gap-1 pt-0.5">
      {arrow(1, "▲", "Useful")}
      <span className={`font-mono text-[12px] font-semibold ${node.score > 0 ? "text-accent" : node.score < 0 ? "text-brick" : "text-dim"}`}>{node.score}</span>
      {arrow(-1, "▼", "Not useful")}
    </div>
  );
}

/* ── the box you type in ─────────────────────────────────────────── */

function Composer({ title, body, setTitle, setBody, submit, busy, error, onCancel, cta }: {
  title?: string;
  body: string;
  setTitle?: (v: string) => void;
  setBody: (v: string) => void;
  submit: () => void;
  busy: boolean;
  error: string;
  onCancel?: () => void;
  cta: string;
}) {
  const [preview, setPreview] = useState(false);
  const segs = useMemo(() => parseBody(body), [body]);
  return (
    <div className="rounded-[12px] border border-line bg-cream p-3">
      {setTitle && (
        <input
          value={title ?? ""}
          maxLength={MAX_TITLE}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What do you want to ask or share?"
          aria-label="Discussion title"
          className="mb-2.5 w-full rounded-[9px] border border-liness bg-sand px-3 py-2.5 text-[14px] font-semibold text-ink outline-none placeholder:text-dim focus:border-accent"
        />
      )}
      <textarea
        value={body}
        maxLength={MAX_BODY}
        rows={preview ? 6 : 3}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Markdown-lite: **bold**, _italic_, `code`, ```fenced blocks```, [links](https://…) and bare URLs."
        aria-label="Message"
        className="w-full resize-y rounded-[9px] border border-liness bg-sand px-3 py-2.5 text-[13.5px] leading-[1.65] text-ink outline-none placeholder:text-dim focus:border-accent"
      />
      {preview && (
        <div className="mt-2.5 rounded-[9px] border border-dashed border-rule bg-sand p-3">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-dim">Preview · what everyone will read</div>
          <Body segs={segs} />
        </div>
      )}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setPreview(!preview)} aria-pressed={preview} className={btn("ghost", "sm", preview ? "text-accent" : "")}>
          {preview ? "Keep writing" : "Preview"}
        </button>
        <span className="font-mono text-[11px] text-dim">{body.length.toLocaleString("en-US")}/{MAX_BODY}</span>
        <span className="flex-1" />
        {onCancel && <button type="button" onClick={onCancel} className={btn("ghost", "sm")}>Cancel</button>}
        <button type="button" onClick={submit} disabled={busy} className={btn("primary", "sm", busy ? "opacity-60" : "")}>
          {busy ? "Sending…" : cta}
        </button>
      </div>
      {error && <p className="mt-2 text-[12.5px] text-brick">{error}</p>}
    </div>
  );
}

/* ── panel ───────────────────────────────────────────────────────── */

export default function DiscussionPanel({ kind = "repo", id }: { kind?: ProjectKind; id: string }) {
  const { serverUser, setAuthOpen, toast } = useStore();
  const [heads, setHeads] = useState<ThreadHead[] | null>(null);
  const [offline, setOffline] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [head, setHead] = useState<ThreadHead | null>(null);
  const [comments, setComments] = useState<RawComment[] | null>(null);
  const [sort, setSort] = useState<SortKey>("top");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [flagFor, setFlagFor] = useState<string | null>(null);
  const [reason, setReason] = useState<FlagReason>("spam");
  const [revealed, setRevealed] = useState<string[]>([]);

  const loadList = useCallback(() => {
    setOffline(false);
    fetch(`/api/discussions?kind=${encodeURIComponent(kind)}&project=${encodeURIComponent(id)}`)
      .then((r) => (r.status === 503 ? null : r.ok ? r.json() : Promise.reject(new Error("list"))))
      .then((d) => { if (d) setHeads((d.threads ?? []) as ThreadHead[]); })
      .catch(() => setOffline(true));
  }, [kind, id]);

  useEffect(() => {
    setHeads(null); setOpenId(null); setHead(null); setComments(null); setShowNew(false); setErr("");
    loadList();
  }, [loadList]);

  const readThread = useCallback((threadId: string) => {
    setOpenId(threadId);
    setHead(null);
    setComments(null);
    return fetch(`/api/discussions/${encodeURIComponent(threadId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("thread"))))
      .then((d) => { setHead(d.head as ThreadHead); setComments((d.comments ?? []) as RawComment[]); })
      .catch(() => setErr("That thread could not be read. Try again in a moment."));
  }, []);

  const openThread = (threadId: string) => {
    setReplyTo(null);
    setErr("");
    void readThread(threadId);
  };

  const tree = useMemo(() => (comments ? buildTree(comments, sort) : []), [comments, sort]);
  const flat = useMemo(() => flattenTree(tree), [tree]);
  const canWrite = !!serverUser;

  const ask = (fn: () => void) => {
    if (!canWrite) { setAuthOpen(true); return; }
    fn();
  };

  /** anything that moves a tally or adds a post is re-read from the row the
   *  database kept, rather than guessed at here. A vote is the one exception:
   *  the route answers with the new counters, so only that comment changes and
   *  the reader's scroll position survives.                             */
  const write = async (payload: Record<string, unknown>) => {
    if (!openId) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/discussions/${encodeURIComponent(openId)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) { setErr("Sign in and try that again."); return; }
      if (!res.ok) { setErr(String(data.error ?? "That did not go through.")); return; }
      if (payload.action === "vote") {
        setComments((cur) => (cur ?? []).map((c) => (c.id === payload.commentId
          ? { ...c, upvotes: data.upvotes as number, downvotes: data.downvotes as number, myVote: data.myVote as VoteValue }
          : c)));
        return;
      }
      await fetch(`/api/discussions/${encodeURIComponent(openId)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((fresh) => { if (fresh) { setHead(fresh.head as ThreadHead); setComments((fresh.comments ?? []) as RawComment[]); } });
      if (payload.action === "reply") {
        setReplyTo(null);
        setDraft("");
        toast("Posted.");
      } else {
        toast("Reported. The reason travels with the comment.");
      }
    } catch {
      setErr("The site could not reach the discussion store.");
    } finally {
      setBusy(false);
    }
  };

  const startThread = async () => {
    if (!newTitle.trim()) { setErr("Give it a title first."); return; }
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/discussions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectKind: kind, projectId: id, title: newTitle, body: newBody }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(String(res.status === 401 ? "Sign in and try again." : data.error ?? "That did not go through.")); return; }
      setShowNew(false); setNewTitle(""); setNewBody("");
      toast("Discussion opened.");
      loadList();
      if (data.id) void readThread(String(data.id));
    } catch {
      setErr("The site could not reach the discussion store.");
    } finally {
      setBusy(false);
    }
  };

  /* a render function rather than a component: the reply box lives inside it and
     must keep its caret while someone types */
  const row = (node: ThreadNode) => {
    const hidden = node.flagged && !revealed.includes(node.id);
    const landing = depthForReply(node);
    return (
      <article key={node.id} className={`border-t border-liness py-4 ${INDENT[Math.min(node.depth, MAX_DEPTH)]}`}>
        <div className="flex gap-3">
          <Vote node={node} busy={busy} canWrite={canWrite} onVote={(cid, v) => ask(() => void write({ action: "vote", commentId: cid, value: v }))} />
          <div className="min-w-0 flex-1">
            <header className="mb-1.5 flex flex-wrap items-center gap-2">
              <Avatar name={node.author || node.authorLogin || "someone"} size={20} />
              <span className="text-[13px] font-semibold text-foam">{node.author || node.authorLogin || "someone"}</span>
              {node.authorLogin && <span className="font-mono text-[11px] text-dim">@{node.authorLogin}</span>}
              <span className="font-mono text-[11px] text-dim">{ago(node.createdAt)}</span>
              {node.parentId && <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-dim">reply</span>}
            </header>
            {hidden ? (
              <div className="rounded-[10px] border border-dashed border-rule bg-sand px-3 py-2.5">
                <p className="text-[13px] text-cocoa">
                  This comment was reported{node.flagReason ? ` as ${node.flagReason.replace("_", " ")}` : ""}.
                </p>
                <button type="button" onClick={() => setRevealed((s) => [...s, node.id])} className={btn("ghost", "sm", "mt-1.5")}>Show it anyway</button>
              </div>
            ) : (
              <Body segs={parseBody(node.body)} />
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {!(head?.locked ?? false) && (
                <button type="button" onClick={() => ask(() => setReplyTo(replyTo === node.id ? null : node.id))} className={btn("ghost", "sm")}>
                  {replyTo === node.id ? "Close" : "Reply"}
                </button>
              )}
              {!node.flagged && (
                <button type="button" onClick={() => ask(() => setFlagFor(flagFor === node.id ? null : node.id))} className={btn("ghost", "sm", "text-dim")}>
                  Report
                </button>
              )}
              {node.replies > 0 && <span className="font-mono text-[11px] text-dim">{node.replies} below</span>}
            </div>
            {flagFor === node.id && (
              <div className="mt-2 flex flex-wrap items-center gap-2 rounded-[10px] border border-liness bg-sand px-3 py-2.5">
                <label className="font-mono text-[10px] uppercase tracking-[0.14em] text-dim" htmlFor={`flag-${node.id}`}>Why?</label>
                <select
                  id={`flag-${node.id}`}
                  value={reason}
                  onChange={(e) => setReason(e.target.value as FlagReason)}
                  className="rounded-[8px] border border-liness bg-cream px-2 py-1.5 text-[12.5px] text-ink outline-none"
                >
                  {FLAG_REASONS.map((r) => <option key={r} value={r}>{r.replace("_", " ")}</option>)}
                </select>
                <button type="button" disabled={busy} onClick={() => { setFlagFor(null); void write({ action: "flag", commentId: node.id, reason }); }} className={btn("outline", "sm")}>
                  Send report
                </button>
                <button type="button" onClick={() => setFlagFor(null)} className={btn("ghost", "sm")}>Never mind</button>
              </div>
            )}
            {replyTo === node.id && (
              <div className="mt-2.5">
                {landing === node.depth && (
                  <p className="mb-1.5 font-mono text-[11px] text-dim">
                    Three replies deep already - this one will sit beside the comment above rather than under it.
                  </p>
                )}
                <Composer
                  body={draft}
                  setBody={setDraft}
                  busy={busy}
                  error={err}
                  cta="Post reply"
                  onCancel={() => { setReplyTo(null); setErr(""); }}
                  submit={() => void write({ action: "reply", parentId: node.id, body: draft })}
                />
              </div>
            )}
          </div>
        </div>
      </article>
    );
  };

  /* ── states ─────────────────────────────────────────────────────── */

  if (offline) {
    return (
      <section className="bg-card border border-line rounded-[18px] shadow-soft mb-5 px-[18px] py-4">
        <h2 className="panel-h mb-1.5">Discussions</h2>
        <p className="text-[13px] leading-[1.65] text-cocoa">
          Threads need the site&apos;s own database, and this deployment has no <span className="font-mono text-[12px] text-dim">DATABASE_URL</span>, so
          there is nowhere to keep a post. Everything else on this page works without it.
        </p>
      </section>
    );
  }

  if (openId) {
    return (
      <section className="bg-card border border-line rounded-[18px] overflow-hidden shadow-soft mb-5">
        <h2 className="panel-h flex flex-wrap items-center gap-2.5 border-b border-liness px-[18px] py-3.5">
          <button
            type="button"
            onClick={() => { setOpenId(null); setHead(null); setComments(null); setErr(""); loadList(); }}
            className={btn("ghost", "sm")}
          >
            ← Threads
          </button>
          <span className="min-w-0 flex-1 truncate text-[14px]">{head?.title || "Thread"}</span>
          {head?.pinned && <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">pinned</span>}
          {head?.locked && <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-brick">closed</span>}
          <span className="font-mono text-[11px] text-dim">{comments ? `${flat.length} post${flat.length === 1 ? "" : "s"}` : "…"}</span>
        </h2>
        <div className="px-[18px] pb-[18px]">
          {!comments ? (
            <p className="py-6 text-[13px] text-dim">Loading the thread…</p>
          ) : (
            <>
              <div className="mb-2 flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-dim">Order by</span>
                {SORTS.map((s) => (
                  <button key={s.key} type="button" onClick={() => setSort(s.key)} aria-pressed={sort === s.key} className={btn(sort === s.key ? "outline" : "ghost", "sm")}>
                    {s.label}
                  </button>
                ))}
              </div>
              {flat.map((node) => row(node))}
              {head?.locked ? (
                <p className="mt-4 rounded-[10px] border border-liness bg-sand px-3.5 py-3 text-[13px] text-cocoa">
                  This thread is closed to new replies.
                </p>
              ) : (
                <div className="mt-4 border-t border-liness pt-4">
                  <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-dim">
                    {replyTo ? "Reply" : "Say something about the whole thread"}
                  </p>
                  <Composer
                    body={draft}
                    setBody={setDraft}
                    busy={busy}
                    error={err}
                    cta={canWrite ? "Post reply" : "Sign in to reply"}
                    submit={() => ask(() => void write({ action: "reply", parentId: replyTo, body: draft }))}
                  />
                  <p className="mt-1.5 text-[12px] text-dim">
                    {canWrite
                      ? "Open a comment's own Reply box to hang your answer under it. Links you post are marked nofollow."
                      : "You need an account to reply, vote or report."}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="bg-card border border-line rounded-[18px] overflow-hidden shadow-soft mb-5">
      <h2 className="panel-h flex flex-wrap items-center gap-2.5 border-b border-liness px-[18px] py-3.5">
        Discussions
        <span className="font-mono text-[11px] text-dim">{heads ? `${heads.length} thread${heads.length === 1 ? "" : "s"}` : "loading…"}</span>
        <span className="flex-1" />
        <button type="button" onClick={() => ask(() => setShowNew(!showNew))} aria-expanded={showNew} className={btn(showNew ? "ghost" : "primary", "sm")}>
          {showNew ? "Cancel" : "Start a thread"}
        </button>
      </h2>

      <div className="p-[18px]">
        {showNew && (
          <div className="mb-4">
            <Composer
              title={newTitle}
              setTitle={setNewTitle}
              body={newBody}
              setBody={setNewBody}
              busy={busy}
              error={err}
              cta="Post discussion"
              onCancel={() => { setShowNew(false); setErr(""); }}
              submit={() => void startThread()}
            />
          </div>
        )}

        {!heads ? (
          <p className="py-4 text-[13px] text-dim">Loading the threads…</p>
        ) : !heads.length ? (
          <p className="py-4 text-[13px] leading-[1.7] text-cocoa">
            Nobody has opened a thread about {id} yet. Ask the question you had when you first found it -
            {canWrite ? " use the button above." : " sign in and use the button above."}
          </p>
        ) : (
          <>
            <ul className="grid">
              {heads.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    onClick={() => openThread(h.id)}
                    className="flex w-full items-start gap-3.5 border-t border-liness py-3.5 text-left transition-colors first:border-t-0 hover:bg-cream"
                  >
                    <div className="w-[54px] shrink-0 text-center">
                      <div className={`font-mono text-[15px] font-bold ${h.score > 0 ? "text-accent" : h.score < 0 ? "text-brick" : "text-dim"}`}>{h.score}</div>
                      <div className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-dim">score</div>
                      <div className="mt-1 font-mono text-[11px] text-cocoa">{h.replies} repl{h.replies === 1 ? "y" : "ies"}</div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {h.pinned && <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">pinned</span>}
                        {h.locked && <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-brick">closed</span>}
                        <span className="truncate text-[14px] font-semibold text-foam">{h.title}</span>
                      </div>
                      <p className="mt-1 text-[12.5px] leading-[1.6] text-cocoa">{h.opening || "No text in the opening post."}</p>
                      <p className="mt-1 font-mono text-[11px] text-dim">{h.author || "someone"} · active {ago(h.lastCommentAt)}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[12px] leading-[1.6] text-dim">
              Replies go three levels deep, then flatten sideways so a long argument stays readable on a narrow screen. What is not here:
              @mentions that notify, updates that arrive while you watch, and mail when someone answers - each needs a background worker
              this first cut does not have.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
