import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public/data/mentors-catalog.json");

const GSOC_URL = "https://summerofcode.withgoogle.com";
const projectUrl = (p) => p.url || `${GSOC_URL}/programs/${p.y}/projects/${p.u}`;

const splitNames = (m) => (Array.isArray(m) ? m.join(",") : String(m ?? ""))
  .split(",")
  .map((s) => s.replace(/\s+/g, " ").trim())
  .filter((s) => s.length >= 3 && /[a-zà-ÿ]/i.test(s));

const norm = (s) => (s ?? "").toLowerCase().replace(/[^\p{L}\p{N} .'-]/gu, "").trim();
const parenTokens = (s) => (String(s ?? "").match(/\(([^()]{2,20})\)/g) ?? []).map((t) => norm(t.slice(1, -1)));
const compact = (s) => (s ?? "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

const gsoc = JSON.parse(readFileSync(join(ROOT, "public/data/gsoc-projects.json"), "utf8")).projects;
const other = JSON.parse(readFileSync(join(ROOT, "public/data/otherProjects.json"), "utf8")).projects;

const mentorMap = new Map();

for (const p of [...gsoc, ...other]) {
  if (!p.m) continue;
  const pProg = p.program || "GSoC";
  const pUrl = projectUrl(p);
  const pTechs = p.tt || [];
  const pYear = p.y;
  const pOrg = p.o;
  const pTitle = p.t;

  const orgName = norm(p.o ?? "");
  const orgCompact = compact(p.o ?? "");
  const shorts = parenTokens(p.o);

  for (const rawName of splitNames(p.m)) {
    const key = norm(rawName);
    if (!key || key === orgName) continue;
    const kc = compact(rawName);
    if (shorts.some((s) => compact(s) === kc)) continue;
    if (kc.length >= 6 && kc === orgCompact) continue;

    let rec = mentorMap.get(key);
    if (!rec) {
      rec = {
        name: rawName,
        projects: 0,
        orgs: new Set(),
        progs: new Set(),
        techs: new Set(),
        years: new Set(),
        sampleUrl: pUrl,
        sampleTitle: pTitle,
      };
      mentorMap.set(key, rec);
    }
    if (rawName.length > rec.name.length && norm(rawName) === norm(rec.name)) {
      rec.name = rawName;
    }
    rec.projects++;
    if (pOrg) rec.orgs.add(pOrg);
    if (pProg) rec.progs.add(pProg);
    if (pYear) rec.years.add(pYear);
    pTechs.forEach((t) => rec.techs.add(t));
  }
}

// Also read lfx-mentors.json
try {
  const lfxData = JSON.parse(readFileSync(join(ROOT, "public/data/lfx-mentors.json"), "utf8"));
  if (lfxData.names) {
    for (const name of lfxData.names) {
      const key = norm(name);
      if (!key) continue;
      if (!mentorMap.has(key)) {
        mentorMap.set(key, {
          name,
          projects: 1,
          orgs: new Set(["The Linux Foundation"]),
          progs: new Set(["LFX Mentorship"]),
          techs: new Set(["Linux", "Open Source", "C", "Go"]),
          years: new Set([2024]),
          sampleUrl: "https://mentorship.lfx.linuxfoundation.org",
          sampleTitle: "Linux Foundation Mentorship Program",
        });
      } else {
        const rec = mentorMap.get(key);
        rec.progs.add("LFX Mentorship");
        rec.orgs.add("The Linux Foundation");
      }
    }
  }
} catch (e) {
  console.log("No lfx-mentors.json or error:", e.message);
}

// Also read kde-archive.json
try {
  const kdeData = JSON.parse(readFileSync(join(ROOT, "public/data/kde-archive.json"), "utf8"));
  if (kdeData.mentors) {
    for (const m of kdeData.mentors) {
      const name = m.name || m;
      if (typeof name !== "string") continue;
      const key = norm(name);
      if (!key) continue;
      if (!mentorMap.has(key)) {
        mentorMap.set(key, {
          name,
          projects: 1,
          orgs: new Set(["KDE"]),
          progs: new Set(["Season of KDE"]),
          techs: new Set(["C++", "Qt", "KDE", "Open Source"]),
          years: new Set([2024]),
          sampleUrl: "https://eco.kde.org/season-of-kde/",
          sampleTitle: "Season of KDE Project",
        });
      } else {
        const rec = mentorMap.get(key);
        rec.progs.add("Season of KDE");
        rec.orgs.add("KDE");
      }
    }
  }
} catch (e) {
  console.log("No kde-archive.json or error:", e.message);
}

const list = [...mentorMap.values()].map((m) => ({
  name: m.name,
  projects: m.projects,
  orgs: [...m.orgs],
  progs: [...m.progs],
  techs: [...m.techs].slice(0, 8),
  years: [...m.years].sort(),
  sampleUrl: m.sampleUrl,
  sampleTitle: m.sampleTitle,
})).sort((a, b) => b.projects - a.projects || a.name.localeCompare(b.name));

console.log(`Total mentors compiled: ${list.length}`);
writeFileSync(OUT, JSON.stringify(list));
console.log(`Saved to ${OUT}`);
