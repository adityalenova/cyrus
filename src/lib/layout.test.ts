/* ══ layout.test.ts — the header lives in the same column as the page ══
   Issue #207: the floating header was the one full-width shell that had drifted
   off the site's content column, so on a wide screen its left and right edges
   sat outside the grid everything else is centred in - exactly the "spacing
   differs between pages" a visitor sees comparing /programs with /organizations.
   A browser test can only catch the symptom after it ships; this reads the
   source and pins the invariant, so the chrome cannot quietly drift again. ══ */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..");
const SHELL = /max-w-\[(\d+)px\] mx-auto/g;

/** the first centred shell width in a file - the one that lays out its content */
const firstShell = (text: string): number | undefined => {
  const m = text.match(/max-w-\[(\d+)px\] mx-auto/);
  return m ? Number(m[1]) : undefined;
};

const header = readFileSync(join(SRC, "components", "Nav.tsx"), "utf8");
const footer = readFileSync(join(SRC, "components", "Footer.tsx"), "utf8");

/** every centred shell width across the whole app, all matches */
function allShells(dir: string, acc: number[] = []): number[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) allShells(p, acc);
    else if (e.name.endsWith(".tsx"))
      for (const m of readFileSync(p, "utf8").matchAll(SHELL)) acc.push(Number(m[1]));
  }
  return acc;
}

describe("the header shares the page's column", () => {
  it("a centred shell is readable from the header and the footer", () => {
    expect(firstShell(header)).toBeTypeOf("number");
    expect(firstShell(footer)).toBeTypeOf("number");
  });

  it("the header is centred in the same column as the footer", () => {
    expect(firstShell(header)).toBe(firstShell(footer));
  });

  it("that column is the site's own standard, not a one-off", () => {
    const widths = allShells(SRC);
    const counts = new Map<number, number>();
    for (const w of widths) counts.set(w, (counts.get(w) ?? 0) + 1);
    const standard = [...counts].sort((a, b) => b[1] - a[1])[0][0];
    expect(firstShell(header)).toBe(standard);
  });

  it("the header declares exactly one shell, so it cannot disagree with itself", () => {
    const inHeader = [...header.matchAll(SHELL)].map((m) => Number(m[1]));
    expect(inHeader).toHaveLength(1);
    expect(inHeader[0]).toBe(1240);
  });
});
