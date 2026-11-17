/* ══ benchmarkSearch.ts — measures search execution duration ═══════ */
export function benchmarkSearchTime(searchFn: () => void, iterations = 100): number {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    searchFn();
  }
  return (performance.now() - start) / iterations;
}
