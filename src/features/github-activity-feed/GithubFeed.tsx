"use client"
/* ══ GithubFeed.tsx — one person's public GitHub timeline ═════════════
   Issue #190. The route at /api/github/events/[login] has already mapped
   GitHub's events into FeedEvent rows (src/features/github-activity-feed/
   model.ts); this screen renders them, filters them, and draws a 90-day
   heatmap from their timestamps. Every state the route can answer with is
   shown as what it is: a 404 is "no such user", a 403/429 is "GitHub is
   throttling us", and an empty feed is empty - no sample rows anywhere. ═ */
import { useEffect, useMemo, useState } from "react";
import { Link } from "@/lib/router";
import { Card } from "@/lib/dash/shell";
import { Avatar, btn } from "@/components/ui";
import {
  age, filterEvents, heatWeeks, heatmap, kindCounts, stateForStatus, summary,
  KIND_ICON, KIND_LABEL,
  type EventKind, type EventsPayload, type FeedState, type HeatCell,
} from "./model";

const W = "max-w-[1240px] mx-auto px-6";

/* GitHub's green ramp as alphas over the accent, so the heatmap reads on
   graphite and on paper without a second token set. */
const LEVEL_ALPHA = [0, 0.2, 0.42, 0.68, 1] as const;
const cellBG = (level: number) =>
  level === 0 ? "var(--color-clay)" : `rgba(34,197,94,${LEVEL_ALPHA[level] ?? 0.2})`;

type Status = FeedState | "loading";

function Heatmap({ cells, total, activeDays }: { cells: HeatCell[]; total: number; activeDays: number }) {
  const weeks = useMemo(() => heatWeeks(cells), [cells]);
  const active = useMemo(() => cells.filter((c) => c.count > 0), [cells]);
  return (
    <Card className="reveal" style={{ animationDelay: "120ms" }}>
      <div className="flex items-baseline gap-3 flex-wrap mb-1">
        <p className="panel-h-lg">Last 90 days</p>
        <p className="ml-auto font-mono text-[11px] text-cocoa">
          {total} event{total === 1 ? "" : "s"} · {activeDays} active day{activeDays === 1 ? "" : "s"}
        </p>
      </div>
      <p className="card-desc mb-3">
        Built from the timestamps in the public events API (up to 300 most recent events). A quiet
        square means no event is in the payload for that day, not that nothing happened on GitHub.
      </p>

      <div className="overflow-x-auto pb-1">
        <div className="flex gap-[3px] w-max" role="img"
          aria-label={`Contribution heatmap for the last 90 days: ${total} events across ${activeDays} active days. A day-by-day table follows.`}>
          {weeks.map((week, wi) => (
            <div key={`w${wi}`} className="flex flex-col gap-[3px]">
              {week.map((cell, di) =>
                cell ? (
                  <span key={cell.day} className="w-[12px] h-[12px] rounded-[2px]"
                    style={{ background: cellBG(cell.level) }}
                    title={`${cell.day}: ${cell.count} event${cell.count === 1 ? "" : "s"}`} />
                ) : (
                  <span key={`blank-${wi}-${di}`} className="w-[12px] h-[12px]" aria-hidden />
                ),
              )}
            </div>
          ))}
        </div>
      </div>

      <details className="mt-3 group">
        <summary className="font-mono text-[10.5px] uppercase tracking-[.14em] text-dim cursor-pointer hover:text-accent focus-visible:ring-2 focus-visible:ring-accent rounded">
          Day-by-day table ({active.length} active)
        </summary>
        <div className="mt-2 max-h-[220px] overflow-y-auto panel-scroll border border-line rounded-[12px]">
          <table className="w-full text-left text-[12.5px]">
            <caption className="sr-only">Events per UTC day over the last 90 days</caption>
            <thead className="sticky top-0 bg-sand">
              <tr className="font-mono text-[10px] uppercase tracking-[.12em] text-dim">
                <th scope="col" className="px-3 py-2">Day (UTC)</th>
                <th scope="col" className="px-3 py-2 text-right">Events</th>
              </tr>
            </thead>
            <tbody>
              {active.length === 0 ? (
                <tr><td colSpan={2} className="px-3 py-3 card-desc">No event inside the 90-day window.</td></tr>
              ) : active.map((c) => (
                <tr key={c.day} className="border-t border-line">
                  <td className="px-3 py-1.5 font-mono text-[11.5px]">{c.day}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-[11.5px]">{c.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </Card>
  );
}

function TimelineRow({ event }: { event: EventsPayload["events"][number] }) {
  return (
    <li className="flex items-start gap-3 py-3 border-b border-line last:border-0">
      <span aria-hidden className="mt-0.5 w-7 h-7 shrink-0 rounded-full bg-clay text-accent grid place-items-center font-mono text-[13px]">
        {KIND_ICON[event.kind]}
      </span>
      <div className="min-w-0 flex-1">
        {event.url ? (
          <a href={event.url} target="_blank" rel="noreferrer noopener" className="card-title block truncate hover:text-accent">
            {event.title}
          </a>
        ) : (
          <span className="card-title block truncate">{event.title}</span>
        )}
        <p className="text-cocoa text-[12px] truncate mt-0.5">
          <span className="font-mono text-[10px] uppercase tracking-[.12em] text-dim mr-2">{KIND_LABEL[event.kind]}</span>
          {event.repo && <span>{event.repo}</span>}
          {event.type === "CreateEvent" && <span> · {event.type}</span>}
        </p>
      </div>
      <time className="font-mono text-[11px] text-dim shrink-0" dateTime={event.time} title={event.time}>
        {age(event.time)}
      </time>
    </li>
  );
}

export default function GithubFeed({ login }: { login: string }) {
  const [data, setData] = useState<EventsPayload | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [kind, setKind] = useState<EventKind | "all">("all");
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let dead = false;
    setStatus("loading");
    fetch(`/api/github/events/${encodeURIComponent(login)}`)
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as EventsPayload | null;
        if (dead) return;
        const next = stateForStatus(res.status);
        setData(body);
        setStatus(next);
      })
      .catch(() => {
        if (dead) return;
        setData(null);
        setStatus("error");
      });
    return () => { dead = true; };
  }, [login, nonce]);

  const events = useMemo(() => data?.events ?? [], [data]);
  const counts = useMemo(() => kindCounts(events), [events]);
  const shown = useMemo(() => filterEvents(events, { kind }), [events, kind]);
  const heat = useMemo(() => heatmap(events, { days: 90 }), [events]);
  const heading = `Events from ${login}`;

  return (
    <div className={`${W} pt-14 pb-14`}>
      <p className="font-mono text-[10.5px] tracking-[.14em] uppercase text-dim">
        <Link to="/" className="hover:text-accent">Platform</Link>{" "}
        <span className="text-accent" aria-hidden>›</span>{" "}
        <Link to={`/users/${encodeURIComponent(login)}`} className="hover:text-accent">{login}</Link>{" "}
        <span className="text-accent" aria-hidden>›</span>{" "}
        <span className="text-cocoa">event feed</span>
      </p>

      <div className="flex items-center gap-4 mt-4 flex-wrap">
        <Avatar name={login} size={54} src={`https://github.com/${encodeURIComponent(login)}.png?size=120`} />
        <div className="min-w-0">
          <h1 className="font-display font-extrabold tracking-[-.025em] text-[clamp(26px,3.4vw,40px)] leading-tight">
            {heading}
          </h1>
          <p className="text-cocoa text-[13.5px] mt-1" role="status">
            {status === "loading" && "Reading the public event feed…"}
            {status === "ok" && (events.length ? summary(events) : "no public events to show")}
            {status === "not-found" && "GitHub has no such user"}
            {status === "invalid" && "That login is not valid GitHub syntax"}
            {status === "rate-limited" && "GitHub is rate-limiting this deployment"}
            {status === "error" && "The feed could not be read"}
          </p>
        </div>
        <div className="ml-auto flex gap-2 flex-wrap">
          <Link to={`/users/${encodeURIComponent(login)}`} className={btn("ghost", "sm")}>Profile activity</Link>
          <a href={`https://github.com/${encodeURIComponent(login)}`} target="_blank" rel="noreferrer noopener"
            className={btn("outline", "sm")}>GitHub profile ↗</a>
        </div>
      </div>

      {status === "loading" && (
        <div className="mt-10 grid gap-4" aria-busy="true">
          <div className="h-[92px] rounded-[18px] border border-line bg-card animate-pulse" />
          <div className="h-[220px] rounded-[18px] border border-line bg-card animate-pulse" />
        </div>
      )}

      {status === "not-found" && (
        <Card className="mt-8" >
          <div role="alert">
            <p className="panel-h-lg mb-1">No user called {login}</p>
            <p className="card-desc max-w-[520px]">
              {data?.error ?? "GitHub answered 404 for this login."} Usernames are case-insensitive on GitHub,
              but they have to exist and have a public profile.
            </p>
          </div>
        </Card>
      )}

      {status === "invalid" && (
        <Card className="mt-8">
          <div role="alert">
            <p className="panel-h-lg mb-1">That is not a login</p>
            <p className="card-desc max-w-[520px]">
              {data?.error ?? "GitHub logins are 1-39 letters, digits or single hyphens, with no hyphen at either end."}
            </p>
          </div>
        </Card>
      )}

      {(status === "rate-limited" || status === "error") && (
        <Card className="mt-8">
          <div role="alert">
            <p className="panel-h-lg mb-1">{status === "rate-limited" ? "GitHub is throttling this deployment" : "The feed could not be read"}</p>
            <p className="card-desc max-w-[560px]">
              {data?.error ?? "The request failed before any events could be read."} Nothing is drawn from
              memory or from other accounts - an unavailable feed stays unavailable here.
            </p>
            <button className={btn("primary", "sm") + " mt-4"} onClick={() => setNonce((n) => n + 1)}>Try again</button>
          </div>
        </Card>
      )}

      {status === "ok" && data?.stale && (
        <p className="mt-6 font-mono text-[10.5px] uppercase tracking-[.13em] text-honey" role="status">
          Cached list · read {data.fetchedAt ? new Date(data.fetchedAt).toISOString().replace("T", " ").slice(0, 16) : "earlier"} UTC
        </p>
      )}

      {status === "ok" && events.length === 0 && (
        <Card className="mt-8">
          <div role="status">
            <p className="panel-h-lg mb-1">No public events</p>
            <p className="card-desc max-w-[560px]">
              GitHub returned an empty list. It keeps only the most recent public events, so an account
              that has been quiet recently shows nothing here - the profile itself may still be active in
              private repositories, which this API never exposes.
            </p>
          </div>
        </Card>
      )}

      {status === "ok" && events.length > 0 && (
        <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-6 mt-8 items-start">
          <Card className="reveal" style={{ animationDelay: "60ms" }}>
            <div className="flex items-baseline gap-3 flex-wrap mb-3">
              <h2 className="panel-h-lg">Timeline</h2>
              <p className="font-mono text-[10.5px] uppercase tracking-[.13em] text-dim ml-auto">
                {shown.length} of {events.length} shown
              </p>
            </div>

            <div role="group" aria-label="Filter by event type" className="flex flex-wrap gap-1.5 mb-3">
              <button onClick={() => setKind("all")} aria-pressed={kind === "all"}
                className={`font-mono text-[10.5px] font-semibold rounded-full px-2.5 py-1 border transition-colors ${kind === "all" ? "text-accentfg bg-accent border-accent" : "text-cocoa border-line bg-cream hover:text-ink"}`}>
                All · {events.length}
              </button>
              {counts.map((c) => (
                <button key={c.kind} onClick={() => setKind(kind === c.kind ? "all" : c.kind)} aria-pressed={kind === c.kind}
                  className={`font-mono text-[10.5px] font-semibold rounded-full px-2.5 py-1 border transition-colors ${kind === c.kind ? "text-accentfg bg-accent border-accent" : "text-cocoa border-line bg-cream hover:text-ink"}`}>
                  <span aria-hidden>{KIND_ICON[c.kind]} </span>{KIND_LABEL[c.kind]} · {c.count}
                </button>
              ))}
            </div>

            {shown.length === 0 ? (
              <p className="card-desc py-6 text-center" role="status">No {KIND_LABEL[kind as EventKind].toLowerCase()} in this payload.</p>
            ) : (
              <ol className="list-none m-0 p-0">
                {shown.map((e) => <TimelineRow key={e.id} event={e} />)}
              </ol>
            )}
          </Card>

          <aside className="grid gap-6">
            <Heatmap cells={heat.cells} total={heat.total} activeDays={heat.activeDays} />
            <Card className="reveal" style={{ animationDelay: "180ms" }}>
              <p className="font-mono text-[10.5px] uppercase tracking-[.14em] text-dim mb-2">Where this comes from</p>
              <p className="card-desc">
                <code className="font-mono text-[12px] text-ink">GET /users/{login}/events/public</code> on
                api.github.com, read through this site&apos;s server route. GitHub keeps up to 90 days or 300
                events, whichever runs out first; the list here is one page of 100 events, cached for
                90 seconds.
              </p>
            </Card>
          </aside>
        </div>
      )}
    </div>
  );
}
