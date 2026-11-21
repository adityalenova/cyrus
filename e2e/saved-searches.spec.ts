/* ══ saved searches.
   A saved search is the finder's question - the words and the filters - so
   the tests follow it round the site: name it in the sidebar, find it on the
   board, open it, and check the URL and the controls agree. The two hard
   promises are that renaming and deleting work from the keyboard, and that a
   filter this page no longer has degrades into a sentence instead of a
   broken page, whether it arrives in a link or in a search saved last year.
   The board lives in this browser, so a seeded `agenthub.user` is enough to
   open it; no server session is needed for these assertions.             ═ */
import { expect, test } from "@playwright/test";

const signIn = (page: import("@playwright/test").Page, extra: Record<string, string> = {}) =>
  page.addInitScript((seed) => {
    localStorage.setItem("agenthub.user", JSON.stringify({ name: "Test Contributor", provider: "github", email: "t@example.com" }));
    for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
  }, extra);

const matched = (page: import("@playwright/test").Page) =>
  page.getByText(/^[\d.,]+k? issues match$/);

const nameBox = (page: import("@playwright/test").Page) => page.getByLabel("Name this search");
const saveButton = (page: import("@playwright/test").Page) =>
  page.getByRole("button", { name: "Save", exact: true });

/** one stored search, as the board's own localStorage key holds it */
const storedSearch = (id: string, name: string, filters: unknown, added = "2026-01-05") =>
  JSON.stringify({ [id]: { id, name, filters, added } });

test.describe("saving a search from the finder", () => {
  test("names the filters on screen and stores them for the board", async ({ page }) => {
    await signIn(page);
    await page.goto("/issues");
    await expect(matched(page)).toBeVisible({ timeout: 30_000 });

    await page.getByLabel("Search issue titles").fill("docs");
    await page.getByRole("button", { name: "Beginner-labelled" }).click();
    await expect(page).toHaveURL(/q=docs/);

    await nameBox(page).fill("rust docs to pick up");
    await saveButton(page).click();
    await expect(page.getByText(/Saved “rust docs to pick up”/)).toBeVisible();

    /* the question is stored, never the answers */
    const stored = await page.evaluate(() => localStorage.getItem("cyrus.searches.v1"));
    expect(stored).toContain('"q":"docs"');
    expect(stored).toContain('"beginner":true');
    expect(stored).not.toMatch(/https:\/\/github\.com/);
  });

  test("refuses a name that is empty, and says why", async ({ page }) => {
    await signIn(page);
    await page.goto("/issues?q=docs");
    await expect(matched(page)).toBeVisible({ timeout: 30_000 });

    await nameBox(page).fill("   ");
    await saveButton(page).click();
    await expect(page.getByText(/needs a name/)).toBeVisible();
    /* nothing was written: the key stays the empty map the board starts with */
    expect(await page.evaluate(() => localStorage.getItem("cyrus.searches.v1"))).toBe("{}");
  });

  test("will not save a search that filters nothing", async ({ page }) => {
    await signIn(page);
    await page.goto("/issues");
    await expect(matched(page)).toBeVisible({ timeout: 30_000 });

    await expect(saveButton(page)).toBeDisabled();
    await expect(page.getByText("Pick a filter first, then name the search to keep it.")).toBeVisible();
  });
});

test.describe("reopening a saved search from the board", () => {
  test("puts the query and the filters back in the URL and in the controls", async ({ page }) => {
    await signIn(page, {
      "cyrus.searches.v1": storedSearch("sq-rust", "Rust beginner docs", { q: "docs", lang: ["rust"], beginner: true }),
    });

    await page.goto("/dashboard/issues");
    await expect(page.getByRole("heading", { name: "Saved searches" })).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: "Rust beginner docs" })).toBeVisible();
    await page.getByRole("link", { name: "Open saved search Rust beginner docs" }).click();

    await expect(page).toHaveURL(/\/issues\?q=docs&lang=rust&beginner=1$/);
    await expect(page.getByLabel("Search issue titles")).toHaveValue("docs");
    await expect(page.getByRole("button", { name: "Beginner-labelled" })).toHaveAttribute("aria-pressed", "true");
    /* the stored language is lowercase, the chip is called "Rust": the chip
       must still light, or the reopened search is a link to nothing */
    await expect(page.getByRole("button", { name: /^Rust\b/ })).toHaveAttribute("aria-pressed", "true");
    await expect(matched(page)).toBeVisible({ timeout: 30_000 });
  });

  test("survives a reload, so the reopened page is shareable", async ({ page }) => {
    await signIn(page, {
      "cyrus.searches.v1": storedSearch("sq-rust", "Rust beginner docs", { q: "docs", lang: ["rust"], beginner: true }),
    });
    await page.goto("/dashboard/issues");
    await page.getByRole("link", { name: "Open saved search Rust beginner docs" }).click();
    await page.reload();
    await expect(page.getByLabel("Search issue titles")).toHaveValue("docs", { timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Beginner-labelled" })).toHaveAttribute("aria-pressed", "true");
  });

  test("opens a search saved before a filter was retired, and names what it skipped", async ({ page }) => {
    await signIn(page, {
      "cyrus.searches.v1": storedSearch("sq-old", "From before the mentor filter", { q: "docs", mentor: "1", lang: ["rust"] }),
    });

    await page.goto("/dashboard/issues");
    const row = page.getByRole("listitem").filter({ hasText: "From before the mentor filter" });
    await expect(row.getByText(/Filters this page no longer has were skipped: mentor/)).toBeVisible();

    await row.getByRole("link", { name: "Open saved search From before the mentor filter" }).click();
    await expect(page).toHaveURL(/\/issues\?q=docs&lang=rust$/);
    await expect(page.getByLabel("Search issue titles")).toHaveValue("docs");
    await expect(matched(page)).toBeVisible({ timeout: 30_000 });
  });
});

test.describe("renaming and deleting from the board", () => {
  test("renames by keyboard, keeps the same filters, and reopens the new name", async ({ page }) => {
    await signIn(page, {
      "cyrus.searches.v1": storedSearch("sq-rust", "Rust beginner docs", { q: "docs", beginner: true }),
    });
    await page.goto("/dashboard/issues");

    await page.getByRole("button", { name: "Rename saved search Rust beginner docs" }).focus();
    await page.keyboard.press("Enter");
    const draft = page.getByLabel("New name for the search Rust beginner docs");
    await expect(draft).toBeVisible();
    await draft.fill("weekend issues");
    await page.keyboard.press("Enter");

    await expect(page.getByRole("button", { name: "Rename saved search weekend issues" })).toBeVisible();
    await expect(page.getByRole("status")).toContainText("Renamed “Rust beginner docs” to “weekend issues”");
    const stored = await page.evaluate(() => localStorage.getItem("cyrus.searches.v1"));
    expect(stored).toContain('"q":"docs"');
    expect(stored).toContain('"weekend issues"');

    await page.getByRole("link", { name: "Open saved search weekend issues" }).click();
    await expect(page).toHaveURL(/\/issues\?q=docs&beginner=1$/);
  });

  test("refuses an empty new name and leaves the search alone", async ({ page }) => {
    await signIn(page, { "cyrus.searches.v1": storedSearch("sq-rust", "Rust beginner docs", { q: "docs" }) });
    await page.goto("/dashboard/issues");
    await page.getByRole("button", { name: "Rename saved search Rust beginner docs" }).click();
    await page.getByLabel("New name for the search Rust beginner docs").fill("");
    await page.getByRole("button", { name: "Save name" }).click();
    await expect(page.getByRole("status")).toContainText("needs a name");
    await expect(page.getByRole("button", { name: "Rename saved search Rust beginner docs" })).toBeVisible();
  });

  test("deletes by keyboard and falls back to the empty state", async ({ page }) => {
    await signIn(page, { "cyrus.searches.v1": storedSearch("sq-rust", "Rust beginner docs", { q: "docs" }) });
    await page.goto("/dashboard/issues");
    await expect(page.getByRole("listitem").filter({ hasText: "Rust beginner docs" })).toBeVisible();

    await page.getByRole("button", { name: "Delete saved search Rust beginner docs" }).focus();
    await page.keyboard.press("Enter");

    await expect(page.getByText("No saved searches yet.")).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: "Rust beginner docs" })).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem("cyrus.searches.v1"))).toBe("{}");
  });
});

test.describe("the empty state and the forgiving link", () => {
  test("a board with no saved searches says so and points at the finder", async ({ page }) => {
    await signIn(page);
    await page.goto("/dashboard/issues");
    await expect(page.getByRole("heading", { name: "Saved searches" })).toBeVisible();
    await expect(page.getByText("No saved searches yet.")).toBeVisible();
    await expect(page.getByText(/0 saved searches/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Find a new one" })).toBeVisible();
  });

  test("a link with a filter this page does not have still runs the rest", async ({ page }) => {
    await signIn(page);
    await page.goto("/issues?q=docs&status=open&mentor=nope");
    await expect(page.getByText(/no longer has - status, mentor/)).toBeVisible();
    await expect(page.getByLabel("Search issue titles")).toHaveValue("docs");
    await expect(matched(page)).toBeVisible({ timeout: 30_000 });

    /* and the page is still saveable: the unknown keys are left behind */
    await nameBox(page).fill("docs anyway");
    await saveButton(page).click();
    await expect(page.getByText(/Saved “docs anyway”/)).toBeVisible();
    const stored = await page.evaluate(() => localStorage.getItem("cyrus.searches.v1"));
    expect(stored).not.toContain("status");
    expect(stored).not.toContain("mentor");
  });
});
