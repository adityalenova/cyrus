/* ══ programFields.ts — how a program shows a field it does not publish.
   One helper owns the wording so the catalog card and the detail page cannot
   drift apart: a fact the source simply does not state reads "Not published";
   a fact the source states does not apply reads "Not available". Either way an
   unpublished field is never rendered as a zero, a blank label, or an inference.
   Pick one wording per case here and call these everywhere — no component may
   decide fallback copy on its own.                                          ══ */

export const NOT_PUBLISHED = "Not published";
export const NOT_AVAILABLE = "Not available";

type MaybeText = string | null | undefined;

/** A record publishes a fact only when it carries non-empty prose for it. */
export function isPublished(raw: MaybeText): boolean {
  return typeof raw === "string" && raw.trim().length > 0;
}

/** The value to render: the published text, or `fallback` — never a blank or a zero. */
export function fieldText(raw: MaybeText, fallback: string = NOT_PUBLISHED): string {
  return isPublished(raw) ? (raw as string).trim() : fallback;
}

/** Catalog card stipend chip and the detail page's program strip. */
export const stipendText = (pay: MaybeText): string => fieldText(pay);

/** Application-window row, shared by the card and the detail sidebar. */
export const windowText = (win: MaybeText): string => fieldText(win);

/** Eligibility row: a program that states no rule is "Not published", not "no rule". */
export const eligibilityText = (eligibility: MaybeText): string => fieldText(eligibility);

/** Reach row (the orgs sentence). */
export const reachText = (orgs: MaybeText): string => fieldText(orgs);

/** Detail sidebar stipend: "USD 1,500 (stipend)". The unit only shows when the
 *  record publishes it, so an unpublished note never leaves an empty "()" behind. */
export function stipendMeta(pay: MaybeText, payNote: MaybeText): string {
  if (!isPublished(pay)) return NOT_PUBLISHED;
  const value = (pay as string).trim();
  return isPublished(payNote) ? `${value} (${(payNote as string).trim().toLowerCase()})` : value;
}

/** SEO description stipend: a currency figure carries its published unit, prose
 *  stands alone, and an unpublished pay contributes "" so the line is dropped
 *  rather than guessed. Mirrors the card's wording without inventing a value. */
export function stipendPhrase(pay: MaybeText, payNote: MaybeText): string {
  if (!isPublished(pay)) return "";
  const value = (pay as string).trim();
  return value.startsWith("$") && isPublished(payNote)
    ? `${value} ${(payNote as string).trim().toLowerCase()}`
    : value;
}
