import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

describe("Logo and Favicon Dark Mode Visibility", () => {
  const faviconSvgPath = join(process.cwd(), "public/favicon.svg");
  const faviconDarkSvgPath = join(process.cwd(), "public/favicon-dark.svg");
  const faviconLightSvgPath = join(process.cwd(), "public/favicon-light.svg");

  it("ensures public/favicon.svg supports color-scheme and has light fill for dark mode", () => {
    expect(existsSync(faviconSvgPath)).toBe(true);
    const content = readFileSync(faviconSvgPath, "utf-8");
    expect(content).toContain("color-scheme: light dark");
    expect(content).toContain("#f5f5f5");
  });

  it("ensures public/favicon-dark.svg exists and uses crisp light fill", () => {
    expect(existsSync(faviconDarkSvgPath)).toBe(true);
    const content = readFileSync(faviconDarkSvgPath, "utf-8");
    expect(content).toContain("#ffffff");
  });

  it("ensures public/favicon-light.svg exists and uses dark fill", () => {
    expect(existsSync(faviconLightSvgPath)).toBe(true);
    const content = readFileSync(faviconLightSvgPath, "utf-8");
    expect(content).toContain("#12161a");
  });
});
