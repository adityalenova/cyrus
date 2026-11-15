/* ══ build-program-roster.mjs — who actually took part in each program ══
   node scripts/build-program-roster.mjs

   One build, one file. Every program section of public/data/program-roster
   .json is derived here from a real pull that already sits on disk, so the
   page can answer "which organizations, how many projects, which years" for
   each program and say where the answer came from. Nothing is invented and
   nothing is padded: a program with no published record simply has no section,
   and ProgramDetail then says the program publishes no list.

   Evidence kinds (each one labels itself in the UI):
     archive  - the program's own project archive, one row per accepted project
     api      - an open API the program runs for its current season
     listing  - a roster the program publishes without per-project counts

   The same pass builds the cross-program overlap map: two organizations are
   the same organization when their names normalize alike or their repositories
   sit under the same GitHub login. That is the answer to "is the LFX list the
   GSoC list under another name" - it is mostly not, and the numbers say so.
     ═══════════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => {
  try { return JSON.parse(readFileSync(join(root, rel), "utf8")); } catch { return null; }
};
const data = (f) => read(`public/data/${f}`);

/* ── name / login keys ─────────────────────────────────────────────────── */
const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
/* a company name and its GitHub login rarely match on text, so strip the
   legal suffixes before comparing - "Red Hat, Inc." is "redhat" */
const loose = (s) => norm(
  String(s ?? "").toLowerCase()
    .replace(/\b(inc|llc|ltd|corp|corporation|co|company|gmbh|limited|plc|bv|nv|foundation|project|the|of|and)\b/g, " ")
);
const GH = (url) => {
  const m = String(url ?? "").match(/^https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9_.-]+)/i);
  return m && !/^(orgs|search|topics|projects|about|features|login|issues|pull)$/i.test(m[1]) ? m[1].toLowerCase() : null;
};

/* program id -> the section we build for it */
const sections = {};

function put(id, s) {
  s.orgs.sort((a, b) => (b.n ?? 0) - (a.n ?? 0) || a.name.localeCompare(b.name));
  s.projects = s.orgs.reduce((t, o) => t + (o.n ?? 0), 0);
  s.years = [...new Set(s.orgs.flatMap((o) => o.years ?? []))].sort((a, b) => a - b);
  s.withProjects = s.orgs.filter((o) => (o.n ?? 0) > 0).length;
  sections[id] = s;
}

/* rows of {name,n,years,url,category} from a per-project archive */
function fromProjects(rows, yearOf) {
  const by = new Map();
  for (const r of rows) {
    const name = String(r.o ?? "").trim();
    if (!name) continue;
    let e = by.get(norm(name));
    if (!e) by.set(norm(name), (e = { name, n: 0, years: new Set() }));
    e.n += 1;
    const y = Number(yearOf(r));
    if (y) e.years.add(y);
  }
  return [...by.values()].map((e) => ({
    name: e.name, n: e.n, years: [...e.years].sort((a, b) => a - b), url: "", category: "",
  }));
}

/* ══ 1. GSoC - the all-time organization record ═══════════════════════════
   data/gsoc-alltime-raw.json is gsocorganizations.dev's mirror of Google's own
   per-year organization pages, 2016-2026, projects included. Without it we fall
   back to the 2022-2026 archive that ships in public/data.               ═ */
const YEARS_ALL = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
const allTime = read("data/gsoc-alltime-raw.json");
if (Array.isArray(allTime) && allTime.length) {
  const orgs = [];
  for (const o of allTime) {
    const years = Object.entries(o.years ?? {})
      .map(([y, d]) => [Number(y), d])
      .filter(([y, d]) => YEARS_ALL.includes(y) && Array.isArray(d?.projects))
      .sort((a, b) => a[0] - b[0]);
    if (!years.length || !String(o.name ?? "").trim()) continue;
    orgs.push({
      name: String(o.name).trim(),
      n: years.reduce((s, [, d]) => s + d.projects.length, 0),
      years: years.map(([y]) => y),
      url: o.url ?? "", category: o.category ?? "",
      login: GH(o.url) ?? undefined,
    });
  }
  put("gsoc", {
    label: "Google Summer of Code", evidence: "archive",
    source: "gsocorganizations.dev - a community mirror of Google's published per-year organization pages",
    note: "Every organization in the mirrored record, 2016-2026, with the accepted project count the source itself lists for each year.",
    orgs,
  });
} else {
  const g = data("gsoc-projects.json");
  if (g?.projects?.length) {
    const urls = g.orgs ?? {};
    const orgs = fromProjects(g.projects, (p) => p.y);
    for (const o of orgs) { o.url = urls[o.name]?.url ?? ""; o.category = urls[o.name]?.category ?? ""; o.login = GH(o.url) ?? undefined; }
    const og = data("gsoc-orgs.json");
    if (og) {
      const byName = new Map(orgs.map((o) => [norm(o.name), o]));
      for (const [year, list] of Object.entries(og)) {
        for (const o of list ?? []) {
          const e = byName.get(norm(o.name));
          if (!e) continue;
          if (!e.url && o.url) { e.url = o.url; e.login = GH(o.url) ?? e.login; }
          if (!e.category && o.category) e.category = o.category;
          const y = Number(year);
          if (y && !e.years.includes(y)) e.years.push(y), e.years.sort((a, b) => a - b);
        }
      }
    }
    put("gsoc", {
      label: "Google Summer of Code", evidence: "archive",
      source: "public/data/gsoc-projects.json + gsoc-orgs.json",
      note: "The accepted-project archive we hold. Google publishes no mentor roster for any year.",
      orgs,
    });
  }
}

/* ══ 2. LFX Mentorship - the whole published programme ════════════════════
   The API calls the host a "Linux Foundation project", and that is the
   organization in LFX terms: 47 of them carried 1,303 projects. The mentors
   are real objects on those records, and the platform's own mentor directory
   is a separate, larger population.                                     ═ */
const lfx = data("lfx-archive.json")?.programs?.lfx;
if (lfx?.orgs?.length) {
  put("lfx", {
    label: "LFX Mentorship", evidence: "archive",
    source: data("lfx-archive.json").source,
    note: "Every project LFX Mentorship has published, grouped by the Linux Foundation project that hosted it. That host is what LFX means by organization.",
    orgs: lfx.orgs.map((o) => ({
      name: o.name, n: o.projects, years: o.years, url: "",
      /* the archive's industry field is really the projects' skill free-text, so
         it stays out of the card; a single upstream GitHub org is a real link */
      login: (o.githubOrgCount === 1 ? o.githubOrgs?.[0] : undefined) ?? undefined,
      githubOrgs: o.githubOrgs ?? [], githubOrgCount: o.githubOrgCount ?? 0,
      mentors: o.mentors ?? 0,
    })),
    mentors: {
      onProjects: (lfx.mentors ?? []).length,
      directory: data("lfx-mentors.json")?.withProjects ?? 0,
      registered: data("lfx-mentors.json")?.registered ?? 0,
      source: "mentor names on each project record + the platform's own /mentors directory",
    },
  });
}

/* ══ 3. Outreachy - internships plus the community call ═══════════════════
   Two real lists that answer different questions: the internships we hold per
   community, and the 180 communities Outreachy itself publishes on its call
   for participation. The union is the roster; a community only listed by the
   call carries zero internships rather than an invented number.          ═ */
{
  const other = data("otherProjects.json");
  const orgs = other?.projects?.length
    ? fromProjects(other.projects.filter((p) => p.program === "Outreachy"), (p) => p.y)
    : [];
  const urls = other?.orgs ?? {};
  for (const o of orgs) { o.url = urls[o.name]?.url ?? ""; o.category = urls[o.name]?.category ?? ""; o.login = GH(o.url) ?? undefined; }
  const by = new Map(orgs.map((o) => [loose(o.name), o]));

  const comms = data("outreachy-communities.json");
  let added = 0;
  for (const c of comms?.communities ?? []) {
    const key = loose(c.name);
    const hit = by.get(key);
    if (hit) { hit.listed = c.section; if (!hit.url && c.url) hit.url = c.url; continue; }
    added += 1;
    by.set(key, { name: c.name, n: 0, years: [], url: c.url ?? "", category: "", listed: c.section });
  }
  if (by.size) {
    put("outreachy", {
      label: "Outreachy", evidence: "archive",
      source: "public/data/otherProjects.json + outreachy.org/communities/cfp",
      note: `Internships from the archive we hold, joined with the ${added ? `${comms.communities.length} communities ` : ""}Outreachy publishes on its own call for participation${comms?.round ? ` (${comms.round} round)` : ""}. Communities with no archived internship are marked, not dropped.`,
      orgs: [...by.values()],
      listingRound: comms?.round ?? null,
    });
  }
}

/* ══ 4. Summer of Bitcoin ════════════════════════════════════════════════ */
{
  const other = data("otherProjects.json");
  const rows = other?.projects?.filter((p) => p.program === "Summer of Bitcoin") ?? [];
  if (rows.length) {
    const orgs = fromProjects(rows, (p) => p.y);
    const urls = other.orgs ?? {};
    for (const o of orgs) { o.url = urls[o.name]?.url ?? ""; o.category = urls[o.name]?.category ?? ""; o.login = GH(o.url) ?? undefined; }
    put("sob", {
      label: "Summer of Bitcoin", evidence: "archive",
      source: "public/data/otherProjects.json",
      note: "The projects we hold for Summer of Bitcoin, grouped by the organization named on each one.",
      orgs,
    });
  }
}

/* ══ 5. GSSoC - the live season board ════════════════════════════════════
   For GSSoC the organization is the repository owner: every project is one
   repo somebody opened to contributors.                                 ═ */
{
  const g = data("gssoc-archive.json");
  if (g?.orgs?.length) {
    put("gssoc", {
      label: "GSSoC'26", evidence: "api",
      source: g.source,
      note: g.note,
      orgs: g.orgs.map((o) => ({ name: o.name, login: o.login, n: o.n, years: o.years, mentors: o.mentors ?? 0, topMentors: o.topMentors ?? [] })),
      organizations: g.orgs.length,
      repos: g.repos,
      mentors: {
        listed: g.mentors?.listed ?? 0, capped: !!g.mentors?.capped,
        source: "gssoc.girlscript.org/api/mentors",
        note: "The mentor directory returns 199 names and the endpoint ignores pagination, so this is what the platform publishes rather than a total it reports.",
      },
      participants: g.participants ?? null,
    });
  }
}

/* ══ 6. 24 Pull Requests ═════════════════════════════════════════════════
   Not an accepted-project roster: a wishlist of repositories plus the directory
   of organizations registered on the site. The organization is the GitHub owner. ═ */
{
  const p = data("24pr-archive.json");
  if (p?.orgs?.length) {
    put("24pr", {
      label: "24 Pull Requests", evidence: "api",
      source: p.source,
      note: p.note,
      orgs: p.orgs.map((o) => ({ name: o.name, login: o.name, n: o.projects, years: [], registered: !!o.listed, contributors: o.users ?? 0 })),
      repos: p.projects,
      registered: p.listedOrgs,
    });
  }
}

/* ══ 7. MLH Fellowship ════════════════════════════════════════════════════
   No published partner list; the partner organizations are read off the forks
   MLH keeps of the upstream repositories its batches worked on.            ═ */
{
  const m = data("mlh-partners.json");
  if (m?.orgs?.length) {
    put("mlh", {
      label: "MLH Fellowship", evidence: "api",
      source: m.source,
      note: m.note,
      orgs: m.orgs.map((o) => ({ name: o.login, login: o.login, n: o.projects, years: [], individual: o.type === "User", stars: o.stars ?? 0 })),
      repos: m.resolved,
      organizations: m.organizations,
    });
  }
}

/* ══ 8. Season of KDE ═════════════════════════════════════════════════════
   The KDE wiki publishes one ideas page per year; the organization is the KDE
   project named in the heading and the mentor is whoever the page states.   ═ */
{
  const k = data("kde-archive.json");
  if (k?.orgs?.length) {
    put("kde", {
      label: "Season of KDE", evidence: "listing",
      source: k.source,
      note: k.note,
      orgs: k.orgs.map((o) => ({ name: o.name, n: o.projects, years: o.years, url: "https://community.kde.org/SoK", category: "", mentors: o.mentors ?? 0, topMentors: o.topMentors ?? [] })),
      mentors: { listed: (k.mentors ?? []).length, source: "the Mentor line on each ideas page", note: "Free text; a placeholder like 'approach them' is dropped rather than counted as a person." },
    });
  }
}

/* ══ 8. the Linux Foundation member directory ════════════════════════════
   Deliberately not a program section. This is the population behind the
   "almost 800 member organizations" line CNCF publishes, and it is a
   different thing from the LFX Mentorship host roster, so the file keeps it
   separate and the page labels it as sponsorship and governance.        ═ */
const lf = data("lf-orgs.json");

/* ── 9. cross-program overlap ──────────────────────────────────────────── */
const ids = Object.keys(sections);
const keysOf = new Map(); /* id -> Map(key -> [org names]) */
for (const id of ids) {
  const m = new Map();
  const add = (k, name) => { if (!k) return; const a = m.get(k) ?? []; if (!a.includes(name)) a.push(name); m.set(k, a); };
  for (const o of sections[id].orgs) {
    add(norm(o.name), o.name);
    add(loose(o.name), o.name);
    const login = o.login ?? GH(o.url);
    if (login) add(`git:${login}`, o.name);
    for (const gl of o.githubOrgs ?? []) add(`git:${gl.toLowerCase()}`, o.name);
  }
  keysOf.set(id, m);
}

const orgKeys = (id, o) => {
  const set = new Set([norm(o.name), loose(o.name)]);
  const login = o.login ?? GH(o.url);
  if (login) set.add(`git:${login}`);
  for (const gl of o.githubOrgs ?? []) set.add(`git:${gl.toLowerCase()}`);
  return [...set].filter(Boolean);
};

const overlaps = {};
for (let i = 0; i < ids.length; i++) {
  for (let j = i + 1; j < ids.length; j++) {
    const [a, b] = [ids[i], ids[j]];
    const [A, B] = [keysOf.get(a), keysOf.get(b)];
    const shared = (o, from) => orgKeys(from, o).some((k) => (from === a ? B : A).has(k));
    const orgsA = sections[a].orgs.filter((o) => shared(o, a));
    const orgsB = sections[b].orgs.filter((o) => shared(o, b));
    if (!orgsA.length && !orgsB.length) continue;
    for (const o of orgsA) (o.also ??= []).push(b);
    for (const o of orgsB) (o.also ??= []).push(a);
    overlaps[`${a}\u0000${b}`] = {
      a: orgsA.length, b: orgsB.length,
      pctA: Math.round((orgsA.length / sections[a].orgs.length) * 100),
      pctB: Math.round((orgsB.length / sections[b].orgs.length) * 100),
      examples: orgsA.slice(0, 12).map((o) => o.name),
    };
  }
}

/* ── 10. write ─────────────────────────────────────────────────────────── */
const distinct = new Map();
for (const id of ids) for (const o of sections[id].orgs) {
  const k = loose(o.name) || norm(o.name);
  if (!k) continue;
  const e = distinct.get(k) ?? { programs: new Set() };
  e.programs.add(id);
  distinct.set(k, e);
}
const multi = [...distinct.values()].filter((e) => e.programs.size > 1).length;

const dir = join(root, "public/data");
mkdirSync(join(dir, "program-roster"), { recursive: true });

/* ten thousand rows is a lot of JSON: a field only ships when it carries
   information, so the biggest roster stays a fetch and not a download */
const pack = (o) => {
  const r = { name: o.name, n: o.n ?? 0 };
  for (const k of ["login", "url", "category", "years", "also", "listed", "registered", "contributors", "mentors", "topMentors", "githubOrgs", "githubOrgCount", "stars"]) {
    const v = o[k];
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && !v) continue;
    if (Array.isArray(v) && !v.length) continue;
    if (k !== "n" && typeof v === "number" && !v) continue;
    r[k] = v;
  }
  return r;
};

/* The index answers the directory cards without dragging 11k organization
   rows through the network; the rows for one program live in their own file,
   fetched only when that program's page opens. */
const out = {
  generated: new Date().toISOString().slice(0, 10),
  source: "scripts/build-program-roster.mjs over the archives in public/data",
  note: "One section per program, each labelled with the evidence it came from. A program with no published roster has no section, and its page says so.",
  totals: {
    programs: ids.length,
    orgRows: ids.reduce((t, id) => t + sections[id].orgs.length, 0),
    projects: ids.reduce((t, id) => t + sections[id].projects, 0),
    distinctOrgs: distinct.size,
    orgsInMoreThanOneProgram: multi,
  },
  lf: lf
    ? {
        generated: lf.generated, source: lf.source, note: lf.note,
        memberOrgs: lf.orgs.length, foundations: lf.perFoundation,
        projectTotal: lf.projectTotal,
        multiFoundation: lf.orgs.filter((o) => o.foundationCount > 1).length,
        cncfNote: "CNCF's own 2025 annual report opens with 'almost 800 member organizations'; the gateway lists " + (lf.perFoundation.cncf ?? 0) + " active ones today.",
        top: lf.orgs.slice(0, 40).map((o) => ({ name: o.name, website: o.website, foundations: o.foundationCount, tiers: o.tiers })),
      }
    : null,
  mentors: Object.fromEntries(ids.filter((id) => sections[id].mentors).map((id) => [id, sections[id].mentors])),
  overlaps,
  programs: Object.fromEntries(
    ids.map((id) => {
      const s = sections[id];
      const meta = {
        label: s.label, evidence: s.evidence, source: s.source, note: s.note,
        projects: s.projects, years: s.years, withProjects: s.withProjects,
        orgs: s.orgs.length, file: `program-roster/${id}.json`,
        ...(s.listingRound ? { listingRound: s.listingRound } : {}),
        ...(s.repos ? { repos: s.repos } : {}),
        ...(s.registered ? { registered: s.registered } : {}),
        ...(s.organizations ? { organizations: s.organizations } : {}),
        ...(s.participants != null ? { participants: s.participants } : {}),
        ...(s.mentors ? { mentors: s.mentors } : {}),
      };
      writeFileSync(join(dir, `program-roster`, `${id}.json`), JSON.stringify({ ...meta, orgs: s.orgs.map(pack) }));
      return [id, meta];
    }),
  ),
};

const dest = join(dir, "program-roster.json");
if (existsSync(dest)) writeFileSync(dest + ".bak", readFileSync(dest, "utf8"));
writeFileSync(dest, JSON.stringify(out));

for (const id of ids) {
  const s = sections[id];
  console.log(`${id.padEnd(10)} ${String(s.orgs.length).padStart(6)} orgs  ${String(s.projects).padStart(6)} projects  ${s.years[0] ?? "-"}-${s.years[s.years.length - 1] ?? "-"}  ${s.evidence}`);
}
console.log(`\ndistinct organizations across every program: ${distinct.size} · shared by more than one: ${multi}`);
const pairs = Object.entries(out.overlaps).sort((a, b) => b[1].a - a[1].a).slice(0, 10);
for (const [k, v] of pairs) console.log(`  ${k.replace("\u0000", " ∩ ")}: ${v.a} <-> ${v.b} orgs (${v.pctA}% of ${k.split("\u0000")[0]}, ${v.pctB}% of ${k.split("\u0000")[1]})`);
if (out.lf) console.log(`LF member organizations: ${out.lf.memberOrgs} across ${Object.keys(out.lf.foundations).length} foundations (CNCF ${out.lf.foundations.cncf})`);
console.log(`\nwrote ${dest.replace(root + "/", "")} (${(readFileSync(dest).length / 1024).toFixed(0)} KB) + one file per program`);
for (const f of readdirSync(join(dir, "program-roster"))) console.log(`  program-roster/${f}  ${(statSync(join(dir, "program-roster", f)).size / 1024).toFixed(0)} KB`);
