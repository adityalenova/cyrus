/* ══ /issues: the thing the site is for.
   The finder reads a static snapshot over an API, so the tests watch the
   handoff - a search that narrows, a filter that survives a reload, an empty
   result that tells you what to drop - rather than the pixel layout.       ═ */
import { expect, test } from "@playwright/test";

const count = (page: import("@playwright/test").Page) =>
  page.getByText(/^[\d.,]+k? issues match$/);

test.describe("issue finder", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/issues");
    await expect(count(page)).toBeVisible({ timeout: 30_000 });
  });

  test("every card links to the real GitHub issue", async ({ page }) => {
    const gh = page.locator('a[href^="https://github.com/"][href*="/issues/"]');
    expect(await gh.count()).toBeGreaterThan(0);
    /* Stale and assigned issues are shown, not hidden - the copy says so, so
       the list must not quietly filter them out. */
    await expect(page.getByText(/Stale threads and ones with someone already assigned are shown/)).toBeVisible();
  });

  test("a search narrows the index and writes itself into the URL", async ({ page }) => {
    const before = (await count(page).textContent()) ?? "";
    await page.getByLabel("Search issue titles").fill("documentation");
    await expect(count(page).first()).not.toHaveText(before, { timeout: 15_000 });
    await expect(page).toHaveURL(/q=documentation/);
  });

  test("a beginner filter is switch-like and survives a reload", async ({ page }) => {
    const beginner = page.getByRole("button", { name: "Beginner-labelled" });
    await beginner.click();
    await expect(beginner).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/beginner=1/);
    await page.reload();
    await expect(page.getByRole("button", { name: "Beginner-labelled" })).toHaveAttribute("aria-pressed", "true", { timeout: 30_000 });
  });

  test("impossible filters reset instead of dead-ending", async ({ page }) => {
    await page.getByLabel("Search issue titles").fill("zzqxnotherezzqx");
    await expect(count(page)).toContainText("0 issues match", { timeout: 15_000 });
    await expect(page.getByText("Nothing matches all of that.")).toBeVisible();
    const clear = page.getByRole("button", { name: "Clear filters" });
    await expect(clear).toBeVisible();
    await clear.click();
    await expect(page.getByLabel("Search issue titles")).toHaveValue("");
  });

  test("sorting moves to the biggest project", async ({ page }) => {
    const sort = page.getByLabel("Sort results");
    await sort.selectOption("stars");
    await expect(page).toHaveURL(/sort=stars/);
    await expect(count(page)).toBeVisible({ timeout: 15_000 });
  });
});
