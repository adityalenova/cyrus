/* ══ scripts/fetch-kde-sok.mjs — Season of KDE ideas and mentors ═══════════
   node scripts/fetch-kde-sok.mjs [firstYear] [lastYear]

   Season of KDE does not run on an organization-application platform like GSoC;
   it runs on the KDE community wiki. Every year gets an ideas page, and each
   idea is a level-3 heading followed by a "'''Mentor:'''" line. KDE publishes
   that through the standard MediaWiki API, so the whole history is machine
   readable:

     https://community.kde.org/api.php?action=parse&page=SoK/Ideas/2025
         &prop=wikitext&format=json

   Two honest limits the page repeats:

   - the ideas list is what the community proposed, not what was accepted. Some
     ideas got no mentee, and the wiki does not mark which;
   - the Mentor line is free text. Some say a username, some a
     mailing list, some say "approach them" - a placeholder, not a person. We
     keep a name only when the line actually contains one.

   The organization side of Season of KDE is the KDE project the idea belongs
   to, which the heading often spells out ("Kdenlive: ..."). We take the prefix
   before a colon as the project when it looks like one.

   Output: public/data/kde-archive.json.                              ═ */
import { writeFileSync, renameSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public/data/kde-archive.json");
const API = "https://community.kde.org/api.php";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const get = async (url, tries = 4) => {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { accept: "application/json", "user-agent": "cyrus.ai program roster check" } });
      if (r.ok) return await r.json();
      if (r.status !== 429 && r.status < 500) return null;
    } catch { /* transient */ }
    await sleep(900 * (i + 1));
  }
  return null;
};

const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

/* wiki markup -> plain text, links keep their label */
const plain = (s) => clean(
  String(s ?? "")
    .replace(/\[\[(?:File|Image):[^\]]*\]\]/gi, "")
    .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, "$1")
    .replace(/\[\[([^\]]*)\]\]/g, "$1")
    .replace(/\[[https]*[^\s]*\s+([^\]]*)\]/g, "$1")
    .replace(/'''?/g, "")
    .replace(/<[^>]+>/g, "")
);

/* "Mentor:" is free text. A person's name is 2-4 words of letters, or a
   @handle, or a wiki username; a sentence about how to find one is not. */
const NAMES = /([A-Z][a-zA-Z'’\-]+(?:\s+[A-Z][a-zA-Z'’\-]+){1,3})/g;
function mentorNames(text) {
  const t = plain(text);
  if (!t || t.length > 220) return [];
  if (/^(try to|contact|ask|approach|who in|see |n\/a|none|-?$)/i.test(t)) return [];
  const out = new Set();
  for (const m of t.matchAll(/@([a-z0-9][a-z0-9_-]{2,30})/gi)) out.add(m[1]);
  for (const m of t.matchAll(NAMES)) {
    const n = m[1].trim();
    if (n.split(" ").length >= 2 && n.length >= 4 && !/^(General Information|Information For|Sample Project|Your Own|Project Type|Brief Explanation|Expected Results|Knowledge Pre|Mentor)/i.test(n)) out.add(n);
  }
  return [...out];
}

/* "Kdenlive: add effect X" -> the KDE project the idea belongs to */
function projectOf(heading) {
  const before = heading.split(/[:\-–—|]/)[0].trim();
  if (!before || before.length < 3 || before.length > 40 || /\s/.test(before) && before.split(" ").length > 3) return null;
  if (/^(idea|your own|sample|general|information|project|new|list)/i.test(before)) return null;
  return before;
}

async function year(y) {
  const j = await get(`${API}?action=parse&page=${encodeURIComponent(`SoK/Ideas/${y}`)}&prop=wikitext&format=json`);
  const text = j?.parse?.wikitext?.["*"];
  if (!text) return null;
  const ideas = [];
  const parts = text.split(/^===\s+/m).slice(1);
  for (const part of parts) {
    const nl = part.indexOf("\n");
    const heading = plain(part.slice(0, nl > 0 ? nl : 90));
    if (!heading || heading.length < 6) continue;
    const body = part.slice(nl);
    const mentorLine = (body.match(/'''Mentor:'''([^\n]*)/i) || [])[1] || "";
    const type = plain((body.match(/'''Project type:'''([^\n]*)/i) || [])[1] || "").slice(0, 60);
    ideas.push({
      y, heading: heading.slice(0, 110), project: projectOf(heading),
      mentors: mentorNames(mentorLine), type,
      url: `https://community.kde.org/SoK/Ideas/${y}`,
    });
  }
  return ideas;
}

const main = async () => {
  const first = Number(process.argv[2] ?? 2017);
  const last = Number(process.argv[3] ?? 2026);
  const all = [];
  for (let y = first; y <= last; y++) {
    const ideas = await year(y);
    if (!ideas) { console.log(`  ${y}: no page`); continue; }
    console.log(`  ${y}: ${ideas.length} ideas, ${new Set(ideas.flatMap((i) => i.mentors)).size} mentor names`);
    all.push(...ideas);
    await sleep(300);
  }
  if (!all.length) throw new Error("no Season of KDE pages parsed - refusing to write");

  const orgs = new Map();
  for (const i of all) {
    const name = i.project || "KDE (unspecified project)";
    const e = orgs.get(name) ?? { name, projects: 0, years: [], mentors: new Set() };
    e.projects += 1;
    if (!e.years.includes(i.y)) e.years.push(i.y);
    for (const m of i.mentors) e.mentors.add(m);
    orgs.set(name, e);
  }
  const orgList = [...orgs.values()].map((o) => ({
    name: o.name, projects: o.projects, years: o.years.sort(), mentors: o.mentors.size,
    topMentors: [...o.mentors].sort().slice(0, 8),
  })).sort((a, b) => b.projects - a.projects || a.name.localeCompare(b.name));

  const mentors = [...new Set(all.flatMap((i) => i.mentors))].sort();

  const file = {
    generated: new Date().toISOString().slice(0, 10),
    source: "community.kde.org/api.php (SoK/Ideas/<year> wikitext)",
    note: "Season of KDE publishes its ideas list on the KDE wiki. These are proposed ideas with the mentor named on each one, not accepted-and-completed projects - a placeholder Mentor line is dropped rather than counted as a person.",
    projects: all.length,
    years: [...new Set(all.map((i) => i.y))].sort(),
    perYear: Object.fromEntries([...new Set(all.map((i) => i.y))].sort().map((y) => [y, all.filter((i) => i.y === y).length])),
    orgs: orgList,
    mentors,
    ideas: all.map((i) => ({ y: i.y, t: i.heading, o: i.project ?? "KDE", m: i.mentors.join(", "), url: i.url })),
  };
  const tmp = OUT + ".tmp";
  writeFileSync(tmp, JSON.stringify(file));
  renameSync(tmp, OUT);

  console.log(`Season of KDE: ${all.length} ideas · ${orgList.length} KDE projects · ${mentors.length} mentor names · ${file.years[0]}-${file.years[file.years.length - 1]}`);
};

main().catch((e) => { console.error(e); process.exit(1); });
