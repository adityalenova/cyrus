"use client"
/* ══ LedgerRecovery.tsx — /issues/recovery ═══════════════════════════
   A page with one job: show who this browser's issue board belongs to,
   then let the visitor make one explicit choice when the account has
   changed. No rows from a different account are rendered above the fold,
   and none at all until the choice is made.

   The three actions are deliberately unequal. Keep is a re-stamp that
   deletes nothing. Export is non-destructive and works in every state.
   Clear is destructive and needs a second press, with the count in the
   question. -------------------------------------------------------- */
import { useState } from "react";
import { Link } from "@/lib/router";
import { useStore } from "@/lib/store";
import { Card } from "@/lib/dash/shell";
import { btn, Word } from "@/components/ui";
import { STAGE_LABEL, type IssueStage } from "@/lib/dash/shared";
import { ownerLabel, rowsFromLedger } from "@/lib/ledgerIdentity";
import { useLedgerOwnership } from "./useLedgerOwnership";
import {
  GUARD_LIMITS, IDENTITY_SOURCE, STAMP_PROVENANCE, keepBlockedReason, stateCopy,
  type StateTone,
} from "./model";

const W = "max-w-[1240px] mx-auto px-6";
const DISABLED = "disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-soft";

const TONE: Record<StateTone, { rail: string; text: string; wash: string }> = {
  ok: { rail: "border-l-leaf", text: "text-leaf", wash: "bg-leaf/10" },
  warn: { rail: "border-l-honey", text: "text-honey", wash: "bg-honey/10" },
  alert: { rail: "border-l-brick", text: "text-brick", wash: "bg-brick/10" },
  info: { rail: "border-l-denim", text: "text-denim", wash: "bg-denim/10" },
};

function PageHead() {
  return (
    <header className={`${W} pt-14 pb-8`}>
      <p className="font-mono text-[10.5px] tracking-[.14em] uppercase text-dim">
        <Link to="/" className="hover:text-accent">Home</Link> /{" "}
        <Link to="/issues" className="hover:text-accent">Issues</Link> /{" "}
        <span className="text-cocoa">Recovery</span>
      </p>
      <h1 className="font-display font-extrabold tracking-[-.022em] leading-[1.07] mt-3.5 mb-3 text-[clamp(31px,4vw,50px)]">
        Your board, and the account it <Word>belongs to</Word>.
      </h1>
      <p className="text-ink font-medium max-w-[690px] text-[16.5px] leading-[1.6]">
        Cyrus keeps tracked issues in this browser, not on a server. This page reads the
        account the app can prove, compares it with the account that last confirmed the
        board, and stops there if the two disagree. Nothing is deleted by checking.
      </p>
    </header>
  );
}

export default function LedgerRecovery() {
  const { setAuthOpen } = useStore();
  const {
    ready, state, stamp, identity, ledger, trackedCount, hiddenCount, blocked,
    keepBoard, exportJson, clearBoard,
  } = useLedgerOwnership();
  const [confirmClear, setConfirmClear] = useState(false);
  const [exported, setExported] = useState<{ count: number; schema: string } | null>(null);

  if (!ready) {
    return (
      <main className="pb-24">
        <PageHead />
        <section className={W} aria-busy="true">
          <Card className="p-6">
            <p role="status" className="font-mono text-[11px] uppercase tracking-[.12em] text-dim">
              Reading this browser&apos;s board and the connected account…
            </p>
          </Card>
        </section>
      </main>
    );
  }

  const copy = stateCopy(state, { owner: stamp, current: identity, entryCount: trackedCount });
  const tone = TONE[copy.tone];
  const keepReason = keepBlockedReason(state, identity);
  const rows = rowsFromLedger(ledger).slice(0, 6);
  const source = identity ? IDENTITY_SOURCE[identity.source] : null;

  return (
    <main className="pb-24">
      <PageHead />

      {/* ── who is connected, and what that means for the board ───── */}
      <section className={`${W} grid gap-5 lg:grid-cols-[1.02fr_.98fr] pb-5`}>
        <Card className="p-6 reveal" style={{ animationDelay: "0ms" }}>
          <p className="eyebrow">Connected account</p>
          <div className="flex items-start justify-between gap-4 mt-2">
            <p className="font-display font-bold text-[clamp(22px,2.5vw,30px)] tracking-[-.02em] break-all">
              {identity ? identity.label : "No account connected"}
            </p>
            <span
              className={`shrink-0 font-mono text-[10px] uppercase tracking-[.12em] rounded-full border px-2.5 py-1 ${
                identity?.verified
                  ? "border-leaf/40 text-leaf bg-leaf/10"
                  : identity
                    ? "border-honey/40 text-honey bg-honey/10"
                    : "border-line text-dim"
              }`}
            >
              {identity ? (identity.verified ? "Verified" : "Unverified") : "Signed out"}
            </span>
          </div>
          <p className="font-mono text-[10.5px] uppercase tracking-[.1em] text-dim mt-1.5">
            {source ? `${source.label}${identity?.provider ? ` · ${identity.provider}` : ""}` : "No stable key"}
          </p>
          <p className="card-desc mt-4">
            {source
              ? source.note
              : "No GitHub login and no email are available, so the guard has nothing to compare. A display name is not used as a key: two people can share one."}
          </p>
          {!identity && (
            <button className={btn("primary", "sm", "mt-4")} onClick={() => setAuthOpen(true)}>
              Sign in
            </button>
          )}
          <dl className="mt-5 border-t border-line pt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[12.5px]">
            <dt className="font-mono text-[10.5px] uppercase tracking-[.1em] text-dim self-center">Owner stamp</dt>
            <dd className="font-mono text-[12px] text-cocoa break-all">
              {stamp ? `${ownerLabel(stamp.login)} · linked ${stamp.linkedAt.slice(0, 10)} UTC` : "not set"}
            </dd>
            <dt className="font-mono text-[10.5px] uppercase tracking-[.1em] text-dim self-center">Tracked issues</dt>
            <dd className="font-mono text-[12px] text-cocoa">
              {trackedCount} in this browser{hiddenCount > 0 ? ` · ${hiddenCount} hidden below` : ""}
            </dd>
          </dl>
        </Card>

        <Card className={`p-6 reveal border-l-2 ${tone.rail}`} style={{ animationDelay: "60ms" }}>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`font-mono text-[10px] uppercase tracking-[.13em] rounded-full px-2.5 py-1 ${tone.wash} ${tone.text}`}>
              {copy.badge}
            </span>
            {blocked && (
              <span className="font-mono text-[10px] uppercase tracking-[.13em] rounded-full border border-brick/40 text-brick px-2.5 py-1">
                Writes paused
              </span>
            )}
          </div>
          <div role={copy.role} className="mt-3">
            <h2 className="panel-h-lg text-ink">{copy.title}</h2>
            <p className="card-desc mt-2">{copy.body}</p>
          </div>
          <p className="font-mono text-[10.5px] uppercase tracking-[.1em] text-dim mt-4 border-t border-line pt-3">
            Detection source: {identity ? `${identity.source} · ${identity.source === "github-session" ? "login" : "email"}` : "no session"}
          </p>
        </Card>
      </section>

      {/* ── migration for boards created before stamps existed ────── */}
      {state === "unclaimed" && trackedCount > 0 && (
        <section className={`${W} pb-5`}>
          <Card className="p-5 border-honey/40 bg-honey/5 reveal" style={{ animationDelay: "90ms" }}>
            <p className="eyebrow text-honey">Migration · no stamp on file</p>
            <p className="text-[13.5px] text-ink leading-[1.65] mt-2 max-w-[820px]">
              This board holds {trackedCount} tracked issue{trackedCount === 1 ? "" : "s"} from before ownership
              stamping. Keeping it on {identity ? identity.label : "a signed-in account"} records the owner and
              leaves every entry exactly as it is. Sign in first if no account is connected.
            </p>
          </Card>
        </section>
      )}

      {/* ── the three choices, in increasing order of consequence ─── */}
      <section className={`${W} grid gap-5 md:grid-cols-2 xl:grid-cols-3 pb-5`} aria-label="Recovery actions">
        <Card className="p-6 flex flex-col gap-3 reveal" style={{ animationDelay: "120ms" }}>
          <p className="eyebrow">01 · Keep</p>
          <h2 className="panel-h-lg">Keep this board on this account</h2>
          <p className="card-desc">
            Writes a fresh owner stamp for {identity ? identity.label : "the connected account"} and changes no
            entries. Use it when the board is yours and the previous account is gone, or to migrate a board that
            predates stamps.
          </p>
          {keepReason && (
            <p className="font-mono text-[10.5px] uppercase tracking-[.08em] text-honey leading-[1.6]">
              {keepReason}
            </p>
          )}
          <button
            className={btn(state === "changed" ? "primary" : "outline", "md", `mt-auto ${DISABLED}`)}
            onClick={() => keepBoard()}
            disabled={Boolean(keepReason)}
            aria-describedby="keep-note"
          >
            {state === "changed" ? "Keep board here" : "Keep board"}
          </button>
          <p id="keep-note" className="font-mono text-[10px] text-dim leading-[1.6]">
            Re-stamps only. The {trackedCount} stored row{trackedCount === 1 ? "" : "s"} are not rewritten.
          </p>
        </Card>

        <Card className="p-6 flex flex-col gap-3 reveal" style={{ animationDelay: "180ms" }}>
          <p className="eyebrow">02 · Export</p>
          <h2 className="panel-h-lg">Export the board as JSON</h2>
          <p className="card-desc">
            Downloads every tracked issue with its stage, date added and snapshot metadata under the stable
            schema <code className="font-mono text-[11.5px] text-cocoa">cyrus.ledger.export.v1</code>. It works in
            every state, including a changed account, and never alters the board.
          </p>
          <p className="font-mono text-[10.5px] uppercase tracking-[.08em] text-dim">
            {trackedCount} entr{trackedCount === 1 ? "y" : "ies"} · from cyrus.issues.v1
          </p>
          <button
            className={btn("outline", "md", `mt-auto ${DISABLED}`)}
            onClick={() => {
              const payload = exportJson();
              setExported({ count: payload.count, schema: payload.schema });
            }}
            aria-describedby="export-note"
          >
            {trackedCount > 0 ? "Export JSON" : "Export empty board"}
          </button>
          <p id="export-note" className="font-mono text-[10px] text-dim leading-[1.6]">
            A download, not a copy on a server. Entries keep their stored order and values.
          </p>
          {exported && (
            <p role="status" className="font-mono text-[10.5px] text-leaf leading-[1.6]">
              Prepared {exported.count} entr{exported.count === 1 ? "y" : "ies"} under {exported.schema}.
            </p>
          )}
        </Card>

        <Card className="p-6 flex flex-col gap-3 reveal md:col-span-2 xl:col-span-1 border-brick/25" style={{ animationDelay: "240ms" }}>
          <p className="eyebrow text-brick">03 · Clear</p>
          <h2 className="panel-h-lg">Clear this board</h2>
          <p className="card-desc">
            Deletes every tracked issue from this browser, including stage changes and dates. It cannot be undone,
            and an export is the only copy that survives it.
          </p>
          {!confirmClear ? (
            <button
              className={btn("outline", "md", `mt-auto border-brick/40 text-brick hover:border-brick ${DISABLED}`)}
              onClick={() => setConfirmClear(true)}
              disabled={trackedCount === 0}
              aria-describedby="clear-note"
            >
              {trackedCount === 0 ? "Nothing to clear" : "Clear board…"}
            </button>
          ) : (
            <div
              role="group"
              aria-labelledby="clear-confirm-title"
              className="mt-auto rounded-[12px] border border-brick/40 bg-brick/5 p-3.5"
            >
              <p id="clear-confirm-title" className="text-[13px] font-semibold text-brick">
                Remove {trackedCount} tracked issue{trackedCount === 1 ? "" : "s"} from this browser?
              </p>
              <p role="alert" className="text-[12px] text-cocoa leading-[1.6] mt-1">
                This is the second and final step. Export first if you want a copy.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  className={btn("outline", "sm", "border-brick/50 text-brick hover:border-brick")}
                  onClick={() => { clearBoard(); setConfirmClear(false); }}
                >
                  Yes, clear {trackedCount}
                </button>
                <button className={btn("ghost", "sm")} onClick={() => setConfirmClear(false)} autoFocus>
                  Cancel
                </button>
              </div>
            </div>
          )}
          <p id="clear-note" className="font-mono text-[10px] text-dim leading-[1.6]">
            Clears the current identity&apos;s board and stamps the empty board to the account connected now.
          </p>
        </Card>
      </section>

      {/* ── what is on the board, and what the guard cannot see ───── */}
      <section className={`${W} grid gap-5 lg:grid-cols-[.92fr_1.08fr] pb-5`}>
        <Card className="p-6 reveal" style={{ animationDelay: "300ms" }}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="eyebrow">Board contents</p>
            <span className="font-mono text-[10px] text-dim">{trackedCount} total</span>
          </div>
          {hiddenCount > 0 ? (
            <p className="card-desc mt-3">
              {hiddenCount} row{hiddenCount === 1 ? " is" : "s are"} hidden because the connected account does not
              own this board. They are still stored in this browser; export them, keep them on one account, or
              clear them above. No URL is rendered here until that choice is made.
            </p>
          ) : rows.length > 0 ? (
            <>
              <ul className="mt-3 divide-y divide-line">
                {rows.map((row) => (
                  <li key={row.url} className="py-2.5 flex items-baseline gap-3">
                    <span className="shrink-0 font-mono text-[9.5px] uppercase tracking-[.08em] text-dim">
                      {STAGE_LABEL[row.stage as IssueStage] ?? row.stage}
                    </span>
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noreferrer"
                      className="min-w-0 flex-1 truncate text-[12.5px] text-ink hover:text-accent"
                      title={row.url}
                    >
                      {row.url.replace("https://github.com/", "")}
                    </a>
                    <span className="shrink-0 font-mono text-[10px] text-dim">{row.added}</span>
                  </li>
                ))}
              </ul>
              {trackedCount > rows.length && (
                <p className="font-mono text-[10px] text-dim mt-2">
                  Showing {rows.length} of {trackedCount}; export for the full list.
                </p>
              )}
            </>
          ) : (
            <p className="card-desc mt-3">
              No tracked issues in this browser. Add one from{" "}
              <Link to="/issues" className="text-accent hover:underline">the issue finder</Link>.
            </p>
          )}
        </Card>

        <Card className="p-6 reveal" style={{ animationDelay: "360ms" }}>
          <p className="eyebrow">What the guard can see</p>
          <ul className="mt-4 grid gap-3.5">
            {GUARD_LIMITS.map((limit) => (
              <li key={limit.title} className="border-t border-line pt-3.5 first:border-0 first:pt-0">
                <p className="text-[13px] font-semibold text-ink">{limit.title}</p>
                <p className="card-desc mt-1">{limit.body}</p>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <footer className={`${W} pb-16`}>
        <p className="font-mono text-[10.5px] leading-[1.7] text-dim border-t border-line pt-5 max-w-[900px]">
          {STAMP_PROVENANCE}
        </p>
      </footer>
    </main>
  );
}
