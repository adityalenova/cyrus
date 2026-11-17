export function fuzzySearch<T>(query: string, items: T[], keySelector: (item: T) => string): T[] {
  if (!query.trim()) return items;
  const q = query.toLowerCase().trim();
  return items.filter(i => keySelector(i).toLowerCase().includes(q));
}
