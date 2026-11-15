/* ══ The sponsors directory explains its own blind spots.
   Absence from this page is a crawl outcome, not a claim about a project,
   so the method note must name every way a funding file fails to land -
   and must never phrase the page's limits as "this project has no
   sponsors".                                                   ═ */
import { expect, test } from "@playwright/test";

test("the method note gives the source and the snapshot date", async ({ page }) => {
  await page.goto("/sponsors");
  const note = page.getByText(/Method:/);
  await expect(note).toBeVisible({ timeout: 30_000 });
  await expect(note).toContainText("GitHub contents API");
  /* the date arrives with the published JSON, so wait for the payload */
  await expect(note).toContainText(/on \d{4}-\d{2}-\d{2}, for/);
  await expect(page.getByText(/read from GitHub \d{4}-\d{2}-\d{2}/)).toBeVisible({ timeout: 30_000 });
});

test("absence is disclosed as a crawl outcome, never as 'no sponsors'", async ({ page }) => {
  await page.goto("/sponsors");
  const note = page.getByText(/Method:/);
  await expect(note).toBeVisible({ timeout: 30_000 });
  await expect(note).toContainText(/the file was absent/);
  await expect(note).toContainText(/could not read/);
  await expect(note).toContainText(/fetch itself failed/);
  await expect(note).toContainText(/fact\s+about this crawl/);
  const body = await page.locator("body").innerText();
  expect(body).not.toMatch(/no sponsors/i);
});
