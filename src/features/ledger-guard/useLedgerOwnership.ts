"use client"
/* ══ useLedgerOwnership.ts — the guard around the issue board ════════
   One hook ties three browser facts together: the stored board, the stored
   owner stamp, and the identity the app can prove right now. It returns a
   gated view of the board plus a guarded set of writes, so a caller can
   neither display nor mutate saved entries under a different account
   without going through the recovery actions first.

   Read paths are gated by canShowEntries(): a "changed" identity gets an
   empty ledger and a hidden count. Write paths go through the guarded
   ledger; the recovery actions (keep, export, clear) are the only writes
   that bypass it, because they are the explicit choices that resolve it.
   ═══════════════════════════════════════════════════════════════════ */
import { useCallback, useEffect, useMemo } from "react";
import { useStore } from "@/lib/store";
import { useIssueLedger, type IssueMeta } from "@/lib/issueLedger";
import { useStored } from "@/lib/util";
import {
  LEDGER_OWNER_KEY, adoptionStamp, buildLedgerExport, canMutate, canShowEntries, classify,
  clearBoardStamp, exportFileName, keepStamp, needsResolution, parseStamp,
  type LedgerExport, type LedgerOwnerStamp, type OwnershipState,
} from "@/lib/ledgerIdentity";
import type { IssueStage } from "@/lib/dash/shared";
import { currentIdentityOf, type CurrentIdentity } from "./model";

/** Repeated-write shape of the ledger, with every mutator guarded. */
export type GuardedLedger = {
  add: (raw: string, meta?: IssueMeta) => boolean;
  toggle: (raw: string, meta?: IssueMeta) => boolean;
  setStage: (url: string, stage: IssueStage) => void;
  remove: (url: string) => void;
  clear: () => void;
};

export function useLedgerOwnership() {
  const { user, serverUser, boardReady, toast } = useStore();
  const ledgerApi = useIssueLedger();
  const [rawStamp, setStamp, stampReady] = useStored<unknown>(LEDGER_OWNER_KEY, null);

  const identity = useMemo<CurrentIdentity | null>(
    () => currentIdentityOf({ user, serverUser }),
    [user, serverUser],
  );
  const stamp = useMemo<LedgerOwnerStamp | null>(() => parseStamp(rawStamp), [rawStamp]);
  const state: OwnershipState = classify(stamp, identity);
  const ready = boardReady && ledgerApi.ready && stampReady;
  const entryCount = Object.keys(ledgerApi.ledger).length;
  const writable = ready && canMutate(state, entryCount);
  /* A changed identity sees no rows - the count is enough to explain the
     decision without putting somebody else's board on screen. */
  const visibleLedger = useMemo(
    () => (canShowEntries(state) ? ledgerApi.ledger : {}),
    [state, ledgerApi.ledger],
  );

  /* Claim an empty board for whoever is connected, once storage is read.
     A board with entries is never auto-claimed: that needs keepBoard(). */
  useEffect(() => {
    if (!ready) return;
    const next = adoptionStamp(classify(parseStamp(rawStamp), identity), identity, entryCount);
    if (next) setStamp(next);
  }, [ready, rawStamp, identity, entryCount, setStamp]);

  const allowWrite = useCallback((): boolean => {
    if (!ready) return false;
    const count = Object.keys(ledgerApi.ledger).length;
    const now = classify(parseStamp(rawStamp), identity);
    if (!canMutate(now, count)) return false;
    const adopted = adoptionStamp(now, identity, count);
    if (adopted) setStamp(adopted);
    return true;
  }, [ready, rawStamp, identity, ledgerApi.ledger, setStamp]);

  const guarded = useMemo<GuardedLedger>(() => ({
    add: (raw, meta) => (allowWrite() ? ledgerApi.add(raw, meta) : false),
    toggle: (raw, meta) => (allowWrite() ? ledgerApi.toggle(raw, meta) : false),
    setStage: (url, stage) => { if (allowWrite()) ledgerApi.setStage(url, stage); },
    remove: (url) => { if (allowWrite()) ledgerApi.remove(url); },
    clear: () => {
      if (!allowWrite()) return;
      ledgerApi.clear();
      setStamp(clearBoardStamp(identity));
    },
  }), [allowWrite, ledgerApi, identity, setStamp]);

  /** Keep this board on the connected account. Re-stamps, deletes nothing;
   *  this is also the migration path for a board created before the stamp. */
  const keepBoard = useCallback((): boolean => {
    if (!ready || !identity) return false;
    setStamp(keepStamp(identity));
    toast(`Board kept on ${identity.label}`);
    return true;
  }, [ready, identity, setStamp, toast]);

  const exportPayload = useCallback((): LedgerExport => buildLedgerExport(ledgerApi.ledger, {
    owner: stamp,
    currentIdentity: identity,
    exportedAt: new Date(),
  }), [ledgerApi.ledger, stamp, identity]);

  /** Download the board as versioned JSON. Non-destructive in every state,
   *  including "changed" - exporting is how a visitor takes their data with
   *  them instead of leaving it behind. */
  const exportJson = useCallback((): LedgerExport => {
    const payload = exportPayload();
    if (typeof document !== "undefined") {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = exportFileName(payload.exportedAt);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 0);
      toast(`Exported ${payload.count} tracked issue${payload.count === 1 ? "" : "s"}`);
    }
    return payload;
  }, [exportPayload, toast]);

  /** Destructive, and only ever called from the two-step confirm. */
  const clearBoard = useCallback((): boolean => {
    if (!ready) return false;
    ledgerApi.clear();
    setStamp(clearBoardStamp(identity));
    toast("Issue board cleared");
    return true;
  }, [ready, ledgerApi, identity, setStamp, toast]);

  const resolutionNeeded = needsResolution(state, entryCount);

  return {
    ready,
    state,
    stamp,
    identity,
    /** rows safe to render; empty for a changed identity */
    ledger: visibleLedger,
    /** true number of rows in storage, even while hidden */
    trackedCount: entryCount,
    hiddenCount: state === "changed" ? entryCount : 0,
    canMutate: writable,
    blocked: ready && !writable,
    needsResolution: resolutionNeeded,
    guarded,
    keepBoard,
    exportJson,
    exportPayload,
    clearBoard,
  };
}
