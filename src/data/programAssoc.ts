/* ══ programAssoc.ts — which open-source programs each org really runs.
   Two kinds of evidence, and the stronger one always wins:

   1. the program archives. ORG_PROGRAMS comes from public/data/program-roster.json,
      which is built from the official GSoC / LFX / Outreachy / Summer of Bitcoin
      project exports: the organization is named on an accepted project, so it ran
      that program in that year. n is the number of accepted projects.
   2. the GitHub topics a repo advertises. PROGRAM_REPOS carries GSoC / LFX /
      Outreachy / GSSoc scraped from each flagship repo's topics, and the catalog
      REPOS carry "hacktoberfest" where GitHub does. n is the number of tracked
      repos that advertise it, so the badge can say how deep the habit runs.

   A topic tag is a claim the maintainer made about their own repository; an
   archive row is a record the program published. Where both speak, the archive
   is shown and the topic count only adds to the tooltip. Nothing here is
   inferred from a name or a logo. ═ */
import { REPOS } from "./repos";
import { PROGRAM_REPOS } from "./programRepos";
import { ORG_PROGRAMS } from "./realOrgs";

export type Assoc = {
  id: string; label: string;
  tone: "blue" | "green" | "cat" | "purple" | "stars";
  n: number;
  /** what n counts: accepted projects from the archive, or tracked repos */
  unit: "project" | "repo";
};

const PROGRAM_BY_KEY: Record<string, { id: string; label: string; tone: Assoc["tone"] }> = {
  GSoC:        { id: "gsoc",      label: "GSoC",      tone: "blue" },
  LFX:         { id: "lfx",       label: "LFX",       tone: "green" },
  Outreachy:   { id: "outreachy", label: "Outreachy", tone: "cat" },
  GSSoc:       { id: "gssoc",     label: "GSSoC",     tone: "purple" },
  Hacktoberfest: { id: "oct",     label: "Hacktoberfest", tone: "stars" },
};

/* the four archives' own program keys, spelled as rosterOrgs writes them */
const ARCHIVE_BY_KEY: Record<string, { id: string; label: string; tone: Assoc["tone"] }> = {
  ...PROGRAM_BY_KEY,
  gsoc:      { id: "gsoc",      label: "GSoC",      tone: "blue" },
  lfx:       { id: "lfx",       label: "LFX",       tone: "green" },
  outreachy: { id: "outreachy", label: "Outreachy", tone: "cat" },
  sob:       { id: "sob",       label: "Summer of Bitcoin", tone: "purple" },
};

/* login -> program key -> repo count */
const acc = new Map<string, Map<string, number>>();
const bump = (owner: string, key: string) => {
  const byKey = acc.get(owner) ?? new Map<string, number>();
  byKey.set(key, (byKey.get(key) ?? 0) + 1);
  acc.set(owner, byKey);
};

for (const r of PROGRAM_REPOS) {
  const owner = r.repo.split("/")[0].toLowerCase();
  for (const p of r.programs) if (PROGRAM_BY_KEY[p]) bump(owner, p);
}
for (const r of REPOS) {
  const owner = r.repo.split("/")[0].toLowerCase();
  for (const t of r.tags) {
    const tl = t.toLowerCase();
    if (tl === "hacktoberfest") bump(owner, "Hacktoberfest");
    else if (tl === "gsoc") bump(owner, "GSoC");
    else if (tl === "lfx" || tl === "lf-mentoring") bump(owner, "LFX");
    else if (tl === "outreachy") bump(owner, "Outreachy");
  }
}

/* login -> program id -> accepted projects, from the archives */
const archived = new Map<string, Map<string, { n: number; label: string; tone: Assoc["tone"] }>>();
for (const [login, list] of Object.entries(ORG_PROGRAMS)) {
  const byId = new Map<string, { n: number; label: string; tone: Assoc["tone"] }>();
  for (const p of list) {
    const meta = ARCHIVE_BY_KEY[p.program];
    if (!meta) continue;
    byId.set(meta.id, { n: p.projects, label: meta.label, tone: meta.tone });
  }
  if (byId.size) archived.set(login.toLowerCase(), byId);
}

/* stable order: archive evidence first (it is the proof), then by size */
export function programsOf(login: string): Assoc[] {
  const key = login.toLowerCase();
  const byId = new Map<string, Assoc>();

  for (const [id, a] of archived.get(key) ?? []) byId.set(id, { id, label: a.label, tone: a.tone, n: a.n, unit: "project" });

  for (const [pkey, n] of acc.get(key) ?? []) {
    const meta = PROGRAM_BY_KEY[pkey];
    if (!meta) continue;
    const existing = byId.get(meta.id);
    if (existing) continue;                    /* the archive already proves it */
    byId.set(meta.id, { ...meta, n, unit: "repo" });
  }

  return [...byId.values()].sort((a, b) =>
    (b.unit === "project" ? 1 : 0) - (a.unit === "project" ? 1 : 0) || b.n - a.n || a.label.localeCompare(b.label));
}

/** what each archive on our disk actually covers - GSoC was widened to 2016 */
const ARCHIVE_WINDOW: Record<string, string> = {
  gsoc: "2016-2026", lfx: "2022-2026", outreachy: "2022-2026", sob: "2026",
};

/** one honest sentence for a badge tooltip */
export function assocNote(a: Assoc): string {
  return a.unit === "project"
    ? `${a.n.toLocaleString("en-US")} accepted ${a.label} project${a.n === 1 ? "" : "s"} in the ${ARCHIVE_WINDOW[a.id] ?? "2022-2026"} archive`
    : `${a.n} tracked repo${a.n === 1 ? "" : "s"} advertise ${a.label} in their GitHub topics`;
}

/* every program key some tracked org actually runs, in badge order */
export const PROGRAM_FILTERS: Assoc[] = Object.values(PROGRAM_BY_KEY).map((p) => ({ ...p, n: 0, unit: "repo" }));

/* ── the same record read the other way round ─────────────────
   program id -> the organizations whose tracked repositories
   advertise that program through their GitHub topics. Only the
   programs with no public project archive need this, because for
   those the topic tag is the only honest evidence we hold. */
export type TopicOrg = { login: string; n: number };

const byProgram = new Map<string, TopicOrg[]>();
for (const [login, keys] of acc) {
  for (const [key, n] of keys) {
    const id = PROGRAM_BY_KEY[key]?.id;
    if (!id) continue;
    const list = byProgram.get(id) ?? [];
    list.push({ login, n });
    byProgram.set(id, list);
  }
}
for (const list of byProgram.values()) list.sort((a, b) => b.n - a.n || a.login.localeCompare(b.login));

/* the archives read the same way: program id -> orgs that ran it, with the
   accepted-project count the program itself published */
const byArchive = new Map<string, TopicOrg[]>();
for (const [login, byId] of archived) {
  for (const [id, a] of byId) {
    const list = byArchive.get(id) ?? [];
    list.push({ login, n: a.n });
    byArchive.set(id, list);
  }
}
for (const list of byArchive.values()) list.sort((a, b) => b.n - a.n || a.login.localeCompare(b.login));

export function topicOrgsOf(id: string): TopicOrg[] {
  return byProgram.get(id) ?? [];
}

/** organizations proven to run this program by the program's own archive */
export function archiveOrgsOf(id: string): TopicOrg[] {
  return byArchive.get(id) ?? [];
}

