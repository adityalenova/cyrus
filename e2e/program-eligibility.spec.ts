/* ══ e2e/program-eligibility.spec.ts — the structured facets in the browser ══
   Issue #142: catalog filters must distinguish eligible, ineligible and
   unknown programs, compose with the existing status filter, and land in a
   shareable URL. Node-side Vitest already asserts the matching math and the
   URL contract in src/lib/programEligibility.test.ts; this spec pins what a
   visitor actually sees: chips rewrite the URL, cards wear the outcome badge,
   and the detail page shows the facets WITH the free text - or the shared
   "Not published" wording when the organizer never stated a rule.          ═ */
import { expect, test } from "@playwright/test";

test.describe("program eligibility facets", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/programs");
    await expect(page.getByRole("heading", { name: /open source/i })).toBeVisible({ timeout: 30_000 });
  });

  test("the facet filter rows render alongside the status row", async ({ page }) => {
    await expect(page.getByRole("group", { name: "Filter programs by eligibility region" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Filter programs by student standing" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Filter programs by eligibility outcome" })).toBeVisible();
  });

  test("choosing a region badges every card eligible, ineligible or unknown", async ({ page }) => {
    await page.getByRole("group", { name: "Filter programs by eligibility region" })
      .getByRole("button", { name: "Europe", exact: true }).click();
    await expect(page).toHaveURL(/region=europe/);

    const cards = page.locator("article");
    await expect(cards.filter({ hasText: "FOSSEE" }).first()).toBeVisible();
    /* Europe-ineligible: the Asia-only FOSSEE fellowship */
    await expect(cards.filter({ hasText: "FOSSEE" }).first()).toContainText("Ineligible");
    /* Europe-eligible: an open-worldwide program */
    await expect(cards.filter({ hasText: "Google Summer of Code" }).first()).toContainText("Eligible");
    /* rule never stated: the unknown reads explicitly as Not published */
    await expect(cards.filter({ hasText: "Hacktoberfest" }).first()).toContainText("Not published");
  });

  test("facets compose with the status filter and each other in the URL", async ({ page }) => {
    await page.getByRole("group", { name: "Filter programs by eligibility region" })
      .getByRole("button", { name: "Europe", exact: true }).click();
    await page.getByRole("group", { name: "Filter programs by status" })
      .getByRole("button", { name: "Live now" }).click();
    await expect(page).toHaveURL(/status=live/);
    await expect(page).toHaveURL(/region=europe/);
    /* live + Europe-open: LFX, MLH and GSSoC stay; closed GSoC drops out */
    await expect(page.locator("article").filter({ hasText: "LFX Mentorship" })).toBeVisible();
    await expect(page.locator("article").filter({ hasText: "Google Summer of Code" })).toHaveCount(0);
  });

  test("a shared link restores the whole facet combination on arrival", async ({ page }) => {
    await page.goto("/programs?region=europe&match=eligible");
    await expect(page.getByRole("group", { name: "Filter programs by eligibility outcome" })
      .getByRole("button", { name: "Eligible" })).toBeVisible();
    /* only eligible cards survive the shared filter... */
    await expect(page.locator("article")).toHaveCount(8);
    /* ...and the two facets the link stacked are both still in the URL */
    expect(page.url()).toMatch(/region=europe/);
    expect(page.url()).toMatch(/match=eligible/);
    /* the region chip is remembered, not silently dropped back to Anywhere */
    await expect(page.getByRole("group", { name: "Filter programs by eligibility region" })
      .getByRole("button", { name: "Europe", exact: true })).toBeVisible();
  });

  test("the detail page shows facets with the free text and attribution", async ({ page }) => {
    await page.goto("/programs/fossee");
    const rows = page.locator("div.flex.gap-4");
    await expect(rows.filter({ hasText: "Open in" }).first()).toContainText("Asia");
    await expect(rows.filter({ has: page.getByText("For", { exact: true }) }).first()).toContainText("Students");
    /* the prose rule stays available beside the facets */
    await expect(rows.filter({ hasText: "Eligibility" }).first()).toContainText("FOSSEE registration desk");
    /* and the derivation is attributed */
    await expect(page.getByText(/Facets structured from the published rule/)).toContainText("Published rule:");
  });

  test("an unstated rule is labelled, never guessed, on the detail page", async ({ page }) => {
    await page.goto("/programs/vercel-oss");
    const rows = page.locator("div.flex.gap-4");
    await expect(rows.filter({ hasText: "Open in" }).first()).toContainText("Not published");
    await expect(rows.filter({ has: page.getByText("For", { exact: true }) }).first()).toContainText("Not published");
    await expect(page.getByText(/Facets structured from the published rule/)).toContainText("Not published");
    /* free text still renders for this record */
    await expect(rows.filter({ hasText: "Eligibility" }).first()).not.toContainText("Not published");
  });
});
