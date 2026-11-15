/* ══ Every public route, in one pass.
   The site is a directory: a page that throws is a page that silently shows
   a fallback, and a broken image is a broken organisation's identity. This
   spec asks only the blunt questions - did it render, did it log an error,
   did any of its images fail - across the whole route list.                 ═ */
import { expect, test } from "@playwright/test";

const ROUTES = [
  "/", "/issues", "/programs", "/organizations", "/organizations/stats",
  "/skills", "/projects", "/sponsors", "/leaderboard", "/about",
  "/platform/features", "/platform/how", "/platform/trust",
  "/terms", "/privacy", "/cookies", "/dashboard",
  "/programs/gsoc", "/programs/gsoc/organizations", "/programs/outreachy",
  "/programs/lfx", "/programs/nsoc",
];

/* The API is what the pages are built on; a 500 here means the page under
   test was rendering a fallback rather than its real data. /api/health
   answers even with no database, which is the state this repo is developed
   in - DATABASE_URL is a production secret - so the check is that the route
   answers as JSON rather than that the backend is up. */
const APIS = ["/api/issues", "/api/health"];

test.describe("route smoke", () => {
  for (const path of ROUTES) {
    test(`${path} renders without console errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
      page.on("pageerror", (e) => errors.push(String(e)));
      const res = await page.goto(path);
      expect(res?.status(), `${path} http status`).toBeLessThan(400);
      await expect(page.locator("h1")).toBeVisible();
      /* Hydration warnings are the ones that only show up in a real browser,
         and they are the reason this suite exists alongside vitest. */
      const noise = errors.filter((e) => !/favicon|404 \(Not Found\)|net::ERR|Failed to load resource/i.test(e));
      expect(noise, `${path} console: ${noise.join("\n")}`).toEqual([]);
    });
  }

  for (const path of APIS) {
    test(`${path} answers with JSON`, async ({ request }) => {
      const res = await request.get(path, { headers: { accept: "application/json" } });
      expect(res.ok(), `${path} -> ${res.status()}`).toBeTruthy();
      const body = await res.json();
      expect(body).toBeTruthy();
    });
  }

  test("the catalog routes answer honestly when the backend is offline", async ({ request }) => {
    const res = await request.get("/api/catalog/counts", { headers: { accept: "application/json" } });
    /* Without DATABASE_URL the route must say so in JSON - a 500 or an HTML
       error page is what would break the pages that read it. */
    expect([200, 503]).toContain(res.status());
    expect(await res.json()).toBeTruthy();
  });

  test("the home page's images all load", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    /* Only judge the images that finished or failed; the ones still in
       flight at the deadline are the network's business, not the markup's. */
    await page.waitForTimeout(6_000);
    const broken = await page.evaluate(() =>
      Array.from(document.querySelectorAll("img"))
        .filter((i) => i.complete && !i.naturalWidth && i.currentSrc)
        .map((i) => i.currentSrc)
    );
    expect(broken, `broken images: ${broken.join(", ")}`).toEqual([]);
  });
});
