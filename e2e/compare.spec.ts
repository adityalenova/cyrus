/* ══ e2e/compare.spec.ts — the side-by-side table in the browser ═══════
   Issue #192: up to three projects, a shareable URL, differences
   highlighted, and a stacked view on a narrow screen. The column maths and
   the ?c= contract are asserted in src/lib/compare.test.ts; this spec pins
   what a visitor actually gets: picks rewrite the address, the link reopens
   the same columns, an attribute nobody publishes is labelled rather than
   guessed at, and at 390px the table becomes blocks.                      ═ */
import { expect, test, type Page } from "@playwright/test";

/* Choose the first candidate and wait for the address to hold that many picks, so the next
   click never lands on a list that has not re-rendered yet. */
async function pickFirst(page: Page, picks: number) {
  await page.getByRole("listitem").nth(0).getByRole("button").click();
  await expect.poll(() => new URL(page.url()).searchParams.getAll("c").length).toBe(picks);
}

test.describe("side-by-side project comparison", () => {
  test("an empty comparison says so instead of showing an empty table", async ({ page }) => {
    await page.goto("/compare");
    await expect(page.getByRole("heading", { name: /compare side by side/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Nothing chosen yet")).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(0);
  });

  test("picking projects puts them in the address bar", async ({ page }) => {
    await page.goto("/compare");
    const first = page.getByRole("listitem").first().getByRole("button");
    await first.click();
    await expect(page).toHaveURL(/[?&]c=/);
    await expect(page.getByRole("table")).toBeVisible();
  });

  test("a shared link reopens the same selection", async ({ page }) => {
    await page.goto("/compare");
    await pickFirst(page, 1);
    await pickFirst(page, 2);
    const url = page.url();
    await expect(page).toHaveURL(/c=.+&c=.+/);

    await page.goto(url);
    await expect(page.getByRole("table")).toBeVisible();
    /* the column count is what the URL asked for, not what re-rendered */
    await expect(page.getByRole("columnheader")).toHaveCount(3); // attribute column + 2 projects
  });

  test("the third pick at the cap drops the oldest column, never adds a fourth", async ({ page }) => {
    await page.goto("/compare");
    for (let i = 0; i < 4; i++) await pickFirst(page, Math.min(i + 1, 3));
    await expect(page).toHaveURL(/^(?!.*&c=.*&c=.*&c=.*&c=)/);
    await expect(page.getByRole("columnheader")).toHaveCount(4); // attribute column + 3 projects
    await expect(page.getByRole("status")).toContainText(/drops the oldest/i);
  });

  test("an attribute no source states is labelled, not invented", async ({ page }) => {
    await page.goto("/compare");
    const items = page.getByRole("listitem");
    await items.nth(0).getByRole("button").click();
    await items.nth(0).getByRole("button").click();
    const unpublished = page.getByText("Not published", { exact: true });
    await expect(unpublished.first()).toBeVisible();
    /* no difficulty column is ever rendered, published or not */
    await expect(page.getByRole("rowheader", { name: /difficulty/i })).toHaveCount(0);
  });

  test("removing a column rewrites the query", async ({ page }) => {
    await page.goto("/compare");
    const items = page.getByRole("listitem");
    await items.nth(0).getByRole("button").click();
    await items.nth(0).getByRole("button").click();
    await page.getByRole("button", { name: /^Remove / }).first().click();
    await expect(page).not.toHaveURL(/&c=/);
  });

  test("the copy link is the current selection made absolute", async ({ page }) => {
    await page.goto("/compare?c=https%3A%2F%2Fgithub.com%2Fa%2Fb");
    const link = page.getByRole("textbox", { name: /link to this comparison/i });
    await expect(link).toHaveValue(/^https?:\/\/.*\/compare\?c=/);
  });

  test("a stale link names the gap instead of rendering a blank column", async ({ page }) => {
    await page.goto("/compare?c=https%3A%2F%2Fexample.org%2Fno-longer-archived");
    await expect(page.getByRole("status")).toContainText(/no longer resolve/i);
    await expect(page.getByRole("table")).toHaveCount(0);
  });

  test("at phone width the matrix stacks into blocks", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/compare?c=https%3A%2F%2Fgithub.com%2Fa%2Fb");
    await expect(page.getByRole("table")).toBeHidden();
    await expect(page.getByRole("region", { name: /build a comparison/i })).toBeVisible();
  });
});
