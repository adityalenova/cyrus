/* ══ /programs/<id>/organizations: the explorer that replaced the chip rail.
   A program's record can name several hundred technologies, so the stack
   filter is one dropdown and the count line is the proof that it filters.
   These tests read that line rather than the cards.                          ═ */
import { expect, test } from "@playwright/test";

const num = (s: string) => Number(s.replace(/,/g, ""));

/* "Showing 60 of 364 organizations · 364 in total" — the single source for
   what the current filter did. */
const countLine = (page: import("@playwright/test").Page) =>
  page.getByText(/^Showing [\d,]+ of [\d,]+ (organizations|project areas)/);

async function shownOf(page: import("@playwright/test").Page) {
  const line = (await countLine(page).textContent()) ?? "";
  const m = line.match(/Showing ([\d,]+) of ([\d,]+)/);
  return { shown: num(m![1]), total: num(m![2]), line };
}

test.describe("program organization explorer", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/programs/gsoc/organizations");
    await expect(countLine(page)).toBeVisible({ timeout: 30_000 });
  });

  test("starts unfiltered", async ({ page }) => {
    const { total, line } = await shownOf(page);
    expect(total).toBeGreaterThan(0);
    expect(line).toContain("in total");
    expect(line).not.toContain("filtered");
  });

  test("the stack dropdown narrows the list and says so", async ({ page }) => {
    const stack = page.getByLabel("Stack");
    await expect(stack).toBeVisible();
    const before = await shownOf(page);

    /* Option 0 is "All stacks"; every option after it is a real technology. */
    const options = await stack.locator("option").allTextContents();
    expect(options.length).toBeGreaterThan(2);
    const count = (label: string) => {
      const m = label.match(/\(([\d,]+)\)$/) || [];
      return num(m[1] || "0");
    };
    const pick = options.findIndex((o, i) => i > 0 && count(o) > 0 && count(o) < before.total);
    expect(pick).toBeGreaterThan(0);
    await stack.selectOption({ index: pick });

    const after = await shownOf(page);
    expect(after.total).toBeLessThan(before.total);
    expect(after.line).toContain("filtered");
  });

  test("a search with no matches offers to clear itself", async ({ page }) => {
    const before = await shownOf(page);
    await page.getByLabel("Search organizations").fill("zzqx-no-such-org");
    await expect(countLine(page)).toContainText("of 0");
    /* The empty state is an invitation, not a dead end: it names the real
       total and the one button that undoes everything. */
    await expect(page.getByText("No organization matches those filters")).toBeVisible();
    const clear = page.getByRole("button", { name: "Clear the filters" });
    await expect(clear).toBeVisible();
    await clear.click();
    await expect(countLine(page)).toContainText(`${before.total} in total`);
    await expect(page.getByLabel("Search organizations")).toHaveValue("");
  });
});
