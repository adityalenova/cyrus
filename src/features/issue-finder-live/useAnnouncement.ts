"use client"
/* ══ issue-finder-live/useAnnouncement.ts — one polite sentence ══════
   The debounce is the feature: a filter change (a chip, a sort, the
   typing that settles into ?q=) causes several renders, and the fetch
   causes one more. Only the state that is still true 400 ms later is
   announced, so the live region speaks once per settled search rather
   than once per keystroke.                                            ══ */
import { useEffect, useRef, useState } from "react";
import { describeResultStatus, type FinderPhase } from "./model";

/** how long a search has to stay still before its count is spoken */
export const ANNOUNCE_DELAY = 400;

export function useResultAnnouncement({
  phase,
  count,
  query,
}: {
  phase: FinderPhase;
  count: number | null;
  query: string;
}): string {
  const [announcement, setAnnouncement] = useState("");
  /* the last count that reached the region, not the last one painted */
  const announcedCount = useRef<number | null>(null);
  const announcedText = useRef("");

  useEffect(() => {
    const timer = setTimeout(() => {
      const text = describeResultStatus({ phase, count, previousCount: announcedCount.current, query });
      if (!text || text === announcedText.current) return;
      announcedText.current = text;
      /* only a settled result set moves the baseline; a loading frame carries
         the previous total and must not be mistaken for a new announcement */
      if (phase === "ready" && count !== null) announcedCount.current = count;
      setAnnouncement(text);
    }, ANNOUNCE_DELAY);
    return () => clearTimeout(timer);
  }, [phase, count, query]);

  return announcement;
}
