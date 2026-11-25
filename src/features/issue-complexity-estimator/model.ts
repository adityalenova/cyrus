/* ══ issue-complexity-estimator/model.ts — multi-factor complexity scoring ══ */

export type Difficulty = "trivial" | "easy" | "medium" | "hard" | "expert";

export interface ComplexityFactors {
  descriptionLength: number;
  codeBlockCount: number;
  linkCount: number;
  labelComplexity: number;    // 0-1 based on labels
  commentCount: number;
  hasReproSteps: boolean;
  filesMentioned: number;
}

export interface ComplexityEstimate {
  difficulty: Difficulty;
  score: number;              // 0-100
  estimatedHours: { min: number; max: number };
  confidence: number;         // 0-1
  factors: ComplexityFactors;
  reasoning: string[];
}

const COMPLEXITY_LABELS: Record<string, number> = {
  "good first issue": 0.1, "beginner": 0.1, "easy": 0.15,
  "bug": 0.3, "enhancement": 0.4, "feature": 0.5,
  "refactor": 0.5, "performance": 0.6, "security": 0.7,
  "architecture": 0.8, "breaking-change": 0.85, "rfc": 0.9,
};

export function labelScore(labels: string[]): number {
  let max = 0;
  for (const l of labels) {
    const key = l.toLowerCase().trim();
    if (COMPLEXITY_LABELS[key] !== undefined && COMPLEXITY_LABELS[key] > max) {
      max = COMPLEXITY_LABELS[key];
    }
  }
  return max;
}

export function descriptionScore(length: number): number {
  if (length < 100) return 10;
  if (length < 300) return 25;
  if (length < 800) return 45;
  if (length < 2000) return 65;
  return 85;
}

export function codeBlockScore(count: number): number {
  return Math.min(count * 12, 60);
}

export function linkScore(count: number): number {
  return Math.min(count * 8, 40);
}

export function commentScore(count: number): number {
  if (count <= 1) return 5;
  if (count <= 5) return 20;
  if (count <= 15) return 45;
  return 70;
}

export function computeComplexity(factors: ComplexityFactors): ComplexityEstimate {
  const reasoning: string[] = [];
  let raw = 0;
  raw += descriptionScore(factors.descriptionLength) * 0.25;
  raw += codeBlockScore(factors.codeBlockCount) * 0.15;
  raw += linkScore(factors.linkCount) * 0.10;
  raw += factors.labelComplexity * 100 * 0.25;
  raw += commentScore(factors.commentCount) * 0.15;
  raw += (factors.hasReproSteps ? 10 : 30) * 0.05;
  raw += Math.min(factors.filesMentioned * 5, 50) * 0.05;
  const score = Math.round(Math.min(100, Math.max(0, raw)));

  if (factors.labelComplexity >= 0.7) reasoning.push("High-complexity label detected");
  if (factors.descriptionLength > 1500) reasoning.push("Long description suggests multi-step work");
  if (factors.codeBlockCount >= 3) reasoning.push("Multiple code blocks indicate implementation detail");
  if (factors.commentCount > 10) reasoning.push("Extended discussion implies unclear scope");
  if (factors.filesMentioned >= 5) reasoning.push("Many files referenced — cross-cutting change");
  if (reasoning.length === 0) reasoning.push("Standard issue profile");

  const difficulty = toDifficulty(score);
  const estimatedHours = timeEstimate(difficulty);
  const confidence = factors.descriptionLength > 200 ? 0.8 : 0.5;

  return { difficulty, score, estimatedHours, confidence, factors, reasoning };
}

export function toDifficulty(score: number): Difficulty {
  if (score <= 15) return "trivial";
  if (score <= 30) return "easy";
  if (score <= 55) return "medium";
  if (score <= 78) return "hard";
  return "expert";
}

export function timeEstimate(d: Difficulty): { min: number; max: number } {
  switch (d) {
    case "trivial": return { min: 0.25, max: 1 };
    case "easy":    return { min: 1, max: 3 };
    case "medium":  return { min: 3, max: 8 };
    case "hard":    return { min: 8, max: 24 };
    case "expert":  return { min: 24, max: 80 };
  }
}
