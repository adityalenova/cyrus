/* == dataControls.ts - wording and grouping for the Settings data controls ==
   Pure functions so the confirmation text can be tested without a browser. == */

export type TrackedKind = "issue" | "repository" | "organization";

export interface TrackedEntry {
  kind: TrackedKind;
  /** The key the board uses to remove it: issue URL, repo id or org login. */
  key: string;
  /** What the person sees: "owner/repo #12", "owner/repo", "org". */
  label: string;
}

const KIND_PLURAL: Record<TrackedKind, string> = {
  issue: "issues",
  repository: "repositories",
  organization: "organizations",
};

/** One line per kind, naming every item, e.g. "Issues: a/b #1, c/d #2". */
export function listByKind(entries: TrackedEntry[]): string[] {
  const kinds: TrackedKind[] = ["issue", "repository", "organization"];
  return kinds
    .map((k) => {
      const names = entries.filter((e) => e.kind === k).map((e) => e.label);
      if (!names.length) return "";
      const title = KIND_PLURAL[k][0].toUpperCase() + KIND_PLURAL[k].slice(1);
      return `${title}: ${names.join(", ")}`;
    })
    .filter(Boolean);
}

/**
 * The sentence shown before anything is removed. It names the items and says
 * what is not touched: the GitHub issues themselves and the public crawl.
 */
export function removalNotice(entries: TrackedEntry[]): string {
  if (!entries.length) return "Nothing selected.";
  const names = entries.map((e) => e.label).join(", ");
  const noun = entries.length === 1 ? "this selection" : `these ${entries.length} selections`;
  return (
    `Remove ${noun} from your board: ${names}. ` +
    "This only deletes your own tracking record. The GitHub issues and repositories " +
    "stay exactly as they are, and the public crawl data is not affected."
  );
}

export const OWNERSHIP_COPY = {
  account:
    "Yours: the issues, repositories and organizations you chose to track, and the stage you gave each issue. " +
    "Only your account can read, change or delete these.",
  crawl:
    "Public: issue counts, labels, stars and dates crawled from GitHub. " +
    "These are the same for everyone, are not tied to your account, and cannot be removed here.",
} as const;
