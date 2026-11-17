"use client";
/* ══ Pagination.tsx — URL-driven pagination with page size selector ══ */
import { useCallback, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

interface PaginationProps {
  totalItems: number;
  className?: string;
}

function range(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return range(1, total);
  if (current <= 3) return [...range(1, 4), "...", total];
  if (current >= total - 2) return [1, "...", ...range(total - 3, total)];
  return [1, "...", current - 1, current, current + 1, "...", total];
}

export default function Pagination({ totalItems, className = "" }: PaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const page = Number(searchParams.get("page")) || 1;
  const limit = Number(searchParams.get("limit")) || 20;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, totalItems);

  const navigate = useCallback(
    (newPage: number, newLimit?: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", String(newPage));
      if (newLimit) params.set("limit", String(newLimit));
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const pages = useMemo(() => getPageNumbers(page, totalPages), [page, totalPages]);

  if (totalItems <= 0) return null;

  const btnBase =
    "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-coffee/30";

  return (
    <nav aria-label="Pagination" className={`flex flex-col sm:flex-row items-center justify-between gap-4 ${className}`}>
      <p className="text-sm text-cocoa/70">
        Showing <span className="font-semibold text-ink">{start}</span>–
        <span className="font-semibold text-ink">{end}</span> of{" "}
        <span className="font-semibold text-ink">{totalItems.toLocaleString()}</span>
      </p>

      <div className="flex items-center gap-1.5">
        <button
          onClick={() => navigate(page - 1)}
          disabled={page <= 1}
          className={`${btnBase} ${page <= 1 ? "text-cocoa/30 cursor-not-allowed" : "text-cocoa hover:bg-card"}`}
          aria-label="Previous page"
        >
          ← Prev
        </button>

        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`ellipsis-${i}`} className="px-2 text-cocoa/40">…</span>
          ) : (
            <button
              key={p}
              onClick={() => navigate(p)}
              className={`${btnBase} ${
                p === page ? "bg-coffee text-foam" : "text-cocoa hover:bg-card"
              }`}
              aria-label={`Page ${p}`}
              aria-current={p === page ? "page" : undefined}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => navigate(page + 1)}
          disabled={page >= totalPages}
          className={`${btnBase} ${page >= totalPages ? "text-cocoa/30 cursor-not-allowed" : "text-cocoa hover:bg-card"}`}
          aria-label="Next page"
        >
          Next →
        </button>
      </div>

      <select
        value={limit}
        onChange={(e) => navigate(1, Number(e.target.value))}
        className="px-2 py-1.5 rounded-lg bg-card border border-line text-sm text-ink focus:outline-none focus:ring-2 focus:ring-coffee/30"
        aria-label="Items per page"
      >
        {[10, 20, 50].map((n) => (
          <option key={n} value={n}>{n} / page</option>
        ))}
      </select>
    </nav>
  );
}
