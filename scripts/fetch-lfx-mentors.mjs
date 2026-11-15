/* ══ scripts/fetch-lfx-mentors.mjs — the LFX platform's own mentor roster ═══
   node scripts/fetch-lfx-mentors.mjs

   Two different questions get asked of "LFX mentors":

     how many people appear as a mentor on a published project? - that is the
       982 names fetch-lfx-alltime.mjs pulls out of apprenticeNeeds.mentors[];
     how many people have a mentor profile on the platform? - that is what this
       crawl answers, through api.mentorship.lfx.linuxfoundation.org/mentors.

   The second set is bigger and messier: it is anyone who registered as a mentor,
   including accounts that are a bare email address and profiles that list zero
   projects. So each row is tagged - usableOnly keeps the people who can actually
   be named and counted: a real display name (not an email or a login) and at
   least one project. Both numbers are written out so the site can quote the
   honest one and explain the other.                                     ═ */
import { writeFileSync, mkdirSync, renameSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RAW_DIR = join(ROOT, "data");
const RAW = join(RAW_DIR, "lfx-mentors-raw.json");
const OUT = join(ROOT, "public/data/lfx-mentors.json");
const API = "https://api.mentorship.lfx.linuxfoundation.org/mentors";
const PAGE = 200;
const SLEEP = 200;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const get = async (url, tries = 4) => {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { accept: "application/json" } });
      if (r.ok) return await r.json();
      if (r.status !== 429 && r.status < 500) throw new Error(`LFX mentors API ${r.status}`);
    } catch (e) {
      if (i === tries - 1) throw e;
    }
    await sleep(1500 * (i + 1));
  }
  return null;
};

const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

/* a display name is only nameable if it is not an email, a bare login, or a
   string of digits - all three exist in this dataset */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const isPerson = (n) =>
  n.length >= 3 && !EMAIL.test(n) && !/^\d+$/.test(n) && /[a-z]/i.test(n) &&
  !/^(gh|git|user|test|demo|noreply)[-_]?\d*$/i.test(n);

const len = (v) => (Array.isArray(v) ? v.length : v && typeof v === "object" ? Object.keys(v).length : 0);

const slim = (u) => {
  const p = (u.profiles ?? [])[0] ?? {};
  const name = clean(u.name) || clean([p.firstName, p.lastName].filter(Boolean).join(" "));
  return {
    id: u.id,
    name,
    nameable: isPerson(name),
    projects: Number(p.numberOfProjects ?? 0),
    mentees: len(u.mentees),
    graduates: len(u.graduates),
    skills: [...new Set((p.skillSet?.skills ?? []).map(clean).filter(Boolean))].slice(0, 8),
    bio: clean(p.introduction).slice(0, 160),
    slug: clean(p.slug) || null,
    joined: String(p.createdAt ?? "").slice(0, 4) || null,
  };
};

async function crawl() {
  const rows = [];
  let key = "";
  let pages = 0;
  for (;;) {
    const url = `${API}?limit=${PAGE}${key ? `&nextPageKey=${encodeURIComponent(key)}` : ""}`;
    const j = await get(url);
    if (!j?.users?.length) break;
    for (const u of j.users) rows.push(slim(u));
    pages += 1;
    if (pages % 10 === 0) console.log(`  ${rows.length} profiles, ${pages} pages`);
    key = j.nextPageKey;
    if (!key) break;
    await sleep(SLEEP);
  }
  return rows;
}

/* the cursor is a sort key, so rows can repeat at a page boundary */
const unique = (rows) => {
  const m = new Map();
  for (const r of rows) if (r.id && !m.has(r.id)) m.set(r.id, r);
  return [...m.values()];
};

const main = async () => {
  console.log("LFX platform: crawling every mentor profile");
  const all = unique(await crawl());
  if (!all.length) throw new Error("the mentors endpoint returned nothing - refusing to write an empty file");

  mkdirSync(RAW_DIR, { recursive: true });
  writeFileSync(RAW, JSON.stringify({ generated: new Date().toISOString().slice(0, 10), profiles: all }, null, 1));

  const named = all.filter((r) => r.nameable);
  const active = named.filter((r) => r.projects > 0 || r.graduates > 0);
  const byProjects = [...active].sort((a, b) => b.projects - a.projects || a.name.localeCompare(b.name));

  const out = {
    generated: new Date().toISOString().slice(0, 10),
    source: "api.mentorship.lfx.linuxfoundation.org/mentors",
    note: "Every mentor profile on the LFX Mentorship platform. registered is everyone who signed up, including accounts named only by an email address; nameable has a real display name; withProjects also lists at least one project or graduate. The site quotes withProjects.",
    registered: all.length,
    nameable: named.length,
    withProjects: active.length,
    years: [...new Set(all.map((r) => r.joined).filter(Boolean))].sort(),
    top: byProjects.slice(0, 60).map((r) => ({ name: r.name, projects: r.projects, graduates: r.graduates, skills: r.skills.slice(0, 3) })),
    names: byProjects.map((r) => r.name),
  };
  const tmp = OUT + ".tmp";
  writeFileSync(tmp, JSON.stringify(out));
  renameSync(tmp, OUT);

  console.log(`LFX mentors: ${all.length} registered · ${named.length} nameable · ${active.length} with at least one project`);
  console.log(`top: ${byProjects.slice(0, 5).map((r) => `${r.name} (${r.projects})`).join(", ")}`);
};

main().catch((e) => { console.error(e); process.exit(1); });
