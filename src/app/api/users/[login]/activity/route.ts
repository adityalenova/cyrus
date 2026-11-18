/* ══ GET /api/users/[login]/activity — a profile's GitHub timeline ═══
   The Events API is the only public record of what someone did on GitHub
   this week, but it is throttled hard when unauthenticated, so the answer
   is kept in-process for a few minutes: many visitors load the same few
   popular profiles, and one upstream call can serve all of them. A Bearer
   token is used when the deploy has one, which lifts the ceiling the issue
   cares about (60/hr unauthenticated, 5000/hr with a token).

   The rows are normalised here rather than in the browser so the view and
   any future consumer read one shape, defined in src/lib/activity.ts. */
import { LruCache } from "@/lib/server/lruCache";
import { normalizeEvents, type Activity } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type ActivityFeed = { login: string; events: Activity[]; fetchedAt: number };

/* a login is 1-39 chars, alphanumerics and single hyphens, not leading or
   trailing - GitHub's own rule, and it keeps the upstream path safe. */
const LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;

const TTL = 5 * 60_000;
const MAX = 500;
const cache = new LruCache<string, ActivityFeed>(MAX, TTL);

export async function GET(_req: Request, { params }: { params: Promise<{ login: string }> }) {
  const { login } = await params;
  const user = decodeURIComponent(login ?? "").trim();
  if (!LOGIN.test(user)) return Response.json({ error: "invalid username" }, { status: 400 });

  const cached = cache.get(user);
  if (cached) return Response.json(cached, { headers: CACHE_HEADERS });

  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "cyrus-activity-feed",
  };
  const token = (process.env.GITHUB_TOKEN ?? process.env.GITHUB_SERVER_TOKEN ?? "").trim();
  if (token) headers.authorization = `Bearer ${token}`;

  let events: Activity[];
  try {
    const upstream = await fetch(
      `https://api.github.com/users/${encodeURIComponent(user)}/events/public?per_page=100`,
      { headers, cache: "no-store" },
    );
    if (upstream.status === 404) return Response.json({ error: "no such user" }, { status: 404 });
    if (!upstream.ok) return Response.json({ error: `github returned ${upstream.status}` }, { status: 502 });
    events = normalizeEvents(await upstream.json());
  } catch {
    return Response.json({ error: "could not reach github" }, { status: 502 });
  }

  const feed: ActivityFeed = { login: user, events, fetchedAt: Date.now() };
  cache.set(user, feed);
  return Response.json(feed, { headers: CACHE_HEADERS });
}

const CACHE_HEADERS = { "cache-control": "public, max-age=30, s-maxage=300, stale-while-revalidate=600" };
