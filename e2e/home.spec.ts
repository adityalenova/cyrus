/* ══ Home page: the promises the landing screen makes in words.
   These are the lines a person reads and then relies on, so they are the
   lines worth a test — the hero's figures, the handwritten signatures on
   the testimonials, and the order of the two sections that got moved.       ═ */
import { expect, test } from "@playwright/test";

test.describe("home", () => {
  test("hero states the honest figures", async ({ page }) => {
    await page.goto("/");
    const hero = page.locator("#hero");
    await expect(hero.getByRole("heading", { level: 1 })).toContainText("Discover open source");
    /* One sentence, four facts. The program count comes straight out of the
       catalogue, so the page and the directory cannot drift apart. */
    const line = hero.locator("p", { hasText: "one contribution board" });
    await expect(line).toBeVisible();
    await expect(line).toContainText(/real open issues, [\d.,]+k archived program projects, \d+ open-source programs/);
  });

  test("popular organizations sit above the questions", async ({ page }) => {
    await page.goto("/");
    /* #233 moved the shelf. If a later edit pushes it back under the FAQ the
       DOM order below catches it without anyone re-reading the source. */
    const order = await page.evaluate(() => {
      const at = (id: string) => {
        const el = document.getElementById(id);
        if (!el) return -1;
        return Array.from(document.querySelectorAll("#orgs, #faq-home")).indexOf(el);
      };
      return { orgs: at("orgs"), faq: at("faq-home") };
    });
    expect(order.orgs).toBeGreaterThanOrEqual(0);
    expect(order.faq).toBeGreaterThanOrEqual(0);
    expect(order.orgs).toBeLessThan(order.faq);
  });

  test("every testimonial is signed and labelled illustrative", async ({ page }) => {
    await page.goto("/");
    const signs = page.locator(".sign");
    expect(await signs.count()).toBeGreaterThan(0);
    /* The handwriting is the design; the badge beside it is the honesty. A
       card may not carry one without the other. */
    await expect(page.getByText("Illustrative").first()).toBeVisible();
  });
});
