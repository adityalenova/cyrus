"use client"
/* ══ UserActivity.tsx — someone's recent GitHub activity, on their profile ═
   The data is someone else's, so the page has three honest states: loading,
   nothing yet, and the feed itself. The server route already normalised and
   cached the events (see src/app/api/users/[login]/activity/route.ts); every
   number and every colour on this screen is computed in src/lib/activity.ts,
   so what the unit tests cover is exactly what renders here. */
import { useEffect, useMemo, useState } from "react";
import { Link } from "@/lib/router";
import { Avatar, btn, Chip, Word } from "@/components/ui";
import { fmtCompact } from "@/lib/util";
import {
  KINDS, KIND_ICON, KIND_LABEL, filter, heatmap, relativeTime, summaryOf,
  type Activity, type ActivityKind, type HeatCell,
} from "@/lib/activity";
import type { ActivityFeed } from "@/app/api/users/[login]/activity/route";

const W = "max-w-[1240px] mx-auto px-6";

/* GitHub's green scale, expressed as an alpha over the site accent so it
   reads correctly in both the light and the dark theme without extra tokens. */
const LEVEL_ALPHA = [0.06, 0.22, 0.45, 0.7, 1] as const;
const levelColor = (level: number) => `rgba(34,197,94,${LEVEL_ALPHA[level] ?? 0.06})`;

function Heatmap({ rows, now }: { rows: Activity[]; now: Date }) {
  const { cells, total } = useMemo(() => heatmap(rows, { now, days: 371 }), [rows, now]);
  const cols = useMemo(() => {
    if (!cells.length) return [] as (HeatCell | null)[][];
    const first = new Date(`${cells[0].day}T00:00:00Z`);
    const pad = first.getUTCDay();
    const grid: (HeatCell | null)[] = [];
    for (let i = 0; i < pad; i++) grid.push(null);
    for (const c of cells) grid.push(c);
    const out: (HeatCell | null)[][] = [];
    for (let i = 0; i < grid.length; i += 7) out.push(grid.slice(i, i + 7));
    return out;
  }, [cells]);

  return (
    <div className="bg-card border border-line rounded-[18px] px-5 py-4">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <p className="font-mono text-[10.5px] tracking-[.12em] uppercase text-dim">Contribution heatmap</p>
        <p className="font-mono text-[11px] text-cocoa">{fmtCompact(total)} events / year</p>
      </div>
      <div className="overflow-x-auto pb-1">
        <div className="flex gap-[3px] w-max">
          {cols.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((c, di) => (
                c ? (
                  <span key={c.day} title={`${c.day}: ${c.count} event${c.count === 1 ? "" : "s"}`}
                    className="w-[11px] h-[11px] rounded-[2px]"
                    style={{ background: levelColor(c.level), outline: c.count ? "none" : "1px solid var(--line, rgba(0,0,0,.06))" }} />
                ) : (
                  <span key={`e${di}`} className="w-[11px] h-[11px]" />
                )
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EventRow({ a }: { a: Activity }) {
  return (
    <li className="flex items-start gap-3 border-b border-line last:border-0 py-3">
      <span aria-hidden className="mt-0.5 w-7 h-7 shrink-0 rounded-full bg-clay text-ink grid place-items-center font-mono text-[13px]">
        {KIND_ICON[a.kind]}
      </span>
      <div className="min-w-0 flex-1">
        <a href={a.url} target="_blank" rel="noreferrer" className="card-title truncate hover:text-accent">
          {a.title}
        </a>
        <p className="text-cocoa text-[12.5px] truncate mt-0.5">
          <span className="font-mono text-[10.5px] uppercase tracking-[.1em] text-dim mr-2">{KIND_LABEL[a.kind]}</span>
          {a.repo && <span className="hover:text-ink">{a.repo}</span>}
          {a.state && <> · {a.state}</>}
        </p>
      </div>
      <time className="font-mono text-[11px] text-dim shrink-0" dateTime={a.time}>{relativeTime(a.time)}</time>
    </li>
  );
}

export default function UserActivity({ login }: { login: string }) {
  const [feed, setFeed] = useState<ActivityFeed | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [kind, setKind] = useState<ActivityKind | "all">("all");
  const [nonce, setNonce] = useState(0);
  const now = useMemo(() => new Date(), []);

  useEffect(() => {
    let dead = false;
    setStatus("loading");
    fetch(`/api/users/${encodeURIComponent(login)}/activity`)
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<ActivityFeed>;
      })
      .then((d) => { if (!dead) { setFeed(d); setStatus("ok"); } })
      .catch(() => { if (!dead) setStatus("error"); });
    return () => { dead = true; };
  }, [login, nonce]);

  const events = feed?.events ?? [];
  const present = useMemo(() => {
    const set = new Set(events.map((e) => e.kind));
    return KINDS.filter((k) => set.has(k));
  }, [events]);
  const counts = useMemo(() => {
    const m = new Map<ActivityKind, number>();
    for (const e of events) m.set(e.kind, (m.get(e.kind) ?? 0) + 1);
    return m;
  }, [events]);
  const shown = useMemo(() => filter(events, { kind }), [events, kind]);

  return (
    <div className={`${W} pt-14 pb-4`}>
      <p className="font-mono text-[10.5px] tracking-[.14em] uppercase text-dim">
        <Link to="/" className="hover:text-accent">Platform</Link> <span className="text-accent">›</span>{" "}
        <span className="text-cocoa">{login}</span>
      </p>

      <div className="flex items-center gap-4 mt-3.5">
        <Avatar name={login} src={`https://github.com/${encodeURIComponent(login)}.png?size=120`} size={56} />
        <div>
          <h1 className="font-display font-extrabold tracking-[-.02em] text-[clamp(28px,3.6vw,42px)] leading-tight">
            <Word>{login}</Word>
          </h1>
          <p className="text-cocoa text-[13.5px] mt-0.5">
            {status === "ok" ? (events.length ? summaryOf(events) : "no recent public activity") : "reading the GitHub event feed…"}
          </p>
        </div>
        <Link to={`/users/${encodeURIComponent(login)}/feed`} className={btn("ghost", "sm") + " ml-auto"}>Event feed →</Link>
        <a href={`https://github.com/${encodeURIComponent(login)}`} target="_blank" rel="noreferrer"
          className={btn("outline", "sm")}>GitHub profile ↗</a>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6 mt-8">
        <div className="order-2 lg:order-1">
          {status === "error" && (
            <div className="bg-card border border-line rounded-[18px] px-5 py-8 text-center">
              <p className="card-title mb-1">Couldn't load this activity</p>
              <p className="card-desc mb-4">GitHub is rate-limiting this deployment, or the feed is briefly unavailable.</p>
              <button className={btn("primary", "sm")} onClick={() => setNonce((n) => n + 1)}>Retry</button>
            </div>
          )}

          {status === "ok" && events.length === 0 && (
            <div className="bg-card border border-line rounded-[18px] px-5 py-10 text-center">
              <p className="card-title mb-1">Nothing public in the last 90 days</p>
              <p className="card-desc max-w-[420px] mx-auto">
                GitHub only keeps the last 300 events for a user, and none are recent for {login}.
              </p>
            </div>
          )}

          {status === "ok" && events.length > 0 && (
            <div className="bg-card border border-line rounded-[22px] px-6 py-4 shadow-soft">
              <ul className="list-none m-0 p-0">
                {shown.length ? shown.map((a) => <EventRow key={a.id} a={a} />)
                  : <li className="card-desc py-6 text-center">No events of this type.</li>}
              </ul>
            </div>
          )}
        </div>

        <aside className="order-1 lg:order-2 grid gap-5 content-start">
          <Heatmap rows={events} now={now} />
          {events.length > 0 && (
            <div className="bg-card border border-line rounded-[18px] px-5 py-4">
              <p className="font-mono text-[10.5px] tracking-[.12em] uppercase text-dim mb-3">Filter by type</p>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => setKind("all")} aria-pressed={kind === "all"}
                  className={`transition-all ${kind === "all" ? "opacity-100" : "opacity-70 hover:opacity-100"}`}>
                  <Chip tone={kind === "all" ? "green" : ""}>all · {events.length}</Chip>
                </button>
                {present.map((k) => (
                  <button key={k} onClick={() => setKind(kind === k ? "all" : k)} aria-pressed={kind === k}
                    className={`transition-all ${kind === k ? "opacity-100" : "opacity-70 hover:opacity-100"}`}>
                    <Chip tone={kind === k ? "green" : ""}>{KIND_ICON[k]} {KIND_LABEL[k]} · {counts.get(k)}</Chip>
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
