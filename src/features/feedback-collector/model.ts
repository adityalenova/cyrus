/* ══ feedback-collector/model.ts — pure logic for Add structured feedback collection system with sentiment analysis ══ */

export interface FeedbackCollectorConfig {
  id: string;
  name: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface FeedbackCollectorItem {
  id: string;
  label: string;
  value: string;
  category: string;
  priority: number;
  metadata: Record<string, string>;
}

export function createFeedbackCollector(name: string, now: number): FeedbackCollectorConfig {
  return { id: crypto.randomUUID ? crypto.randomUUID() : String(now), name, enabled: true, createdAt: now, updatedAt: now };
}

export function sortByPriority(items: FeedbackCollectorItem[]): FeedbackCollectorItem[] {
  return [...items].sort((a, b) => b.priority - a.priority);
}

export function filterByCategory(items: FeedbackCollectorItem[], category: string): FeedbackCollectorItem[] {
  return items.filter((i) => i.category === category);
}

export function searchItems(items: FeedbackCollectorItem[], query: string): FeedbackCollectorItem[] {
  const q = query.toLowerCase();
  return items.filter((i) => i.label.toLowerCase().includes(q) || i.value.toLowerCase().includes(q));
}

export function countByCategory(items: FeedbackCollectorItem[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const i of items) counts[i.category] = (counts[i.category] ?? 0) + 1;
  return counts;
}

export function validateConfig(config: FeedbackCollectorConfig): string[] {
  const errors: string[] = [];
  if (!config.name || config.name.trim().length === 0) errors.push("Name is required");
  if (config.name && config.name.length > 100) errors.push("Name must be under 100 characters");
  if (config.createdAt > config.updatedAt) errors.push("updatedAt must be >= createdAt");
  return errors;
}

export function merge(a: FeedbackCollectorItem[], b: FeedbackCollectorItem[]): FeedbackCollectorItem[] {
  const map = new Map(a.map((i) => [i.id, i]));
  for (const item of b) map.set(item.id, item);
  return [...map.values()];
}

export function stats(items: FeedbackCollectorItem[]): { total: number; categories: number; avgPriority: number } {
  const categories = new Set(items.map((i) => i.category)).size;
  const avgPriority = items.length > 0 ? Math.round(items.reduce((s, i) => s + i.priority, 0) / items.length) : 0;
  return { total: items.length, categories, avgPriority };
}
