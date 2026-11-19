import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Sidebar animation direction tests (#116)
 *
 * The mobile sidebar should slide in from the LEFT side of the screen
 * (left-to-right animation). These tests verify both the component
 * positioning and the CSS animation keyframes are correct.
 */

const NAV_SRC = readFileSync(resolve(__dirname, "../components/Nav.tsx"), "utf-8");
const CSS_SRC = readFileSync(resolve(__dirname, "../app/globals.css"), "utf-8");

describe("Mobile sidebar animation direction (#116)", () => {
  /* ── Sidebar positioning ── */

  it("sidebar sheet is anchored to the left edge (left-0), not right-0", () => {
    // The <aside> that acts as the mobile menu should be fixed to the left
    expect(NAV_SRC).toContain("left-0");
    expect(NAV_SRC).not.toMatch(/fixed\s[^"]*right-0[^"]*aside|aside[^"]*right-0/);
  });

  it("sidebar has right border and right rounding (panel slides from left)", () => {
    expect(NAV_SRC).toContain("border-r");
    expect(NAV_SRC).toContain("rounded-r-[28px]");
    // Should NOT have left-side border/rounding (that's for a right-side panel)
    expect(NAV_SRC).not.toMatch(/border-l\b.*border-line.*rounded-l-\[28px\]/);
  });

  /* ── CSS animation keyframes ── */

  it("sheetIn animation starts from translateX(-100%) for left-to-right slide", () => {
    // Extract the full sheetIn keyframe declaration
    const sheetInMatch = CSS_SRC.match(/@keyframes\s+sheetIn\s*\{(.+?)\}\s*\}/s);
    expect(sheetInMatch).not.toBeNull();
    const keyframeBody = sheetInMatch![1];

    // Should translate from -100% (off-screen left) to 0
    expect(keyframeBody).toContain("translateX(-100%)");
    expect(keyframeBody).toContain("translateX(0)");

    // Should NOT use positive 100% (that's right-to-left)
    expect(keyframeBody).not.toContain("translateX(100%)");
  });

  /* ── Overlay backdrop ── */

  it("overlay backdrop still covers full screen", () => {
    expect(NAV_SRC).toContain("fixed inset-0");
    expect(NAV_SRC).toContain("fadeIn");
  });

  /* ── Responsive rounding override ── */

  it("removes border-r on small screens (max-[1023px]:border-r-0)", () => {
    expect(NAV_SRC).toContain("max-[1023px]:border-r-0");
  });

  /* ── Hamburger button is still present ── */

  it("hamburger button renders for non-desktop viewports", () => {
    expect(NAV_SRC).toContain("lg:hidden");
    expect(NAV_SRC).toContain("Open menu");
    expect(NAV_SRC).toContain("Close menu");
  });
});
