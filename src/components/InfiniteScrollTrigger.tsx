"use client";
import { useEffect, useRef } from "react";

export default function InfiniteScrollTrigger({ onIntersect, isLoading, hasMore }: { onIntersect: () => void; isLoading: boolean; hasMore: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!hasMore || isLoading) return;
    const obs = new IntersectionObserver(entries => { if (entries[0]?.isIntersecting) onIntersect(); }, { rootMargin: "200px" });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [onIntersect, hasMore, isLoading]);
  if (!hasMore) return <div className="text-center py-6 text-xs text-cocoa/50">End of list.</div>;
  return <div ref={ref} className="py-6 flex justify-center">{isLoading && <span className="text-xs text-cocoa">Loading more...</span>}</div>;
}
