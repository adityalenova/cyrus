/* ══ code-review-checklist/model.ts — per-language code review checks ══ */

export type Language = "typescript" | "python" | "go" | "rust";
export type Category = "correctness" | "performance" | "security" | "style" | "testing";

export interface CheckItem {
  id: string;
  text: string;
  category: Category;
  language: Language | "all";
  checked: boolean;
}

export interface ReviewSummary {
  totalChecks: number;
  completed: number;
  percentage: number;
  byCategory: Record<Category, { total: number; done: number }>;
}

const BASE_CHECKS: Omit<CheckItem, "checked">[] = [
  { id: "err-handling", text: "Error paths are handled and surfaced", category: "correctness", language: "all" },
  { id: "edge-cases", text: "Edge cases (null, empty, boundary) covered", category: "correctness", language: "all" },
  { id: "no-secrets", text: "No hardcoded secrets or credentials", category: "security", language: "all" },
  { id: "input-valid", text: "User input is validated and sanitized", category: "security", language: "all" },
  { id: "naming", text: "Variables and functions named clearly", category: "style", language: "all" },
  { id: "tests-added", text: "New tests cover the changed logic", category: "testing", language: "all" },
  { id: "no-console", text: "No debug console.log left in", category: "style", language: "typescript" },
  { id: "strict-types", text: "No any types without justification", category: "correctness", language: "typescript" },
  { id: "py-typing", text: "Type hints on public functions", category: "style", language: "python" },
  { id: "go-errors", text: "Errors checked, not discarded", category: "correctness", language: "go" },
  { id: "rust-unwrap", text: "No unwrap() on Result in production paths", category: "correctness", language: "rust" },
  { id: "perf-nplus1", text: "No N+1 query or loop-in-loop on collections", category: "performance", language: "all" },
];

export function checksFor(lang: Language): CheckItem[] {
  return BASE_CHECKS
    .filter((c) => c.language === "all" || c.language === lang)
    .map((c) => ({ ...c, checked: false }));
}

export function toggleCheck(id: string, checks: CheckItem[]): CheckItem[] {
  return checks.map((c) => c.id === id ? { ...c, checked: !c.checked } : c);
}

export function summarize(checks: CheckItem[]): ReviewSummary {
  const byCategory: Record<string, { total: number; done: number }> = {};
  for (const c of checks) {
    if (!byCategory[c.category]) byCategory[c.category] = { total: 0, done: 0 };
    byCategory[c.category].total++;
    if (c.checked) byCategory[c.category].done++;
  }
  const completed = checks.filter((c) => c.checked).length;
  return { totalChecks: checks.length, completed, percentage: checks.length ? Math.round(completed / checks.length * 100) : 0, byCategory: byCategory as Record<Category, { total: number; done: number }> };
}

export function toReviewMarkdown(checks: CheckItem[], lang: Language): string {
  const lines = ["## Code Review — " + lang, ""];
  const cats = new Set(checks.map((c) => c.category));
  for (const cat of cats) {
    lines.push("### " + cat.charAt(0).toUpperCase() + cat.slice(1));
    for (const c of checks.filter((x) => x.category === cat)) {
      lines.push((c.checked ? "- [x] " : "- [ ] ") + c.text);
    }
    lines.push("");
  }
  return lines.join("\n");
}
