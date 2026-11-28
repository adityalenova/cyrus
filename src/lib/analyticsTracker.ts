/* ══ analyticsTracker.ts — the site's in-page analytics bus ═══════════
   One event name, one direction out. `trackEvent` puts a `cyrus:analytics`
   CustomEvent on `window` and returns; it queues nothing, sends nothing and
   swallows nothing. Whatever consumes the events (the Vercel analytics
   bridge, an in-page panel) subscribes to that window event, which also means
   the tracker keeps working with no consumer attached. ══ */

/**
 * Publish one analytics event to the page.
 *
 * Fire-and-forget and render-safe: with no `window` (server rendering) the
 * call is a silent no-op rather than a throw, so a server component can import
 * and call it without a guard of its own.
 *
 * @param name - event name in `snake_case`, e.g. `"csv_export"`.
 * @param payload - JSON-serialisable detail for the event. Defaults to `{}`;
 *   must be an object, since listeners read named fields off it.
 * @returns nothing.
 * @example
 * trackEvent("csv_export", { rows: 12, filename: "programs.csv" });
 * @example
 * // the consumer side: the detail carries name, payload and time
 * window.addEventListener("cyrus:analytics", (e) => {
 *   const { name, payload, time } = (e as CustomEvent).detail;
 *   console.log(name, payload, time);
 * });
 */
export function trackEvent(name: string, payload: Record<string, any> = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("cyrus:analytics", { detail: { name, payload, time: Date.now() } }));
}
