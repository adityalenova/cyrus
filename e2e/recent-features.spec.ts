import { expect, test } from "@playwright/test";

test.describe("recent user-facing features", () => {
  test("restores Skills filters and sort from the URL", async ({ page }) => {
    await page.goto("/skills?q=agent&sort=name");

    await expect(page.getByRole("heading", { name: /GitHub skills your/i })).toBeVisible();
    await expect(page.getByPlaceholder("name, tag, description…")).toHaveValue("agent");
    await expect(page.locator("select").last()).toHaveValue("name");

    await page.reload();

    await expect(page.getByPlaceholder("name, tag, description…")).toHaveValue("agent");
    await expect(page.locator("select").last()).toHaveValue("name");
    await expect(page).toHaveURL(/q=agent.*sort=name/);
  });

  test("exports tracked issues as a CSV download", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("cyrus.issues.v1", JSON.stringify({
        "https://github.com/vercel/next.js/issues/123": {
          stage: "saved",
          added: "2026-10-30",
          meta: {
            repo: "vercel/next.js",
            number: 123,
            title: "Fix route handling",
            lang: "TypeScript",
            stars: 1,
            labels: [],
            beginner: false,
            updated: "2026-10-30",
          },
        },
      }));
    });

    await page.goto("/dashboard/issues");
    const exportCsv = page.getByRole("button", { name: "Export CSV" });
    await expect(exportCsv).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await exportCsv.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^cyrus-tracked-issues-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});
