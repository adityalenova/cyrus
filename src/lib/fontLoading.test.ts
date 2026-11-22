/* Guards issue #6: the three faces must come from our own origin through
 * next/font. A render-blocking stylesheet on a third-party host costs the
 * largest paint on every cold visit, and it is easy to add back by accident. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const layout = readFileSync(join(__dirname, "..", "app", "[locale]", "layout.tsx"), "utf8");
const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf8");

const tokenLine = (token: string) =>
  css.split("\n").find((l) => l.trim().startsWith(`${token}:`)) ?? "";

describe("font loading", () => {
  it("never asks a third party for font files", () => {
    for (const [name, src] of [["layout.tsx", layout], ["globals.css", css]] as const) {
      expect(src, `${name} still points at Google Fonts`).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
    }
  });

  it("declares every family through next/font", () => {
    expect(layout).toMatch(/from "next\/font\/google"/);
    for (const variable of ["--font-jakarta", "--font-inter", "--font-jbmono"]) {
      expect(layout, `${variable} is not declared`).toContain(`variable: "${variable}"`);
    }
  });

  it("binds the theme tokens to the next/font variables", () => {
    const bindings = [
      ["--font-display", "--font-jakarta"],
      ["--font-sans", "--font-inter"],
      ["--font-mono", "--font-jbmono"],
    ] as const;
    for (const [token, variable] of bindings) {
      const line = tokenLine(token);
      expect(line, `${token} is not defined in @theme`).toBeTruthy();
      expect(line, `${token} does not use ${variable}`).toContain(`var(${variable})`);
    }
  });
});
