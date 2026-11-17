/* ══ onboarding.ts — what the wizard holds, and what it recommends ═════
   Five steps, one profile draft. The draft lives in the URL, so the back
   button walks the wizard the way it walks any other page, a half-finished
   run can be pasted into a chat, and a reload cannot lose someone's picks.
   The same object is mirrored into localStorage by the view for the
   "where was I" visit, which is why every function here takes a Draft and
   hands a new one back instead of touching a store.

   Lists are joined with "|", not ",": the domain vocabulary comes from
   SECTORS in orgTaxonomy, and that list really does contain
   "Media, Arts & Design". A comma separator would split it into two
   domains that match nothing.                                     ═ */
import { SECTORS, langToTech, normalizeTechs, sectorOf, techRank } from "./orgTaxonomy";
import type { ArchiveRow } from "./programProjects";

export const STEPS = [
  { id: "welcome", label: "Welcome", hint: "Who is setting up this board" },
  { id: "interests", label: "Interests", hint: "Languages, frameworks and the domains you want to work in" },
  { id: "programs", label: "Programs", hint: "Which mentored rounds you are aiming at" },
  { id: "matches", label: "Matches", hint: "Projects read off the archive for what you picked" },
  { id: "account", label: "Account", hint: "Connect GitHub and keep the profile" },
] as const;

export type StepId = (typeof STEPS)[number]["id"];
export const LAST_STEP = STEPS.length - 1;

export type Draft = {
  /** index into STEPS */
  step: number;
  name: string;
  bio: string;
  avatar: string;
  /** canonical technology names, as orgTaxonomy spell them */
  techs: string[];
  /** entries of SECTORS */
  sectors: string[];
  /** program ids from src/data/orgs.ts */
  programs: string[];
};

export const EMPTY_DRAFT: Draft = {
  step: 0, name: "", bio: "", avatar: "", techs: [], sectors: [], programs: [],
};

/* ── the URL shape ───────────────────────────────────────────────────── */

const P = { step: "s", name: "name", bio: "bio", avatar: "avatar", tech: "tech", domain: "domain", prog: "prog" } as const;
const SEP = "|";

const split = (raw: string) => [...new Set(raw.split(SEP).map((s) => s.trim()).filter(Boolean))];
const clean = (list: string[]) => [...new Set(list.map((s) => s.trim()).filter(Boolean))];

/** step index from a query value; anything unreadable opens the wizard at the start */
export function stepIndex(raw: string | null): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= LAST_STEP ? n : 0;
}

export function draftToParams(d: Draft): URLSearchParams {
  const sp = new URLSearchParams();
  if (d.step > 0) sp.set(P.step, String(d.step));
  if (d.name) sp.set(P.name, d.name);
  if (d.bio) sp.set(P.bio, d.bio);
  if (d.avatar) sp.set(P.avatar, d.avatar);
  if (d.techs.length) sp.set(P.tech, d.techs.join(SEP));
  if (d.sectors.length) sp.set(P.domain, d.sectors.join(SEP));
  if (d.programs.length) sp.set(P.prog, d.programs.join(SEP));
  return sp;
}

export function draftFromParams(sp: URLSearchParams): Draft {
  return {
    step: stepIndex(sp.get(P.step)),
    name: sp.get(P.name)?.trim() ?? "",
    bio: sp.get(P.bio)?.trim() ?? "",
    avatar: sp.get(P.avatar)?.trim() ?? "",
    techs: split(sp.get(P.tech) ?? ""),
    sectors: split(sp.get(P.domain) ?? ""),
    programs: split(sp.get(P.prog) ?? ""),
  };
}

/* ── moving through the steps ────────────────────────────────────────── */

/** what a step still needs before it counts as answered */
export function missingFor(step: number, d: Draft): string[] {
  if (step === 0) return d.name.trim().length >= 2 ? [] : ["a name of at least two characters"];
  if (step === 1) return d.techs.length || d.sectors.length ? [] : ["at least one language or domain"];
  return [];
}

export const canAdvance = (step: number, d: Draft) => missingFor(step, d).length === 0;

/** how far behind you - the last step reads 100 */
export const percent = (step: number) => Math.round((Math.min(Math.max(step, 0), LAST_STEP) / LAST_STEP) * 100);

export const goTo = (d: Draft, step: number): Draft => ({ ...d, step: Math.min(Math.max(step, 0), LAST_STEP) });

/** forward only one step at a time, and only over steps that are answered;
    backward is never blocked, because nobody should be trapped on a page */
export function jump(d: Draft, target: number): Draft {
  const to = Math.min(Math.max(target, 0), LAST_STEP);
  if (to <= d.step) return goTo(d, to);
  for (let s = d.step; s < to; s++) if (!canAdvance(s, d)) return d;
  return goTo(d, to);
}

export const advance = (d: Draft): Draft => jump(d, d.step + 1);
export const back = (d: Draft): Draft => goTo(d, d.step - 1);

/** skipping answers the current step and moves on - the wizard is a shortcut, not a gate */
export const skip = (d: Draft): Draft => goTo(d, Math.min(d.step + 1, LAST_STEP));

export function toggle(list: string[], value: string): string[] {
  const v = value.trim();
  if (!v) return list;
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

/** the minimum a draft needs before saving it as a profile is worth anything */
export const isReadyToSave = (d: Draft) => d.name.trim().length >= 2 && (d.techs.length > 0 || d.sectors.length > 0);

/* ── the vocabulary the pickers offer ────────────────────────────────── */

export type Option = { id: string; count: number };

/** what a row declares about itself, in canonical spelling. The two channels
 *  are kept apart on purpose: "this project lists React" is stronger evidence
 *  of an interest than "this project happens to be written in JavaScript", and
 *  the recommender says which one it is reading. */
const tagVocab = (r: ArchiveRow): string[] => normalizeTechs(r.tags);
const langVocab = (r: ArchiveRow): string[] => (r.lang ? normalizeTechs([langToTech(r.lang)]) : []);
const vocab = (r: ArchiveRow): string[] => [...new Set([...tagVocab(r), ...langVocab(r)])];
const domainOf = (r: ArchiveRow): string => sectorOf(r.title, r.org, r.body, r.tags.join(" "));

/** the technologies actually present in the archive, most common first, so the
    wizard never offers an interest that can only return an empty result set */
export function techOptions(rows: ArchiveRow[], limit = 18): Option[] {
  return techRank(rows.map((r) => ({ techs: vocab(r) })))
    .slice(0, limit)
    .map(([id, count]) => ({ id, count }));
}

/** the domains the archive can fill. "Other" is dropped: it is where
 *  sectorOf puts a row it could not classify, so selecting it asks the
 *  recommender for everything it is bad at. */
export function domainOptions(rows: ArchiveRow[]): Option[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const s = domainOf(r);
    if (s === "Other") continue;
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  return SECTORS.filter((s) => s !== "Other" && counts.has(s))
    .map((s) => ({ id: s as string, count: counts.get(s as string)! }))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
}

export const programOptions = (tracked: { id: string; name: string }[]): Option[] =>
  tracked.map((t) => ({ id: t.id, count: 0 }));

/* ── recommendations ─────────────────────────────────────────────────── */

export type Match = { row: ArchiveRow; score: number; reasons: string[] };

const W_TECH = 3;
const W_LANG = 2;
const W_DOMAIN = 3;
const W_PROGRAM = 2;

/** one row against one set of picks. Every point is a reason, because the
    card has to say why it appeared rather than ask someone to trust a number. */
export function scoreRow(row: ArchiveRow, sel: Pick<Draft, "techs" | "sectors" | "programs">): Match {
  const tags = tagVocab(row);
  const langs = langVocab(row);
  const reasons: string[] = [];
  let score = 0;

  for (const t of sel.techs) {
    if (tags.includes(t)) {
      score += W_TECH;
      reasons.push(`uses ${t}`);
    } else if (row.lang && langs.includes(t)) {
      score += W_LANG;
      reasons.push(`written in ${row.lang}`);
    }
  }

  const domain = domainOf(row);
  if (sel.sectors.includes(domain)) {
    score += W_DOMAIN;
    reasons.push(domain.toLowerCase());
  }

  if (sel.programs.length && (sel.programs.includes(row.id) || sel.programs.includes(row.program))) {
    score += W_PROGRAM;
    reasons.push(row.program);
  }

  return { row, score, reasons };
}

/** rows that match at least one pick, best first; ties fall back to stars then
 *  title so the order is the same on every render and in every test */
export function recommend(rows: ArchiveRow[], d: Draft, limit = 12): Match[] {
  const out: Match[] = [];
  for (const r of rows) {
    const m = scoreRow(r, d);
    if (m.score > 0) out.push(m);
  }
  out.sort((a, b) => b.score - a.score || b.row.stars - a.row.stars || a.row.title.localeCompare(b.row.title));
  return out.slice(0, limit);
}

/** how many archive rows the current picks can return - shown next to each
    option so an obvious choice is not made to look like a dead end */
export function coverage(rows: ArchiveRow[], sel: Pick<Draft, "techs" | "sectors" | "programs">): number {
  let n = 0;
  for (const r of rows) if (scoreRow(r, sel).score > 0) n++;
  return n;
}

export const summaryOf = (d: Draft): string[] => clean([
  d.name,
  d.techs.length ? `${d.techs.length} ${d.techs.length === 1 ? "language" : "languages"}` : "",
  d.sectors.length ? `${d.sectors.length} ${d.sectors.length === 1 ? "domain" : "domains"}` : "",
  d.programs.length ? `${d.programs.length} ${d.programs.length === 1 ? "program" : "programs"}` : "",
]);
