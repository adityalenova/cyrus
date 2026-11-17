/* ══ e2e/onboarding.spec.ts — the wizard in a browser ══════════════════
   The unit tests in src/lib/onboarding.test.ts cover the rules. These cover
   the two things a pure function cannot: that the address bar really is the
   state, including a domain name whose spelling contains a comma and an
   ampersand, and that a person can walk the five steps with only the
   controls the page shows them.                                      ══ */
import { expect, test } from "@playwright/test";

const NAME = "Set up your board";

test.beforeEach(async ({ page }) => {
  await page.goto("/onboarding");
  await expect(page.getByRole("heading", { name: NAME })).toBeVisible();
});

test("opens unanswered, and says what it is waiting for", async ({ page }) => {
  await expect(page.getByText("Step 1 of 5 · Welcome")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  await expect(page.getByText("Needs a name of at least two characters.")).toBeVisible();
  /* a fresh wizard should not litter the URL with empty parameters */
  expect(new URL(page.url()).search).toBe("");
});

test("every keypress is in the address bar", async ({ page }) => {
  await page.getByLabel("Your name").fill("Ada");
  await expect(page).toHaveURL(/name=Ada/);
  await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
});

test("Continue advances and the progress bar moves with it", async ({ page }) => {
  await page.getByLabel("Your name").fill("Ada");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Step 2 of 5 · Interests")).toBeVisible();
  await expect(page.getByText("25%")).toBeVisible();
  await expect(page).toHaveURL(/[?&]s=1/);
});

test("a domain whose name carries a comma survives the round trip through the URL", async ({ page }) => {
  await page.goto("/onboarding?s=1&name=Ada&domain=Media%2C%20Arts%20%26%20Design");
  const chip = page.locator('[data-pill="Media, Arts & Design"]');
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  await expect(chip).toBeVisible();
});

test("nothing traps you: Back returns even from an unanswered step", async ({ page }) => {
  await page.getByLabel("Your name").fill("Ada");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Step 2 of 5 · Interests")).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByText("Step 1 of 5 · Welcome")).toBeVisible();
});

test("an unanswered step can be skipped, an unstarted one cannot", async ({ page }) => {
  /* Welcome is unstarted and offers no skip: a wizard with no name has nothing to carry forward */
  await expect(page.getByRole("button", { name: "Skip this step" })).toHaveCount(0);
  await page.getByLabel("Your name").fill("Ada");
  await page.getByRole("button", { name: "Continue" }).click();
  /* Interests is unanswered but skippable - the wizard is a shortcut, not a gate */
  await page.getByRole("button", { name: "Skip this step" }).click();
  await expect(page.getByText("Step 3 of 5 · Programs")).toBeVisible();
});

test("the shortlist stays empty until something is picked", async ({ page }) => {
  await page.goto("/onboarding?s=3&name=Ada");
  await expect(page.getByText("Nothing to rank yet")).toBeVisible();
});

test("a shared link reopens the shortlist with reasons attached", async ({ page }) => {
  await page.goto("/onboarding?s=3&name=Ada&tech=python");
  await expect(page.getByText(/archived projects within reach/)).toBeVisible();
  const first = page.locator("[data-picks]").getByRole("listitem").first();
  await expect(first).toBeVisible();
  /* every card has to say why it is here rather than ask for trust */
  await expect(first).toContainText(/uses python|written in python/i);
});

test("adding a second language rewrites the reach count", async ({ page }) => {
  await page.goto("/onboarding?s=3&name=Ada&tech=python");
  const wide = await page.getByText(/archived projects within reach/).innerText();
  await page.goto("/onboarding?s=3&name=Ada&tech=python|rust");
  const narrow = await page.getByText(/archived projects within reach/).innerText();
  expect(wide).not.toBe(narrow);
});

test("saving leaves a profile the next visit can load", async ({ page }) => {
  await page.getByLabel("Your name").fill("Ada");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.locator('[data-pill="go"]').click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Step 5 of 5 · Account")).toBeVisible();
  await page.getByRole("button", { name: "Save this profile" }).click();
  await expect(page.getByText(/Profile saved for Ada/)).toBeVisible();
  await page.reload();
  await expect(page.getByText("A saved profile is already in this browser")).toBeVisible();
});

test("a 390px screen reaches every control without scrolling sideways", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/onboarding?name=Ada&tech=python&domain=Databases%20%26%20Data");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.getByRole("button", { name: "Interests" })).toBeVisible();
});
