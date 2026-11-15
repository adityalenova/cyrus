import { defineConfig } from "@playwright/test";
import { existsSync, readdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

/* ══ Which browser these specs drive.
   `npx playwright install` has not been run in this checkout, but the machine
   already keeps a Chrome-for-Testing build in the Playwright cache - the same
   one the screenshot harnesses in scratch/ use. So look for any chromium build
   in that cache, newest first, and fall back to the bundled download when
   there is none (CI, a fresh clone). PW_CHROME overrides the search.          ═ */
const CANDIDATES = [
  "chrome-headless-shell-mac-arm64/chrome-headless-shell",
  "chrome-headless-shell-linux/chrome-headless-shell",
  "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
  "chrome-linux/chrome",
];

function browserCache(): string | undefined {
  if (process.env.PW_CHROME) return process.env.PW_CHROME;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH
    ?? (process.platform === "darwin"
      ? join(homedir(), "Library/Caches/ms-playwright")
      : process.platform === "win32"
        ? join(homedir(), "AppData/Local/ms-playwright")
        : join(homedir(), ".cache/ms-playwright"));
  if (!existsSync(root)) return undefined;
  const builds = readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^chromium(-headless-shell)?-\d+$/.test(d.name))
    .map((d) => Number(d.name.match(/(\d+)$/)?.[1] ?? 0))
    .sort((a, b) => b - a);
  for (const build of builds) {
    for (const dir of readdirSync(root).filter((n) => n.endsWith(`-${build}`))) {
      for (const rel of CANDIDATES) {
        const p = join(root, dir, rel);
        if (existsSync(p)) return p;
      }
    }
  }
  return undefined;
}

const executablePath = browserCache();

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  /* Generous, because the suite runs against `next dev` by default and the
     first hit on a route pays for compiling it. Against a built server
     (E2E_BASE=https://cyrus-agent.vercel.app) the same run takes seconds. */
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE ?? "http://localhost:5330",
    /* executablePath is not a `use` key in Playwright Test - it only takes
       effect from launchOptions, otherwise the runner insists on its own
       download and reports it as missing. */
    launchOptions: executablePath ? { executablePath } : {},
    trace: "retain-on-failure",
    video: "off",
    /* The one-time splash curtain and the scroll reveals both stand down
       under prefers-reduced-motion, so a spec never races the intro. */
    reducedMotion: "reduce",
  },
  /* These specs assert on layout - does the nav row fit, does the drawer
     scroll - so each project is a real viewport rather than one default. */
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 900 } } },
  ],
  webServer: {
    command: "npm run dev",
    url: process.env.E2E_BASE ?? "http://localhost:5330",
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
