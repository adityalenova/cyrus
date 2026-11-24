/* ══ fuzzySearch.ts — the substring matcher behind the catalog search boxes ══
   Matching only: no scoring, no ranking, no typo tolerance. The one behaviour
   worth knowing before changing it is that a blank query is not an empty
   result — callers render the untouched list from the returned array, so an
   empty search box still shows the full table. ══ */

/**
 * Filter `items` down to the entries whose sort key contains `query` as a
 * case-insensitive substring.
 *
 * The text is read through `keySelector` rather than off a fixed field, so the
 * same helper serves repos (`owner/name`), organizations (`login`) and programs
 * without reshaping the records into a searchable copy first.
 *
 * @typeParam T - element type of the list being searched.
 * @param query - raw user input. Surrounding whitespace is ignored, and an
 *   empty or whitespace-only query returns `items` unchanged rather than `[]`.
 * @param items - the list to filter. Not mutated.
 * @param keySelector - returns the text to match against for a single item.
 * @returns a new array of matches in their original order, or `items` itself
 *   when `query` is blank.
 * @example
 * fuzzySearch("cur", ["cursor/cursor", "vercel/next.js", "CursorX/rules"], (s) => s);
 * // => ["cursor/cursor", "CursorX/rules"]
 * @example
 * fuzzySearch("   ", ["cursor/cursor"], (s) => s);
 * // => ["cursor/cursor"] — a blank query is not a filter
 */
export function fuzzySearch<T>(query: string, items: T[], keySelector: (item: T) => string): T[] {
  if (!query.trim()) return items;
  const q = query.toLowerCase().trim();
  return items.filter(i => keySelector(i).toLowerCase().includes(q));
}
