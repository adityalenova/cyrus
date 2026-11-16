/* Where focus goes when the board section changes.
   Moving between sections swaps the page content without a full load, so
   keyboard and screen reader users would otherwise stay on a link that no
   longer describes where they are. Pure so the policy can be tested. */

/** Focus moves only when the section really changed, never on first paint. */
export function shouldMoveFocus(prev: string | null, next: string): boolean {
  return prev !== null && prev !== next;
}

/** The heading to focus inside the content area, or null if none rendered yet. */
export function pickHeading(root: ParentNode | null): HTMLElement | null {
  if (!root) return null;
  return root.querySelector<HTMLElement>("h1");
}
