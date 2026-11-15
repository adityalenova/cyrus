/* ══ Accessibility, audited in a real browser.
   axe-core is not a dependency of this repo and adding one for a test suite
   would be the easy way out: the rules below are the ones that decide whether
   a keyboard or screen-reader visitor can use a directory site at all - one
   h1 per page, headings that never skip a level, every image having an
   explicit alt decision, every control having a name a reader can hear,
   landmarks that are labelled when there is more than one of them, a skip
   link that actually moves focus, and a focus ring that is visible rather
   than merely present in the CSS. They run over the whole route list, which
   is where a hand-written audit earns its keep: a template shared by twelve
   pages either passes everywhere or is broken everywhere.                    ═ */
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "fs";

const ROUTES = [
  "/", "/issues", "/programs", "/organizations", "/organizations/stats",
  "/skills", "/projects", "/sponsors", "/leaderboard", "/about",
  "/platform/features", "/platform/how", "/platform/trust",
  "/terms", "/privacy", "/cookies",
  "/programs/gsoc", "/programs/gsoc/organizations", "/programs/outreachy",
  "/programs/lfx", "/programs/nsoc",
];

/* The rules live in e2e/a11y-audit.js, as plain browser JavaScript, and are
   injected as a script tag rather than written here in TypeScript: Playwright
   serialises an evaluate callback's source verbatim, so any annotation inside
   it reaches the page as a syntax error. Keeping the scan in its own file also
   lets scratch/a11y-report.mjs print the same findings without asserting, which
   is how the thresholds below were set against the real distribution.        */
const AUDIT = readFileSync(new URL("a11y-audit.js", import.meta.url), "utf8");

type Findings = {
  lang: string; mains: number; h1: string[]; headingSkips: string[];
  imgNoAlt: string[]; imgDecorativeAlone: string[]; unnamed: string[];
  placeholderOnly: string[]; unnamedNav: string[]; lowContrast: string[];
  landmarks: Record<string, number>;
};

async function audit(page: Page, path: string): Promise<Findings> {
  /* The intro curtain is a one-time overlay. While it is up it is the surface
     every element on the page is painted against, so a background sampled by
     walking up the tree reads the curtain's paper rather than the graphite
     band underneath - twenty-odd false contrast failures on the home page,
     but only on a first visit. Skip it the way a returning visitor does. */
  await page.addInitScript(() => {
    try { sessionStorage.setItem("cyrus-splashed", "1"); } catch { /* private mode */ }
  });
  await page.goto(path, { waitUntil: "load" });
  await page.waitForTimeout(1400);                    /* let the panels settle - the audit reads the finished page */
  await page.addScriptTag({ content: AUDIT });
  return page.evaluate("window.__cyrusA11yScan()") as Promise<Findings>;
}

/* Both themes, every route. Light is the harder case: the island bands stay
   graphite while the accent family darkens for the paper surfaces, so a token
   change that reads fine on a card can drop under 3:1 on a band. */
for (const theme of ["dark", "light"] as const) {
  test.describe(`accessibility in ${theme} mode`, () => {
    for (const path of ROUTES) {
      test(`${path} - structure, names and contrast`, async ({ page }) => {
        await page.addInitScript((t) => {
          try { localStorage.setItem("agenthub.theme", JSON.stringify(t)); } catch { /* private mode */ }
        }, theme);
        const f = await audit(page, path);

        expect(f.lang, `${path}: <html> needs a lang`).toBe("en");
        expect(f.mains, `${path}: exactly one main landmark`).toBe(1);
        expect(f.h1, `${path}: exactly one h1`).toHaveLength(1);
        expect(f.headingSkips, `${path}: headings skip a level\n${f.headingSkips.join("\n")}`).toEqual([]);
        expect(f.imgNoAlt, `${path}: images with no alt attribute\n${f.imgNoAlt.join("\n")}`).toEqual([]);
        expect(f.imgDecorativeAlone, `${path}: alt="" with nothing to describe\n${f.imgDecorativeAlone.join("\n")}`).toEqual([]);
        expect(f.unnamed, `${path}: controls with no accessible name\n${f.unnamed.join("\n")}`).toEqual([]);
        expect(f.placeholderOnly, `${path}: fields named only by placeholder\n${f.placeholderOnly.join("\n")}`).toEqual([]);
        expect(f.unnamedNav, `${path}: unlabelled <nav> landmarks\n${f.unnamedNav.join("\n")}`).toEqual([]);
        expect(f.lowContrast, `${path}: text below the contrast minimum\n${f.lowContrast.slice(0, 25).join("\n")}`)
          .toEqual([]);
      });
    }
  });
}

/* ── keyboard, on the two pages a visitor actually lands on ─────────── */
for (const path of ["/", "/issues"]) {
  test(`${path} — the skip link is first, visible, and moves focus to the content`, async ({ page }) => {
    await page.goto(path, { waitUntil: "load" });
    await page.keyboard.press("Tab");
    const first = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const r = el.getBoundingClientRect();
      return { text: el.textContent?.trim() ?? "", cls: String(el.className), top: r.top, left: r.left };
    });
    expect(first.text, "first Tab should land on the skip link").toBe("Skip to content");
    expect(first.top, "a skip link parked off-screen is not usable").toBeGreaterThanOrEqual(0);
    await page.keyboard.press("Enter");
    const focused = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      return { id: el.id, tag: el.tagName };
    });
    expect(focused.id, "Enter moves focus into the main content").toBe("main");
  });

  test(`${path} — the header controls ring on keyboard focus`, async ({ page }) => {
    await page.goto(path, { waitUntil: "load" });
    const pill = page.locator("header nav a[href]").nth(2);
    await pill.focus();
    const ring = await pill.evaluate((el) => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return { w: s.outlineWidth, c: s.outlineColor, off: s.outlineOffset, x: r.left, y: r.top };
    });
    expect(parseFloat(ring.w), `focus outline width (${ring.w}) must be visible`).toBeGreaterThanOrEqual(2);
    expect(ring.c).not.toBe("rgba(0, 0, 0, 0)");
    expect(ring.x, "focused control must be on screen").toBeGreaterThanOrEqual(0);
  });
}

/* ── touch targets, on a phone ─────────────────────────────────────────── */
test("the phone header is operable with a thumb", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "load" });
  /* The site navigation, not every <header> on the page: the hero is a header
     too, and its quick-jump chips are inline text links, which the target-size
     rule does not count. The strip a thumb has to hit repeatedly is this one. */
  const small = await page.evaluate(() => {
    const nav = document.querySelector("nav.sticky") ?? document.querySelector("header nav");
    if (!nav) return ["no navigation in the DOM"];
    const bad: string[] = [];
    for (const el of Array.from(nav.querySelectorAll("a, button, input"))) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;                    /* hidden at this width */
      if (r.height < 36 || r.width < 36)
        bad.push(`${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 20)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return bad;
  });
  expect(small, `header controls under 36px on a phone\n${small.join("\n")}`).toEqual([]);
});

/* ── the drawer is a real modal: named, focused, trapped, reversible ─────── */
test("the mobile menu is a labelled modal that returns focus", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "load" });
  const open = page.getByRole("button", { name: "Open menu" });
  await expect(open).toBeVisible();
  await open.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  expect(await dialog.getAttribute("aria-label"), "drawer needs a name so a reader says what opened").toBeTruthy();

  /* "inside the panel", or null - reported as a name so a failure says which
     control leaked, not just that one did. Icon-only buttons have no text, so
     read the accessible name the way the audit does. */
  const inPanel = () => page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    if (!dlg || !dlg.contains(document.activeElement)) return null;
    const el = document.activeElement as HTMLElement;
    return (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 24) || el.tagName.toLowerCase();
  });
  expect(await inPanel(), "opening the drawer must move focus into it").toBeTruthy();

  /* Twenty Tabs should never leave the sheet. This is the check that matters,
     because the overlay hides the page behind it: a link still in the tab
     order there is a keyboard trap in reverse. */
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press("Tab");
    expect(await inPanel(), `Tab ${i + 1} escaped the drawer`).toBeTruthy();
  }

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  const back = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    return el?.getAttribute("aria-label") ?? el?.textContent?.trim() ?? "";
  });
  expect(back, "closing the drawer returns focus to the button that opened it").toMatch(/menu/i);
});

/* ── reduced motion: nothing may animate ───────────────────────────────── */
test("prefers-reduced-motion stops the movement", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1280, height: 900 } });
  const page: Page = await ctx.newPage();
  await page.goto("/", { waitUntil: "load" });
  await page.waitForTimeout(1_500);
  const moving = await page.evaluate(() => {
    const bad: string[] = [];
    for (const el of Array.from(document.querySelectorAll("*")) as HTMLElement[]) {
      const s = getComputedStyle(el);
      if (s.animationName !== "none" && parseFloat(s.animationDuration) > 0.05) {
        const r = el.getBoundingClientRect();
        if (r.width && r.height) bad.push(`${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]} ${s.animationName}`);
      }
      if (s.transitionProperty.includes("transform") && parseFloat(s.transitionDuration) > 0.3)
        bad.push(`${el.tagName.toLowerCase()} transform transition ${s.transitionDuration}s`);
    }
    return bad;
  });
  expect(moving, `still animating under reduced motion:\n${[...new Set(moving)].slice(0, 12).join("\n")}`)
    .toEqual([]);
  await ctx.close();
});
