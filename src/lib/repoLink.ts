/* ══ src/lib/repoLink.ts — one canonical GitHub repository link ═══════════
   The same repository reaches the site as `owner/name`, an https URL, an
   `ssh://` URL and a copied git remote, each spelling with its own `.git`
   suffix and trailing slash. Anything that keys a repository - a crawler
   de-duplicating rows, a snapshot joining two sources, a page linking to the
   project - has to agree on one identity, or the same repository is counted
   twice and a link points at a path GitHub does not serve.

   This module decides that identity, and only that identity:

     normalizeRepoUrl(input) -> { owner, name, key, url } | null
     repoKey(input)          -> "owner/name" | null

   Rules the callers rely on:

   - Nothing throws. Anything not understood is `null`, so a crawler keeps
     going and a page shows a message instead of a stack.
   - `key` is lowercased, because GitHub treats owner and repository names as
     case-insensitive; `owner` and `name` keep the spelling that arrived, and
     `url` is the canonical https address built from that spelling.
   - Only a repository root is a repository link. A link to an issue, a pull
     request, a file or a branch names something inside a repository, and
     silently trimming it would attribute a row to a repository the input
     never pointed at. Those inputs are rejected here; call sites that
     genuinely want "the repository this PR belongs to" keep their own
     trimming and say so.
   - Only github.com (and its www) is accepted. A lookalike host, a
     percent-encoded path, a non-ASCII or zero-width character, or a
     userinfo trick is rejected rather than repaired.
   ═══════════════════════════════════════════════════════════════════════ */

/** hosts that serve a GitHub repository path */
const GITHUB_HOSTS = new Set(["github.com", "www.github.com"]);

/** owner: alphanumeric ends, hyphens inside, at most 39 characters */
const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;

/** repository name: GitHub's own charset, at most 100 characters */
const NAME = /^[A-Za-z0-9._-]{1,100}$/;

/** first path segments that are GitHub pages, never an account */
const RESERVED_OWNERS = new Set([
  "topics", "sponsors", "orgs", "users", "collections", "events", "marketplace",
  "features", "enterprise", "settings", "notifications", "new", "login", "join",
  "about", "blog", "pricing", "explore", "trending", "search", "apps",
  "codespaces", "discussions", "security", "contact", "dashboard", "account",
  "organizations", "teams", "issues", "pulls", "site",
]);

/** `scheme://` - tells a URL from an scp-style remote and from a bare path */
const SCHEME = /^[A-Za-z][A-Za-z0-9+.-]*:\/\//;

/** `[user@]host:path`, the shape git prints for a remote without a scheme */
const SCP = /^([A-Za-z0-9._-]+)@([A-Za-z0-9.-]+):(.+)$/;

/** a path segment that is only dots - URL normalisation would otherwise eat it */
const DOT_SEGMENT = /(?:^|\/)\.{1,2}(?=\/|$)/;

/** one normalized repository, with the spelling that arrived kept for display */
export interface RepoLink {
  /** owner segment as written */
  owner: string;
  /** repository name as written, without a `.git` suffix */
  name: string;
  /** lowercased `owner/name`, the value to key on */
  key: string;
  /** canonical https address, built from the spelling that arrived */
  url: string;
}

/**
 * The two path segments, or null. Exactly two: a root repository, no deeper.
 * Called only with a path that has already had its leading and trailing
 * slashes removed, so an empty segment in the middle is malformed.
 */
function fromPath(path: string): RepoLink | null {
  const parts = path.split("/");
  if (parts.length !== 2) return null;

  const owner = parts[0];
  const name = parts[1].replace(/\.git$/i, "");

  if (!OWNER.test(owner)) return null;
  if (!NAME.test(name)) return null;
  if (name === "." || name === "..") return null;
  if (RESERVED_OWNERS.has(owner.toLowerCase())) return null;

  return {
    owner,
    name,
    key: `${owner.toLowerCase()}/${name.toLowerCase()}`,
    url: `https://github.com/${owner}/${name}`,
  };
}

/** a path with no leading slash: `owner/name`, `owner/name.git/` */
function fromRelative(input: string): RepoLink | null {
  const path = input.replace(/\/+$/, "");
  if (!path || path.startsWith("/")) return null;
  return fromPath(path);
}

/** a URL pathname: exactly one leading slash, no empty segment after it */
function fromUrlPath(pathname: string): RepoLink | null {
  const path = pathname.replace(/\/+$/, "");
  if (!path.startsWith("/")) return null;
  return fromRelative(path.slice(1));
}

/**
 * One repository identity from the spellings people actually paste:
 * `owner/name`, an http(s) or protocol-relative GitHub URL, an `ssh://` URL,
 * an scp-style `git@github.com:` remote, each with an optional `.git` suffix
 * and trailing slashes.
 *
 * @param input the pasted link; anything unrecognized yields null
 * @returns the normalized repository, or null - never throws
 */
export function normalizeRepoUrl(input: string): RepoLink | null {
  try {
    if (typeof input !== "string") return null;

    const source = input.trim();
    if (!source) return null;
    /* printable ASCII only: rejects homoglyph hosts, zero-width characters and newlines */
    if (!/^[\x20-\x7e]+$/.test(source)) return null;
    if (/\s/.test(source)) return null;
    /* query, fragment, percent-encoding and backslashes are not repository links */
    if (/[?#%\\]/.test(source)) return null;
    if (DOT_SEGMENT.test(source)) return null;
    /* a URL keeps two slashes after its scheme; the URL parser would repair more */
    if (/^[A-Za-z][A-Za-z0-9+.-]*:\/{3,}/.test(source)) return null;

    /* protocol-relative URL: github.com is the host, not the owner */
    if (source.startsWith("//")) {
      if (source.startsWith("///")) return null;
      return normalizeRepoUrl(`https:${source}`);
    }

    if (SCHEME.test(source)) {
      let url: URL;
      try {
        url = new URL(source);
      } catch {
        return null;
      }
      const protocol = url.protocol.toLowerCase();
      if (protocol !== "https:" && protocol !== "http:" && protocol !== "ssh:") return null;
      if (!GITHUB_HOSTS.has(url.hostname.toLowerCase())) return null;
      if (url.port || url.password) return null;
      if (protocol === "ssh:" ? url.username !== "git" : url.username !== "") return null;
      return fromUrlPath(url.pathname);
    }

    /* scp-style remote: only the git account speaks for a repository */
    const scp = SCP.exec(source);
    if (scp) {
      if (scp[1].toLowerCase() !== "git") return null;
      if (!GITHUB_HOSTS.has(scp[2].toLowerCase())) return null;
      return fromRelative(scp[3]);
    }

    /* bare `owner/name`, and the schemeless `github.com/owner/name` people copy */
    const parts = source.replace(/\/+$/, "").split("/");
    if (parts.length && GITHUB_HOSTS.has(parts[0].toLowerCase())) parts.shift();
    return fromPath(parts.join("/"));
  } catch {
    return null;
  }
}

/**
 * The lowercased `owner/name` to key a repository on, or null.
 *
 * @param input the pasted link
 * @returns `owner/name` in lower case, or null - never throws
 */
export function repoKey(input: string): string | null {
  return normalizeRepoUrl(input)?.key ?? null;
}
