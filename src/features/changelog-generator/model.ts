/* ══ changelog-generator/model.ts — pure logic for Add automated changelog generator from conventional commit history ══ */

export interface ChangelogGeneratorConfig {
  id: string;
  name: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ChangelogGeneratorItem {
  id: string;
  label: string;
  value: string;
  category: string;
  priority: number;
  metadata: Record<string, string>;
}

export function createChangelogGenerator(name: string, now: number): ChangelogGeneratorConfig {
  return { id: crypto.randomUUID ? crypto.randomUUID() : String(now), name, enabled: true, createdAt: now, updatedAt: now };
}

export function sortByPriority(items: ChangelogGeneratorItem[]): ChangelogGeneratorItem[] {
  return [...items].sort((a, b) => b.priority - a.priority);
}

export function filterByCategory(items: ChangelogGeneratorItem[], category: string): ChangelogGeneratorItem[] {
  return items.filter((i) => i.category === category);
}

export function searchItems(items: ChangelogGeneratorItem[], query: string): ChangelogGeneratorItem[] {
  const q = query.toLowerCase();
  return items.filter((i) => i.label.toLowerCase().includes(q) || i.value.toLowerCase().includes(q));
}

export function countByCategory(items: ChangelogGeneratorItem[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const i of items) counts[i.category] = (counts[i.category] ?? 0) + 1;
  return counts;
}

export function validateConfig(config: ChangelogGeneratorConfig): string[] {
  const errors: string[] = [];
  if (!config.name || config.name.trim().length === 0) errors.push("Name is required");
  if (config.name && config.name.length > 100) errors.push("Name must be under 100 characters");
  if (config.createdAt > config.updatedAt) errors.push("updatedAt must be >= createdAt");
  return errors;
}

export function merge(a: ChangelogGeneratorItem[], b: ChangelogGeneratorItem[]): ChangelogGeneratorItem[] {
  const map = new Map(a.map((i) => [i.id, i]));
  for (const item of b) map.set(item.id, item);
  return [...map.values()];
}

export function stats(items: ChangelogGeneratorItem[]): { total: number; categories: number; avgPriority: number } {
  const categories = new Set(items.map((i) => i.category)).size;
  const avgPriority = items.length > 0 ? Math.round(items.reduce((s, i) => s + i.priority, 0) / items.length) : 0;
  return { total: items.length, categories, avgPriority };
}
