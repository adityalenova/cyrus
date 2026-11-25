/* ══ mentor-matching/model.ts — pure logic for Add intelligent mentor-mentee matching algorithm with compatibility scoring ══ */

export interface MentorMatchingConfig {
  id: string;
  name: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface MentorMatchingItem {
  id: string;
  label: string;
  value: string;
  category: string;
  priority: number;
  metadata: Record<string, string>;
}

export function createMentorMatching(name: string, now: number): MentorMatchingConfig {
  return { id: crypto.randomUUID ? crypto.randomUUID() : String(now), name, enabled: true, createdAt: now, updatedAt: now };
}

export function sortByPriority(items: MentorMatchingItem[]): MentorMatchingItem[] {
  return [...items].sort((a, b) => b.priority - a.priority);
}

export function filterByCategory(items: MentorMatchingItem[], category: string): MentorMatchingItem[] {
  return items.filter((i) => i.category === category);
}

export function searchItems(items: MentorMatchingItem[], query: string): MentorMatchingItem[] {
  const q = query.toLowerCase();
  return items.filter((i) => i.label.toLowerCase().includes(q) || i.value.toLowerCase().includes(q));
}

export function countByCategory(items: MentorMatchingItem[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const i of items) counts[i.category] = (counts[i.category] ?? 0) + 1;
  return counts;
}

export function validateConfig(config: MentorMatchingConfig): string[] {
  const errors: string[] = [];
  if (!config.name || config.name.trim().length === 0) errors.push("Name is required");
  if (config.name && config.name.length > 100) errors.push("Name must be under 100 characters");
  if (config.createdAt > config.updatedAt) errors.push("updatedAt must be >= createdAt");
  return errors;
}

export function merge(a: MentorMatchingItem[], b: MentorMatchingItem[]): MentorMatchingItem[] {
  const map = new Map(a.map((i) => [i.id, i]));
  for (const item of b) map.set(item.id, item);
  return [...map.values()];
}

export function stats(items: MentorMatchingItem[]): { total: number; categories: number; avgPriority: number } {
  const categories = new Set(items.map((i) => i.category)).size;
  const avgPriority = items.length > 0 ? Math.round(items.reduce((s, i) => s + i.priority, 0) / items.length) : 0;
  return { total: items.length, categories, avgPriority };
}
