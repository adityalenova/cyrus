/* ══ proposal-word-budget/model.ts — pure deterministic logic ══ */

export interface ProposalWordBudgetEntry {
  id: string;
  key: string;
  score: number;
  status: "active" | "pending" | "archived";
  tags: string[];
  updatedAt: number;
}

export interface ProposalWordBudgetSummary {
  total: number;
  active: number;
  avgScore: number;
  topTag: string | null;
}

export function createProposalWordBudgetEntry(
  id: string,
  key: string,
  score: number,
  tags: string[] = [],
  now: number = 0,
): ProposalWordBudgetEntry {
  return {
    id: id.trim(),
    key: key.trim().toLowerCase(),
    score: Math.max(0, Math.min(100, Math.round(score))),
    status: "active",
    tags: [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))],
    updatedAt: now,
  };
}

export function filterActive(entries: ProposalWordBudgetEntry[]): ProposalWordBudgetEntry[] {
  return entries.filter((e) => e.status === "active");
}

export function sortByScore(entries: ProposalWordBudgetEntry[]): ProposalWordBudgetEntry[] {
  return [...entries].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

export function archiveEntry(entries: ProposalWordBudgetEntry[], id: string): ProposalWordBudgetEntry[] {
  return entries.map((e) => (e.id === id ? { ...e, status: "archived" } : e));
}

export function summarizeProposalWordBudget(entries: ProposalWordBudgetEntry[]): ProposalWordBudgetSummary {
  const active = filterActive(entries);
  const avgScore = entries.length
    ? Math.round(entries.reduce((sum, e) => sum + e.score, 0) / entries.length)
    : 0;
  const tagCounts = new Map<string, number>();
  for (const e of entries) {
    for (const t of e.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  }
  let topTag: string | null = null;
  let best = 0;
  for (const [tag, count] of tagCounts.entries()) {
    if (count > best) { best = count; topTag = tag; }
  }
  return { total: entries.length, active: active.length, avgScore, topTag };
}

export function searchProposalWordBudget(entries: ProposalWordBudgetEntry[], query: string): ProposalWordBudgetEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter(
    (e) => e.key.includes(q) || e.tags.some((t) => t.includes(q)),
  );
}
