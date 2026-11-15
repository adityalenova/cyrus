/* Refresh the README screenshot tour at 1440px, light theme. */
import { chromium } from "playwright";

const EXE = "/Users/sduggirala/Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell";
const BASE = "http://localhost:5331";
const OUT = "docs/readme/shots";

const shots = [
  { path: "/projects", file: "archive.png", wait: 2600 },
  { path: "/platform/features", file: "platform-features.png", wait: 2600 },
  { path: "/about", file: "about.png", wait: 2600 },
];

const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

for (const s of shots) {
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2600);
  await page.evaluate((auth) => {
    localStorage.setItem("agenthub.theme", JSON.stringify("light"));
    if (auth) localStorage.setItem("agenthub.user", JSON.stringify({ name: "Aditya", provider: "github", email: "a@b.co" }));
  }, !!s.auth);
  await page.goto(`${BASE}${s.path}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(s.wait);
  for (const c of s.chips ?? []) {
    await page.getByRole("button", { name: c, exact: true }).first().click();
    await page.waitForTimeout(350);
  }
  if (s.chips?.length) await page.waitForTimeout(700);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${s.file}` });
  console.log("shot", s.file);
}
await browser.close();
console.log("done");
