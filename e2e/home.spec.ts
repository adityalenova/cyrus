/* ══ Home page: the promises the landing screen makes in words.
   These are the lines a person reads and then relies on, so they are the
   lines worth a test — the hero's figures, the handwritten signatures on
   the testimonials, and the order of the two sections that got moved.       ═ */
import { expect, test } from "@playwright/test";

test.describe("home", () => {
  test("hero states the honest figures", async ({ page }) => {
    await page.goto("/");
    const hero = page.locator("#hero");
    await expect(hero.getByRole("heading", { level: 1 })).toContainText("Discover open source");
    /* One sentence, four facts. The program count comes straight out of the
       catalogue, so the page and the directory cannot drift apart. */
    const line = hero.locator("p", { hasText: "one contribution board" });
    await expect(line).toBeVisible();
    await expect(line).toContainText(/real open issues, [\d.,]+k archived program projects, \d+ open-source programs/);
  });

  test("popular organizations sit above the questions", async ({ page }) => {
    await page.goto("/");
    /* #233 moved the shelf. If a later edit pushes it back under the FAQ the
       DOM order below catches it without anyone re-reading the source. */
    const order = await page.evaluate(() => {
      const at = (id: string) => {
        const el = document.getElementById(id);
        if (!el) return -1;
        return Array.from(document.querySelectorAll("#orgs, #faq-home")).indexOf(el);
      };
      return { orgs: at("orgs"), faq: at("faq-home") };
    });
    expect(order.orgs).toBeGreaterThanOrEqual(0);
    expect(order.faq).toBeGreaterThanOrEqual(0);
    expect(order.orgs).toBeLessThan(order.faq);
  });

  test("every testimonial is signed and labelled illustrative", async ({ page }) => {
    await page.goto("/");
    const signs = page.locator(".sign");
    expect(await signs.count()).toBeGreaterThan(0);
    /* The handwriting is the design; the badge beside it is the honesty. A
       card may not carry one without the other. */
    await expect(page.getByText("Illustrative").first()).toBeVisible();
  });

  /* #134 the board rail. Six buttons that each replace the panel underneath
     are a tablist whatever their markup used to say, and a tablist that only
     answers the pointer strands a keyboard user inside it. */
  test("the preview rail keeps one tab stop so focus can leave it", async ({ page }) => {
    await page.goto("/");
    const tabs = page.getByRole("tablist", { name: "Preview sections" }).getByRole("tab");
    await expect(tabs).toHaveCount(6);
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
    await expect(tabs.first()).toHaveAttribute("tabindex", "0");
    await expect(tabs.nth(1)).toHaveAttribute("tabindex", "-1");

    await tabs.first().focus();
    await page.keyboard.press("Tab");
    const stranded = await page.evaluate(() => !!document.activeElement?.closest('[role="tablist"]'));
    expect(stranded).toBe(false);
  });

  test("arrow keys move the selection and the panel follows", async ({ page }) => {
    await page.goto("/");
    const rail = page.getByRole("tablist", { name: "Preview sections" });
    const tabs = rail.getByRole("tab");
    const panel = page.getByRole("tabpanel");
    await expect(rail).toHaveAttribute("aria-orientation", "vertical");

    await tabs.first().focus();
    const before = await panel.innerText();
    await page.keyboard.press("ArrowDown");
    await expect(tabs.nth(1)).toBeFocused();
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(tabs.first()).toHaveAttribute("aria-selected", "false");
    await expect(panel).toHaveAttribute("aria-labelledby", "rail-tab-orgs");
    await expect.poll(() => panel.innerText()).not.toBe(before);

    /* Home/End jump the ends, and stepping off either edge wraps. */
    await page.keyboard.press("End");
    await expect(tabs.nth(5)).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(tabs.first()).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(tabs.nth(5)).toBeFocused();
    await page.keyboard.press("Home");
    await expect(tabs.first()).toBeFocused();
  });

  test("the rail answers the arrows along the axis it is laid out on", async ({ page }) => {
    await page.goto("/");
    await page.setViewportSize({ width: 390, height: 840 });
    const rail = page.getByRole("tablist", { name: "Preview sections" });
    const tabs = rail.getByRole("tab");
    /* Under md the rail is the scrolling row, so Left/Right drive it and
       Up/Down belong to the page again. */
    await expect(rail).toHaveAttribute("aria-orientation", "horizontal");
    await tabs.first().focus();
    await page.keyboard.press("ArrowRight");
    await expect(tabs.nth(1)).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(tabs.first()).toBeFocused();
  });
});
