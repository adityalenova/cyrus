/* ══ GET /api/github/events/[login] — a public GitHub timeline ═════════
   Reads https://api.github.com/users/{login}/events/public. Unauthenticated
   that endpoint allows 60 requests an hour for the whole deployment, so the
   answer is held in a module-scope cache keyed by login: many visitors ask
   for the same handful of profiles, and one upstream call serves them all
   for 90 seconds. A recently cached list is also served (marked `stale`)
   when GitHub answers 403/429, which is how a rate-limited minute still
   shows real events instead of an invented feed.

   A 404 from GitHub is passed through as "user not found". Nothing here
   fabricates events: on every failure `events` is empty (or the stale
   cache) and `error` says what happened.                              ═ */
import {
  isValidLogin, mapEvents,
  type EventsPayload, type FeedEvent,
} from "@/features/github-activity-feed/model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** fresh window: inside the 60-120s the issue asks for */
const TTL_MS = 90_000;
/** how long a cached list may still be shown, flagged stale, after a throttle */
const STALE_MS = 15 * 60_000;
const MAX_ENTRIES = 200;
const TIMEOUT_MS = 8_000;

type Entry = { events: FeedEvent[]; fetchedAt: number };
const cache = new Map<string, Entry>();

function remember(login: string, entry: Entry) {
  cache.delete(login);
  cache.set(login, entry);
  /* insertion order is the eviction order in a Map: drop the oldest key */
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

const NO_STORE = { "cache-control": "no-store" };
const CACHE_OK = { "cache-control": "public, max-age=60, s-maxage=90, stale-while-revalidate=600" };

const fail = (status: number, error: string) =>
  Response.json({ events: [], fetchedAt: null, error } satisfies EventsPayload, {
    status,
    headers: NO_STORE,
  });

/** GitHub reports the reset as an epoch second; a body that names the
    minute is more useful than a bare error string. */
function resetHint(h: Headers): string {
  const reset = Number(h.get("x-ratelimit-reset") ?? "");
  if (Number.isFinite(reset) && reset > 0) {
    return ` GitHub allows another read after ${new Date(reset * 1000).toISOString()}.`;
  }
  const retry = h.get("retry-after");
  if (retry) return ` GitHub asks callers to retry in ${retry}s.`;
  return "";
}

export async function GET(_req: Request, { params }: { params: Promise<{ login: string }> }) {
  const { login } = await params;
  const user = decodeURIComponent(login ?? "").trim();
  if (!isValidLogin(user)) {
    return fail(400, "That is not a valid GitHub login: 1-39 letters, digits or single hyphens, with no hyphen at either end.");
  }

  const now = Date.now();
  const hit = cache.get(user);
  if (hit && now - hit.fetchedAt < TTL_MS) {
    return Response.json({ events: hit.events, fetchedAt: hit.fetchedAt } satisfies EventsPayload, { headers: CACHE_OK });
  }

  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "cyrus-github-events-feed",
  };
  const token = (process.env.GITHUB_TOKEN ?? process.env.GITHUB_SERVER_TOKEN ?? "").trim();
  if (token) headers.authorization = `Bearer ${token}`;

  let upstream: Response;
  try {
    upstream = await fetch(
      `https://api.github.com/users/${encodeURIComponent(user)}/events/public?per_page=100`,
      { headers, next: { revalidate: 120 }, signal: AbortSignal.timeout(TIMEOUT_MS) },
    );
  } catch {
    const stale = hit && now - hit.fetchedAt < STALE_MS ? hit : null;
    if (stale) {
      return Response.json(
        { events: stale.events, fetchedAt: stale.fetchedAt, stale: true, error: "GitHub is unreachable right now; showing the last list read at the timestamp above." } satisfies EventsPayload,
        { headers: NO_STORE },
      );
    }
    return fail(502, "Could not reach GitHub. Nothing is cached for this login, so there is nothing to show yet.");
  }

  if (upstream.status === 404) {
    cache.delete(user);
    return fail(404, `GitHub has no user called ${user}.`);
  }

  if (upstream.status === 403 || upstream.status === 429) {
    const hint = resetHint(upstream.headers);
    const stale = hit && now - hit.fetchedAt < STALE_MS ? hit : null;
    if (stale) {
      return Response.json(
        { events: stale.events, fetchedAt: stale.fetchedAt, stale: true, error: `GitHub is rate-limiting this deployment. Showing the list read at the timestamp above.${hint}` } satisfies EventsPayload,
        { headers: NO_STORE },
      );
    }
    return fail(429, `GitHub is rate-limiting this deployment (60 unauthenticated requests an hour, shared by every visitor).${hint}`);
  }

  if (!upstream.ok) {
    return fail(502, `GitHub answered ${upstream.status} for this feed. No events were returned, so none are shown.`);
  }

  let events: FeedEvent[];
  try {
    events = mapEvents(await upstream.json());
  } catch {
    return fail(502, "GitHub returned a body this feed could not parse. Nothing is shown rather than guessing.");
  }

  const entry: Entry = { events, fetchedAt: Date.now() };
  remember(user, entry);
  return Response.json({ events: entry.events, fetchedAt: entry.fetchedAt } satisfies EventsPayload, { headers: CACHE_OK });
}
