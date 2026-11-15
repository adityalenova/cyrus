/* ══ The directory pages the site is named for.
   Small on purpose: one line of numbers each, because those numbers are the
   claim, and a stale or invented figure is the failure worth catching.      ═ */
import { expect, test } from "@playwright/test";

test("organizations opens with its own count", async ({ page }) => {
  await page.goto("/organizations");
  await expect(page.getByText(/open-source organizations, each one named by a program's own record/)).toBeVisible();
  /* Cards only render once the roster resolves, so a card is the proof. */
  await expect(page.locator("a[href*='/organizations/']").first()).toBeVisible();
});

test("the org statistics page carries logos, not methodology", async ({ page }) => {
  await page.goto("/organizations/stats");
  await expect(page.getByRole("heading").first()).toBeVisible();
  /* #232 removed the build explanation and the script credit from this page;
     if either comes back the copy has drifted again. */
  await expect(page.getByText(/How this page is built/i)).toHaveCount(0);
  await expect(page.getByText(/org-stats\.mjs/i)).toHaveCount(0);
});

test("programs lists every tracked program", async ({ page }) => {
  await page.goto("/programs");
  await expect(page.getByRole("heading", { name: /program/i }).first()).toBeVisible();
  const rows = page.locator("table tbody tr");
  /* The year band is the part that reads from the archive at runtime. */
  await expect(rows.first()).toBeVisible({ timeout: 30_000 });
  const foot = page.getByText(/Each year column counts the rows/);
  await expect(foot).toBeVisible({ timeout: 30_000 });
  /* #232: the topics-based rows are disclosed rather than quietly mixed in. */
  await expect(foot).toContainText("GitHub topics");
});

test("no user-facing page names an internal tool", async ({ page }) => {
  const paths = ["/", "/programs", "/organizations", "/programs/gsoc", "/about"];
  for (const p of paths) {
    await page.goto(p);
    const body = await page.locator("body").innerText();
    for (const leak of ["contriboOrgs", "org-stats.mjs", "scripts/", "/data/"]) {
      expect(body, `${p} leaks ${leak}`).not.toContain(leak);
    }
  }
});
