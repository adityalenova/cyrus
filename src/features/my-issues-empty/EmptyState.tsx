"use client"
/* ══ my-issues-empty/EmptyState.tsx — the first-run door ═════════════
   What the board's empty issue column shows when nothing has ever
   been tracked. Three states, one component: the explanation and the
   way to the Issue Finder are only ever drawn when the ledger has
   actually been read and is actually empty (see ./model).          ══ */
import type { ReactNode } from "react";
import { Link } from "@/lib/router";
import { btn } from "@/components/ui";
import { Card, Ic } from "@/lib/dash/shell";
import { DP } from "@/lib/dash/shared";
import { ArtLedger } from "@/lib/dash/art";
import type { IssuesEmptyState } from "./model";

export function MyIssuesEmptyState({
  state,
  onRetry,
}: {
  state: IssuesEmptyState;
  /** the read's own retry; only the caller that made a request has one */
  onRetry?: () => void;
}): ReactNode {
  if (state.kind === "none") return null;

  /* not read yet: the parent keeps its indicator, this keeps the shape of
     the column so the page does not jump when the rows arrive */
  if (state.kind === "loading") {
    return (
      <Card>
        <p role="status" aria-live="polite" className="font-mono text-[10.5px] uppercase tracking-[.16em] text-dim">
          Reading your issue ledger
        </p>
        <div className="grid gap-2.5 mt-4" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-[14px] border border-line bg-cream px-4 py-4">
              <div className="h-2.5 w-[120px] rounded bg-clay" />
              <div className="h-3.5 w-[70%] rounded bg-clay mt-3" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  /* a read that failed: the message and its own retry, never the first-run
     explanation - "nothing tracked" would be a claim the page cannot make */
  if (state.kind === "error") {
    return (
      <Card>
        <div role="alert" className="flex items-start gap-3.5">
          <span className="w-[30px] h-[30px] grid place-items-center rounded-[9px] border border-brick/40 bg-brick/10 text-brick shrink-0">
            <Ic d={DP.clock} size={14} />
          </span>
          <div className="min-w-0">
            <h2 className="panel-h-lg">Your board did not load.</h2>
            <p className="card-desc mt-1.5 break-words">{state.message}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 mt-4">
          {onRetry ? (
            <button onClick={onRetry} className={btn("primary", "sm")}>Try again</button>
          ) : (
            <span className="text-cocoa text-[12.5px]">Reload the page to try again.</span>
          )}
          <span className="text-dim text-[12px]">
            Nothing on this board was changed by the failed read.
          </span>
        </div>
      </Card>
    );
  }

  /* first run: what tracking is for, and the shortest way to the finder */
  return (
    <Card className="py-10">
      <div className="flex justify-center mb-5 text-dim">
        <ArtLedger className="max-w-[190px]" />
      </div>
      <p className="eyebrow flex justify-center mb-2.5">First run</p>
      <h2 className="panel-h-lg text-center">Nothing on the board yet.</h2>
      <p className="card-desc text-center max-w-[470px] mx-auto mt-2">
        Tracking keeps an issue&apos;s link, its repository and the stage you left it at, in this
        browser. It is a note to yourself, not a claim on the issue: only a maintainer on GitHub
        can assign one. Pick one from the Issue Finder - every card there has a Track it button -
        or paste a link into the box above.
      </p>
      <div className="flex flex-col items-center gap-2.5 mt-5">
        <Link to="/issues" className={btn("primary", "md") + " w-full max-w-[300px]"}>
          Find an issue to track
        </Link>
        <span className="text-dim text-[12px] leading-[1.55] max-w-[360px] text-center">
          The finder filters <span className="font-mono text-[11px]">open issues</span> by
          language, organization and label. Your board keeps whatever you track from it.
        </span>
      </div>
    </Card>
  );
}
