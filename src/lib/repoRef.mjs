/* ══ src/lib/repoRef.mjs — one canonical GitHub repository identity ══
   A repository reaches this code as a crawler row, a program-board field, a
   link pasted into the repo analyser, or a URL stored in a snapshot. The same
   repository written five ways has to resolve to one identity, or the pipeline
   keys the same project twice and a page links to a path GitHub does not have.

   This is the only place that decides what "owner/repo" means. Call sites use:

     parseRepoRef(input)  ->  { owner, repo, id, source } | null
     repoId(input)        ->  "owner/repo" | null, the string-only case
     isSameRepo(a, b)     ->  boolean, comparing two spellings

   Rules the callers rely on:

   - Nothing throws. An input this helper cannot understand is `null`, so a
     crawler can keep going and a page can show a message instead of a stack.
   - `id` is lowercased because GitHub treats owner and repository names as
     case-insensitive; `owner` and `repo` keep the spelling that was given, for
     display and for provenance.
   - `source` keeps the untouched input. Provenance is not derivable from the
     identity, so a caller that needs the original string reads it here rather
     than reconstructing it.
   - A ref inside a repository is still that repository: `/tree/main/src/x.ts`,
     `/blob/`, `/issues/12` and `?query#fragment` are trimmed, not rejected.

   Plain ESM JavaScript with JSDoc types, because both `node scripts/*.mjs` and
   the typed app import it: `allowJs` is on in tsconfig.json, so TypeScript
   reads the annotations below rather than losing the contract at the boundary.
                                                              ═ */

/**
 * @typedef {object} RepoRef
 * @property {string} owner the owner segment as written
 * @property {string} repo the repository segment as written
 * @property {string} id lowercased `owner/repo`, the value to key on
 * @property {string} source the input exactly as it arrived, for provenance
 */

/** Hosts that serve a GitHub repository path. `github.com` and its `www`. */
const GITHUB_HOSTS = new Set(["github.com", "www.github.com"]);

/** Owner and repository name charset GitHub accepts. */
const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * First path segments that belong to the site rather than to a repository, so
 * `github.com/topics/rust` is not mistaken for the repo `topics/rust`.
 */
const RESERVED = new Set([
  "topics", "sponsors", "orgs", "users", "collections", "events", "marketplace",
  "features", "enterprise", "settings", "notifications", "new", "login", "join",
  "about", "blog", "client_id_error", "_client_id_error",
]);

const stripQuery = (s) => s.replace(/[?#].*$/, "");
const stripTrailing = (s) => s.replace(/\/+$/, "").replace(/\.git$/i, "");

/**
 * The first two path segments, kept as written so an empty one stays visible:
 * `acme//widget` and `/acme/widget` are malformed, not a repository.
 *
 * @param {string} path
 * @param {boolean} leadingSlash when the path always starts with one (a URL)
 * @returns {string[]}
 */
function segments(path, leadingSlash) {
  const parts = stripQuery(path).split("/");
  if (leadingSlash) parts.shift();
  return parts;
}

/**
 * @param {string} owner
 * @param {string} repo
 * @param {string} source
 * @returns {RepoRef | null}
 */
function build(owner, repo, source) {
  const a = stripTrailing(owner);
  const b = stripTrailing(repo);
  if (!a || !b) return null;
  if (!NAME.test(a) || !NAME.test(b)) return null;
  if (RESERVED.has(a.toLowerCase())) return null;
  const id = `${a.toLowerCase()}/${b.toLowerCase()}`;
  return { owner: a, repo: b, id, source };
}

/**
 * The one parser. Accepts `owner/repo`, an http(s) or protocol-relative GitHub
 * URL, an `ssh://` or scp-style git remote, each with an optional `.git` suffix,
 * trailing slash, ref subpath, query or fragment.
 *
 * @param {unknown} input
 * @returns {RepoRef | null}
 */
export function parseRepoRef(input) {
  const source = typeof input === "string" ? input.trim() : "";
  if (!source || /\s/.test(source)) return null;

  // scp-style remote: [user@]host:path, no scheme. The colon is the tell.
  const scp = /^(?:[A-Za-z0-9._-]+@)?([^:/?#\s]+):(.+)$/.exec(source);
  if (scp && !/^[A-Za-z][A-Za-z0-9+.-]*:\/\//i.test(source) && !/^\/\//.test(source)) {
    if (!GITHUB_HOSTS.has(scp[1].toLowerCase())) return null;
    const parts = segments(scp[2], false);
    return parts.length < 2 ? null : build(parts[0], parts[1], source);
  }

  // Any scheme (including schemeless //host/path): let URL settle host and case.
  if (/^[A-Za-z][A-Za-z0-9+.-]*:\/\//i.test(source) || /^\/\//.test(source)) {
    let url;
    try {
      url = new URL(source.startsWith("//") ? `https:${source}` : source);
    } catch {
      return null;
    }
    if (!GITHUB_HOSTS.has(url.hostname.toLowerCase())) return null;
    const parts = segments(url.pathname, true);
    if (parts.length < 2) return null;
    return build(parts[0], parts[1], source);
  }

  // Bare form, and anything else, is judged as a path rather than a URL, so a
  // mistaken host never parses as a repository.
  const parts = segments(source, false);
  if (parts.length < 2) return null;
  return build(parts[0], parts[1], source);
}

/**
 * @param {unknown} input
 * @returns {string | null} lowercased `owner/repo`, or null when unrecognized
 */
export function repoId(input) {
  return parseRepoRef(input)?.id ?? null;
}

/**
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
export function isSameRepo(a, b) {
  const x = repoId(a), y = repoId(b);
  return x !== null && x === y;
}

/**
 * The repository URL a page should link to, built from the canonical identity
 * so two spellings of one repo cannot render two different hrefs.
 *
 * @param {unknown} input
 * @returns {string | null}
 */
export function repoUrl(input) {
  const ref = parseRepoRef(input);
  return ref ? `https://github.com/${ref.id}` : null;
}
