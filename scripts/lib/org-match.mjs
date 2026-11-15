/* ══ scripts/lib/org-match.mjs — the one rulebook for "is this GitHub account
   really this organization?"

   Two scripts need the same answer: verify-login-candidates.mjs while it hunts
   for accounts, and audit-login-matches.mjs when it re-checks every match the
   site already holds. Keeping the test in one place means the audit cannot
   quietly disagree with the crawler.

   The rulebook is deliberately boring. A wrong login puts somebody else's star
   count on this organization's page, so only the account's own fields are
   allowed to settle it - its login, the display name it set for itself, the
   website it lists, and whether it holds any real repositories at all. Similarity,
   fuzzy matching and "looks right" are not in here. ═════════════════════════ */

export const BOILER = [
  "foundation", "software", "project", "projects", "society", "association", "institute",
  "institution", "consortium", "group", "org", "community", "initiative", "collaborative",
  "committee", "council", "network", "alliance", "union", "international", "e.v", "ev",
  "gmbh", "inc", "llc", "ltd", "co", "the", "team", "for", "of", "and", "de", "la",
];

/** case + punctuation folded away, nothing else */
export const bare = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** every boilerplate word dropped, e.g. "Blender Foundation" -> "blender" */
export const norm = (s) => (s || "")
  .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ")
  .split(" ").filter(Boolean).filter((w) => !BOILER.includes(w)).join(" ");

/** norm, then spaces removed, so "linuxfoundation" and "Linux Foundation" meet */
export const squash = (s) => norm(s).replace(/ /g, "");

/** the distinctive word of the account's own website: jenkins.io -> jenkins */
export const domainWord = (blog) => {
  const b = (blog || "").toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "");
  const host = b.split(/[/?]/)[0] || "";
  const parts = host.split(".");
  if (parts.length < 2) return "";
  const stem = parts[parts.length - 2];
  return ["github", "googlecode", "sourceforge", "bitbucket", "wordpress", "blogspot", "web", "home"].includes(stem) ? "" : stem;
};

/** R1/R2/R3/R4 - returns the sentence that justifies the match, or "" */
export function accepts(u, name) {
  if (!u || !u.login) return "";
  if (u.type && u.type !== "Organization") return "";
  const t = norm(name), s = squash(name);

  /* An account that says nothing about itself is not evidence. A display name
     that merely repeats the login is the account echoing our own guess back, so
     it does not count - the three ways to be a real organization are a name of
     its own, a website, or a body of repositories. This is what separates the
     mesa organization (12 repos, mesa/mesa at 3.9k stars) from Sonic and
     openroad, both registered accounts with zero repositories and no profile. */
  const hasIdentity = Boolean(u.blog) || (u.public_repos ?? 0) >= 3 ||
    Boolean(u.name && bare(u.name) !== bare(u.login));

  if (bare(u.login) === bare(name)) return "login spells the name";
  if (bare(u.login) === s && hasIdentity) return "login spells the name";
  if (t && norm(u.login) === t && hasIdentity) return "login is the name once boilerplate folds";
  if (u.name && bare(u.name) !== bare(u.login) &&
    (bare(u.name) === bare(name) || bare(norm(u.name)) === s)) return `display name "${u.name}"`;
  if (t.split(" ").length === 1) {
    const d = domainWord(u.blog);
    if (d && d === t) return `website ${u.blog}`;
  }
  return "";
}
