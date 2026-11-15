/* Mobile audit - 390px viewport, overflow report + screenshots to .shots/mobile
   First time only: npx playwright install chromium
   Run:  npm run dev                      (one terminal, serves http://localhost:5330)
         npm run audit:mobile             (another terminal, every page below)
         npm run audit:mobile -- home,about   (only the pages with these names)
   MVW=<px> changes the width. .shots/ is git-ignored. */
import { chromium } from "@playwright/test";
import { mkdirSync } from "fs";

const OUT = ".shots/mobile";

const PAGES: [string, string][] = [
  ["/", "home"],
  ["/issues", "issues"],
  ["/programs", "programs"],
  ["/programs/gsoc", "program-detail"],
  ["/programs/gsoc/organizations", "program-orgs"],
  ["/organizations", "organizations"],
  ["/organizations/microsoft", "org-profile"],
  ["/organizations/stats", "org-stats"],
  ["/skills", "skills"],
  ["/repo/affaan-m%2FECC", "repo-detail"],
  ["/projects", "projects"],
  ["/sponsors", "sponsors"],
  ["/leaderboard", "leaderboard"],
  ["/dashboard", "dashboard"],
  ["/dashboard/matcher", "dash-matcher"],
  ["/dashboard/compare", "dash-compare"],
  ["/platform/features", "features"],
  ["/platform/how", "platform-how"],
  ["/platform/trust", "platform-trust"],
  ["/about", "about"],
  ["/affiliations", "affiliations"],
  ["/terms", "terms"],
  ["/privacy", "privacy"],
  ["/cookies", "cookies"],
];

(async () => {
  const only = process.argv[2]; // optional: filter to page names, comma list
  const pages = only ? PAGES.filter(([, n]) => only.split(",").includes(n)) : PAGES;
  const vw = Number(process.env.MVW || 390);
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: vw, height: 844 }, deviceScaleFactor: 2, isMobile: vw < 500, hasTouch: true });
  const results: string[] = [];
  for (const [path, name] of pages) {
    const page = await ctx.newPage();
    const errs: string[] = [];
    page.on("pageerror", (e) => errs.push(String(e).slice(0, 120)));
    try {
      const res = await page.goto("http://localhost:5330" + path, { waitUntil: "load", timeout: 25000 });
      await page.waitForTimeout(3000);
      const info = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const sw = document.documentElement.scrollWidth;
        const bad: string[] = [];
        document.querySelectorAll<HTMLElement>("body *").forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width > vw + 2 && !el.closest("[class*='overflow-x-auto'],pre,style")) {
            const cls = (el.className || "").toString().slice(0, 70);
            bad.push(`${el.tagName.toLowerCase()}.${cls} w=${Math.round(r.width)}`);
          }
        });
        return { vw, sw, bad: bad.slice(0, 5) };
      });
      results.push(`${path} [${name}] ${res?.status()} scrollW=${info.sw}/${info.vw}${info.sw > info.vw + 1 ? " OVERFLOW" : ""}${info.bad.length ? "\n   " + info.bad.join("\n   ") : ""}${errs.length ? "\n   ERR " + errs.join("; ") : ""}`);
      await page.screenshot({ path: `${OUT}/${name}.png` });
    } catch (e) {
      results.push(`${path} [${name}] FAILED ${String(e).slice(0, 140)}`);
    }
    await page.close();
  }
  await browser.close();
  console.log(results.join("\n"));
})();
