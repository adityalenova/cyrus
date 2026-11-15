/* ══ Nav: the one component every page carries.
   Its failure mode is physical — the pill strip overflowing the rounded
   strip it lives in, which is exactly what happened at 1024-1100 and was
   fixed by measurement. So these tests measure.                            ═ */
import { expect, test } from "@playwright/test";

/* The strip and its contents cannot be wider than the viewport. Returns the
   overflow in pixels, if any, for the error message. */
async function navOverflow(page: import("@playwright/test").Page) {
  return page.evaluate(() => ({
    over: document.documentElement.scrollWidth - window.innerWidth,
    body: document.body.scrollWidth - window.innerWidth,
  }));
}

test.describe("desktop nav", () => {
  for (const width of [1280, 1180, 1024]) {
    test(`no horizontal overflow at ${width}`, async ({ page, viewport }) => {
      await page.setViewportSize({ width, height: (viewport?.height ?? 900) });
      await page.goto("/");
      const { over, body } = await navOverflow(page);
      expect(over, `document overflows by ${over}px at ${width}`).toBeLessThanOrEqual(0);
      expect(body, `body overflows by ${body}px at ${width}`).toBeLessThanOrEqual(0);
    });
  }

  test("the full label returns at xl and shortens below it", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    /* Both labels live in the same pill and only one is display:none at a
       time, so visibility - not text - is the measurement. */
    const pill = page.locator("header nav").getByRole("link", { name: /Org/ }).first();
    const full = pill.locator("span", { hasText: "Organizations" });
    const short = pill.locator("span", { hasText: "Orgs" });
    await expect(full).toBeVisible();
    await expect(short).toBeHidden();

    await page.setViewportSize({ width: 1100, height: 900 });
    await expect(full).toBeHidden();
    await expect(short).toBeVisible();
  });
});

test.describe("mobile nav", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the sheet opens and a link navigates", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    const sheet = page.getByRole("dialog", { name: "Site menu" });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("link", { name: "Programs" }).first().click();
    await expect(page).toHaveURL(/\/programs$/);
    /* The sheet owns the route change, so it must not stay open behind it. */
    await expect(sheet).toBeHidden();
  });

  test("escape closes the sheet and gives the page back", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("dialog", { name: "Site menu" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Site menu" })).toBeHidden();
    /* The sheet locks page scroll while it is open; the stylesheet's own
       overflow-x: clip stays, so assert only that the scroll lock is gone. */
    await expect(page.locator("body")).not.toHaveCSS("overflow-y", "hidden");
  });

  test("the drawer does not need scrolling at 360", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    const sheet = page.getByRole("dialog", { name: "Site menu" });
    const box = await sheet.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeLessThanOrEqual(740);
  });
});
