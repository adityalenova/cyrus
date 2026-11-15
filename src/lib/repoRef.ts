/* ══ repoRef.ts — one canonical GitHub repository identity ══
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

   Typed, like the rest of src/lib. The builders that need it run under
   `npx tsx` and import it with its `.ts` extension, the same way
   build-org-class.mjs imports orgClassify.ts.                 ═ */

/** One repository, as written and as keyed. */
export type RepoRef = {
  /** the owner segment as written */
  owner: string;
  /** the repository segment as written */
  repo: string;
  /** lowercased `owner/repo`, the value to key on */
  id: string;
  /** the input exactly as it arrived, for provenance */
  source: string;
};

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

const stripQuery = (s: string) => s.replace(/[?#].*$/, "");
const stripTrailing = (s: string) => s.replace(/\/+$/, "").replace(/\.git$/i, "");

/**
 * The first two path segments, kept as written so an empty one stays visible:
 * `acme//widget` and `/acme/widget` are malformed, not a repository.
 */
function segments(path: string, leadingSlash: boolean): string[] {
  const parts = stripQuery(path).split("/");
  if (leadingSlash) parts.shift();
  return parts;
}

function build(owner: string, repo: string, source: string): RepoRef | null {
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
 */
export function parseRepoRef(input: unknown): RepoRef | null {
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
    let url: URL;
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

/** lowercased `owner/repo`, or null when the input is unrecognized. */
export function repoId(input: unknown): string | null {
  return parseRepoRef(input)?.id ?? null;
}

/** Whether two spellings name the same repository. */
export function isSameRepo(a: unknown, b: unknown): boolean {
  const x = repoId(a), y = repoId(b);
  return x !== null && x === y;
}

/**
 * The repository URL a page should link to, built from the canonical identity
 * so two spellings of one repo cannot render two different hrefs.
 */
export function repoUrl(input: unknown): string | null {
  const ref = parseRepoRef(input);
  return ref ? `https://github.com/${ref.id}` : null;
}
