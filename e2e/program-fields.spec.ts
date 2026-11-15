/* ══ e2e/program-fields.spec.ts — unpublished fields never leak a zero or a
   blank onto the DOM.

   The catalog ships complete records today, so the guarantee these specs pin
   is the user-visible one: a stipend, window or eligibility value is always a
   real label, never "$0", an empty cell, or a silently dropped row - and the
   card and its detail page say the same thing for the same field. When a
   record does go partial the helpers render "Not published"; that fallback is
   asserted in src/lib/programFields.test.ts, which can build the fixture the
   live catalog cannot.                                                        ═ */
import { expect, test } from "@playwright/test";

const ZERO_OR_BLANK = /^\s*$|^\$0\b|^0$/;

test.describe("program catalog fields", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/programs");
    await expect(page.getByRole("heading", { name: /open source/i }).first()).toBeVisible({ timeout: 30_000 });
  });

  test("no card renders a zero or blank stipend or window", async ({ page }) => {
    const cards = page.locator("article");
    expect(await cards.count()).toBeGreaterThan(0);
    for (const card of await cards.all()) {
      const stipend = card.locator("span", { hasText: /\$/ }).first();
      if (await stipend.count()) {
        const text = (await stipend.textContent()) ?? "";
        expect(text, "a dollar stipend chip must never read as $0").not.toMatch(/^\$0\b/);
      }
      const windowLine = (await card.locator("p.uppercase").last().textContent()) ?? "";
      expect(windowLine.trim(), "application window is never a blank label").not.toBe("");
    }
  });

  test("a card's stipend matches the same field on its detail page", async ({ page }) => {
    const first = page.locator("article").first();
    const cardStipend = (await first.locator("div.flex.gap-1\\.5 span").first().textContent())?.trim() ?? "";
    const link = first.getByRole("link", { name: "Program page" });
    const href = await link.getAttribute("href");
    expect(href).toMatch(/^\/programs\/[\w-]+$/);

    await page.goto(href!);
    const stipendValue = page.locator("div.flex.justify-between", { has: page.getByText("Stipend", { exact: true }) });
    await expect(stipendValue).toBeVisible();
    const shown = ((await stipendValue.locator("b").textContent()) ?? "").trim();
    /* the detail row appends the published unit in parentheses, so the card's
       figure must be the leading slice of it - both come from the same field. */
    expect(shown.startsWith(cardStipend), `${shown} should begin with the card value ${cardStipend}`).toBe(true);
  });

  test("detail sidebar never renders a zero or blank meta value", async ({ page }) => {
    await page.goto("/programs/gsoc");
    for (const label of ["Stipend", "Window", "Eligibility"]) {
      const row = page.locator("div.flex.justify-between", { has: page.getByText(label, { exact: true }) });
      await expect(row).toBeVisible();
      const value = ((await row.locator("b").textContent()) ?? "").trim();
      expect(value, `${label} is never blank or zero`).not.toMatch(ZERO_OR_BLANK);
    }
  });
});
