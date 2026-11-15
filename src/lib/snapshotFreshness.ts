/* ══ snapshotFreshness.ts — index snapshot freshness & formatting ══════
   The issue index is populated from periodically refreshed GitHub crawls.
   To distinguish indexed snapshots from live GitHub state, the UI surfaces
   the server-supplied crawl timestamp with clarifying copy and a visual
   freshness cue. ═══════════════════════════════════════════════════════ */

export const SNAPSHOT_STALE_DAYS = 14;

export type SnapshotFreshnessStatus = "recent" | "stale" | "unknown";

export type SnapshotFreshness = {
  status: SnapshotFreshnessStatus;
  isStale: boolean;
  isRecent: boolean;
  ageInDays: number | null;
  rawDate: string | null;
  formattedDate: string;
  badgeText: string;
  clarificationText: string;
  label: string;
};

/**
 * Safely format a date string (YYYY-MM-DD or ISO) into a human-readable date.
 * Returns a fallback string if the input is missing, empty, or invalid.
 */
export function formatSnapshotDate(dateStr?: unknown): string {
  if (typeof dateStr !== "string" || !dateStr.trim()) {
    return "Date unavailable";
  }
  const clean = dateStr.trim();
  // Support YYYY-MM-DD or full ISO strings
  const parsed = new Date(clean.includes("T") ? clean : `${clean}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return "Date unavailable";
  }
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Evaluate the freshness of an indexed snapshot.
 * Uses timestamps supplied by the server (generated and serverTime) rather than the browser clock.
 * Handles missing or invalid metadata gracefully without throwing.
 */
export function getSnapshotFreshness(
  generated?: unknown,
  serverTime?: unknown,
  options?: { staleDays?: number },
): SnapshotFreshness {
  const staleDays = options?.staleDays ?? SNAPSHOT_STALE_DAYS;

  if (typeof generated !== "string" || !generated.trim()) {
    return {
      status: "unknown",
      isStale: false,
      isRecent: false,
      ageInDays: null,
      rawDate: null,
      formattedDate: "Date unavailable",
      badgeText: "Index snapshot date unavailable",
      clarificationText: "Reflects crawled index snapshot, not live GitHub state.",
      label: "Index snapshot (date unavailable)",
    };
  }

  const cleanGenerated = generated.trim();
  const genDate = new Date(cleanGenerated.includes("T") ? cleanGenerated : `${cleanGenerated}T00:00:00Z`);
  if (Number.isNaN(genDate.getTime())) {
    return {
      status: "unknown",
      isStale: false,
      isRecent: false,
      ageInDays: null,
      rawDate: cleanGenerated,
      formattedDate: "Date unavailable",
      badgeText: "Index snapshot date unavailable",
      clarificationText: "Reflects crawled index snapshot, not live GitHub state.",
      label: "Index snapshot (date unavailable)",
    };
  }

  const formattedDate = formatSnapshotDate(cleanGenerated);

  // Compute reference time using serverTime if supplied by server
  let refMs: number;
  if (typeof serverTime === "string" && serverTime.trim()) {
    const parsedRef = new Date(serverTime.trim()).getTime();
    refMs = Number.isNaN(parsedRef) ? genDate.getTime() : parsedRef;
  } else {
    refMs = genDate.getTime();
  }

  const diffMs = refMs - genDate.getTime();
  const ageInDays = Math.max(0, Math.floor(diffMs / (86_400 * 1000)));
  const isStale = ageInDays > staleDays;

  if (isStale) {
    return {
      status: "stale",
      isStale: true,
      isRecent: false,
      ageInDays,
      rawDate: cleanGenerated,
      formattedDate,
      badgeText: `Stale index snapshot (${formattedDate})`,
      clarificationText: `Index snapshot is ${ageInDays}d old; live GitHub thread state may differ.`,
      label: `Stale index snapshot · Refreshed ${formattedDate}`,
    };
  }

  return {
    status: "recent",
    isStale: false,
    isRecent: true,
    ageInDays,
    rawDate: cleanGenerated,
    formattedDate,
    badgeText: `Index snapshot: Refreshed ${formattedDate}`,
    clarificationText: "Reflects crawled index snapshot, not live GitHub state.",
    label: `Index snapshot · Refreshed ${formattedDate}`,
  };
}
