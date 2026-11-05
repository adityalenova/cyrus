"use client"
/* ══ ProgramOrgs.tsx — every organization in one program, filterable ═══
   The program page used to unroll its whole participation list inline, which
   buried everything else on the page. The list now lives here: one rich card
   per organization, with the logo and blurb from Contribo's published record,
   the participation counts and years from our own archive, and the live GitHub
   stats for the ones we track.

   Three filters, because those are the three questions people actually ask of
   a program's organization list: which year, which technology, which field.
   The sector and technology values are derived from what each program wrote
   about the organization (see orgTaxonomy.ts), never typed in by hand, so a
   row with no category has no sector claim and a row with no technologies
   shows no chips.                                                        ═ */
import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "@/lib/router";
import { PROGRAMS } from "../data/orgs";
import { useProgramOrgs, type ProgramOrg } from "../lib/contriboOrgs";
import { useOverlaps } from "../lib/programRoster";
import { avatarOf, fmtCompact } from "../lib/util";
import { useStore } from "../lib/store";
import { btn, OrgImg, Word } from "../components/ui";
import NotFound from "./NotFound";

const W = "max-w-[1240px] mx-auto px-6";
const PAGE = 36;

type Sort = "projects" | "stars" | "name";
const SORTS: [Sort, string][] = [["projects", "Most projects"], ["stars", "Most stars"], ["name", "A to Z"]];

/* ── small controls ────────────────────────────────────────── */
const field = "bg-card border border-line rounded-xl px-3 py-2.5 text-[13px] text-ink outline-none transition-all focus:border-accent cursor-pointer";

function Select({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: [string, string][];
}) {
  return (
    <label className="flex items-center gap-2 min-w-0">
      <span className="font-mono text-[9.5px] uppercase tracking-[.11em] text-dim shrink-0">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}
        className={`${field} select-warm min-w-0 max-w-[210px] truncate pr-8`}>
        {options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
    </label>
  );
}

function YearChip({ y, on, toggle }: { y: number; on: boolean; toggle: () => void }) {
  return (
    <button type="button" onClick={toggle} aria-pressed={on}
      className={`font-mono text-[11px] font-semibold rounded-full px-3 py-[6px] border transition-all ${
        on ? "bg-ink text-paper border-ink" : "bg-card text-cocoa border-line hover:border-accent hover:text-rust"}`}>
      {y}
    </button>
  );
}

/* ── one organization ──────────────────────────────────────── */
function OrgCard({ o, pid, areas }: { o: ProgramOrg; pid: string; areas: boolean }) {
  const { savedOrgs, toggleSavedOrg, toast } = useStore();
  const on = !!o.login && savedOrgs.includes(o.login);
  const label = `${fmtCompact(o.projects)} project${o.projects === 1 ? "" : "s"}`;

  const share = () => {
    const url = `${window.location.origin}/programs/${pid}/organizations?q=${encodeURIComponent(o.name)}`;
    navigator.clipboard?.writeText(url)
      .then(() => toast("Link to this organization copied"))
      .catch(() => toast("Could not reach the clipboard - copy the address bar instead"));
  };

  return (
    <article className="bg-card border border-line rounded-[18px] p-[18px] flex flex-col shadow-soft transition-all duration-200 hover:-translate-y-1 hover:shadow-lift hover:border-accent/40">
      <div className="flex items-start gap-3 min-w-0">
        <span className="w-[44px] h-[44px] rounded-[13px] overflow-hidden shrink-0 bg-cream border border-line grid place-items-center">
          <OrgImg src={o.logo || avatarOf(o.login || o.name, 88)} name={o.name} className="w-full h-full object-cover" />
        </span>
        <div className="min-w-0 flex-1">
          <b className="card-title text-[14.5px] block truncate">{o.name}</b>
          {o.sector === "Other" ? (
            <span className="font-mono text-[9.5px] uppercase tracking-[.12em] text-dim block truncate mt-[3px]">
              {o.login ? `@${o.login}` : "field not recorded"}
            </span>
          ) : (
            <Link to={`/organizations?sector=${encodeURIComponent(o.sector)}`} title={`Every ${o.sector} organization in the directory`}
              className="font-mono text-[9.5px] uppercase tracking-[.12em] text-dim block truncate mt-[3px] hover:text-accent transition-colors">{o.sector}</Link>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button type="button" onClick={share} aria-label={`Copy a link to ${o.name}`} title="Copy a link to this organization"
            className="w-8 h-8 grid place-items-center rounded-[9px] border border-line text-dim hover:text-cocoa hover:border-accent/50 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden>
              <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 3v11M8 7l4-4 4 4" />
            </svg>
          </button>
          <button type="button" onClick={() => o.login && toggleSavedOrg(o.login)} disabled={!o.login}
            aria-pressed={on} title={o.login ? (on ? "Remove from your watchlist" : "Save to your watchlist") : "Not tracked on GitHub, so there is nothing to follow yet"}
            className={`h-8 px-2.5 grid place-items-center rounded-[9px] border transition-colors ${
              on ? "bg-peach border-accent/45 text-rust" : "border-line text-dim hover:text-cocoa hover:border-accent/50"} ${!o.login ? "opacity-45 cursor-not-allowed" : ""}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" aria-hidden>
              <path d="M6 4h12v16l-6-4-6 4z" />
            </svg>
          </button>
        </div>
      </div>

      <p className="text-cocoa text-[12.5px] leading-[1.6] mt-3 line-clamp-3 min-h-[58px]">
        {o.desc || (areas ? `The program's list gives this area no description - it is recorded here with ${label}.` : `No blurb in the record for this organization - it is listed here with ${label}.`)}
      </p>

      <div className="flex items-center gap-2.5 flex-wrap mt-3 font-mono text-[10px] text-dim">
        <span><b className="text-accent font-bold">{fmtCompact(o.projects)}</b> {o.projects === 1 ? "project" : "projects"}</span>
        {o.inSite && <span className="text-honey font-bold">★ {fmtCompact(o.stars)}</span>}
        {o.inSite && <span>{fmtCompact(o.repos)} repos</span>}
        {o.site && <a href={o.site} target="_blank" rel="noopener" className="truncate max-w-[150px] hover:text-accent underline underline-offset-2 decoration-line">website</a>}
      </div>

      {o.years.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {o.years.slice(0, 7).map((y) => (
            <span key={y} className="font-mono text-[9.5px] font-semibold rounded-[7px] border border-line bg-cream px-1.5 py-[3px] text-cocoa">{y}</span>
          ))}
          {o.years.length > 7 && <span className="font-mono text-[9.5px] text-dim py-[3px]">+{o.years.length - 7}</span>}
        </div>
      )}

      {o.techs.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {o.techs.slice(0, 5).map((t) => (
            <span key={t} className="font-mono text-[9.5px] rounded-full border border-denim/25 bg-denim/6 text-denim px-2 py-[3px]">{t}</span>
          ))}
          {o.techs.length > 5 && <span className="font-mono text-[9.5px] text-dim py-[3px]">+{o.techs.length - 5}</span>}
        </div>
      )}

      <div className="mt-auto pt-4 flex items-center justify-between gap-3">
        {o.inSite
          ? <Link to={o.to} className="font-semibold text-[12.5px] text-rust inline-flex items-center gap-1.5 group">
              {areas ? "View the projects in this area" : "View organization"}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden className="transition-transform group-hover:translate-x-0.5"><path d="M5 12h13m-5-6 6 6-6 6" /></svg>
            </Link>
          : <a href={o.to} target="_blank" rel="noopener" className="font-semibold text-[12.5px] text-rust inline-flex items-center gap-1.5">
              {o.login ? "On GitHub" : "Official page"}
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M7 17 17 7M9 7h8v8" /></svg>
            </a>}
      </div>
    </article>
  );
}

/* ── the page ──────────────────────────────────────────────── */
export default function ProgramOrgs() {
  const { id } = useParams();
  const p = PROGRAMS.find((x) => x.id === id);
  const r = useProgramOrgs(id ?? "");
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [tech, setTech] = useState(params.get("tech") ?? "");
  const [sector, setSector] = useState(params.get("sector") ?? "");
  const [sort, setSort] = useState<Sort>("projects");
  const [years, setYears] = useState<number[]>(() => {
    const y = Number(params.get("year"));
    return y ? [y] : [];
  });
  const [shown, setShown] = useState(PAGE);
  const withLogo = useMemo(() => r.rows.filter((o) => o.branded).length, [r.rows]);
  const overlaps = useOverlaps(id ?? "");

  useEffect(() => { setShown(PAGE); }, [q, tech, sector, years, sort]);

  const hits = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = r.rows;
    if (needle) out = out.filter((o) => (o.name + " " + o.desc + " " + o.login).toLowerCase().includes(needle));
    if (tech) out = out.filter((o) => o.techs.includes(tech));
    if (sector) out = out.filter((o) => o.sector === sector);
    if (years.length) out = out.filter((o) => years.every((y) => o.years.includes(y)));
    if (sort === "name") out = [...out].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "stars") out = [...out].sort((a, b) => b.stars - a.stars || b.projects - a.projects);
    return out;
  }, [r.rows, q, tech, sector, years, sort]);

  if (!p) return <NotFound />;

  const dirty = !!(q || tech || sector || years.length);
  const clear = () => { setQ(""); setTech(""); setSector(""); setYears([]); };
  const toggleYear = (y: number) => setYears((cur) => (cur.includes(y) ? cur.filter((x) => x !== y) : [...cur, y]));

  /* Season of KDE publishes project areas, not a roster of host organizations
     (see AREA_ONLY in contriboOrgs.ts). The page says so wherever it counts. */
  const areas = r.kind === "areas";

  const units = areas ? "project areas" : "organizations";

  return (
    <>
      <header className="on-dark bg-coffee text-foam">
        <div className={`${W} py-12`}>
          <p className="font-mono text-[10.5px] tracking-[.14em] uppercase text-foam/55 mb-5">
            <Link to="/" className="hover:text-white">Home</Link> /{" "}
            <Link to="/programs" className="hover:text-white">Programs</Link> /{" "}
            <Link to={`/programs/${p.id}`} className="hover:text-white">{p.name}</Link> / <span className="text-foam/80">{areas ? "Project areas" : "Organizations"}</span>
          </p>
          <div className="flex items-center gap-4 flex-wrap">
            <span className="w-14 h-14 rounded-[15px] overflow-hidden shrink-0 bg-white border border-white/25">
              <OrgImg src={avatarOf(p.owner, 96)} name={p.owner} className="w-full h-full object-cover" />
            </span>
            <div className="min-w-0">
              <h1 className="font-display font-extrabold tracking-[-.02em] leading-[1.1] text-[clamp(25px,3.2vw,38px)] text-white">
                <Word>{p.name}</Word> {units}
              </h1>
              <p className="text-foam/75 mt-1.5 text-[14px]">
                {r.ready ? `${fmtCompact(r.rows.length)} ${units}` : "Reading the participation record..."}
              </p>
            </div>
            <div className="ml-auto flex gap-2.5 items-center flex-wrap">
              <Link to={`/programs/${p.id}`} className={btn("outline", "md", "bg-transparent! text-foam! border-white/25! hover:border-white/60!")}>Back to the program</Link>
              <Link to="/organizations/stats" className={btn("outline", "md", "bg-transparent! text-foam! border-white/25! hover:border-white/60!")}>All programs, one list</Link>
              <a href={p.url} target="_blank" rel="noopener" className={btn("primary", "md")}>Official website</a>
            </div>
          </div>
          <p className="text-foam/60 mt-5 max-w-[760px] text-[13.5px] leading-[1.65]">
            {areas
              ? <>Season of KDE groups its projects by the area each one falls under rather than by host organization,
                  {" "}so this page lists those {units} the way the program lists them.</>
              : <>Filter by year, technology and field to find the organizations taking part and what each of them
                  {" "}has had mentored.</>}
          </p>
        </div>
      </header>

      <div className={`${W} pt-8 pb-16`}>
        {r.rows.length > 0 && (<>
        {/* ── filter bar: it sits at the top of the list and stays there. A
            sticky bar used to follow the page down and cover the cards. ── */}
        <div className="bg-card border border-line rounded-[18px] p-4 shadow-soft">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[220px] max-w-[360px]">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dim pointer-events-none">
                <circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" />
              </svg>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${units}`} aria-label={`Search ${units}`}
                className="w-full bg-cream border border-line rounded-xl pl-9 pr-3 py-2.5 text-[13.5px] outline-none transition-all focus:border-accent" />
            </div>
            <Select label="Sector" value={sector} onChange={setSector}
              options={[["", "All sectors"], ...r.sectors.map(([s, n]) => [s, `${s} (${n})`] as [string, string])]} />
            <Select label="Sort" value={sort} onChange={(v) => setSort(v as Sort)}
              options={SORTS.map(([v, t]) => [v, t] as [string, string])} />
            {dirty && (
              <button type="button" onClick={clear} className="font-mono text-[10.5px] uppercase tracking-[.1em] text-dim hover:text-brick transition-colors">
                Clear
              </button>
            )}
          </div>

          {/* ── the stack filter: one dropdown, like the sector beside it.
              A program's record can name several hundred technologies, and a
              chip rail buried most of them under "All stacks". ── */}
          {r.techs.length > 0 && (
            <Select label="Stack" value={tech} onChange={setTech}
              options={[["", `All stacks (${fmtCompact(r.techs.length)})`], ...r.techs.map(([t, n]) => [t, `${t} (${fmtCompact(n)})`] as [string, string])]} />
          )}

          {r.years.length > 1 && (
            <div className="flex items-center gap-1.5 flex-wrap mt-3.5 pt-3.5 border-t border-liness">
              <span className="font-mono text-[9.5px] uppercase tracking-[.11em] text-dim mr-1">Years</span>
              {r.years.map((y) => <YearChip key={y} y={y} on={years.includes(y)} toggle={() => toggleYear(y)} />)}
            </div>
          )}
        </div>

        <p className="font-mono text-[10.5px] uppercase tracking-[.12em] text-dim mt-5 mb-4" aria-live="polite">
          Showing {fmtCompact(Math.min(shown, hits.length))} of {fmtCompact(hits.length)} {units}
          {dirty ? " · filtered" : ` · ${fmtCompact(r.rows.length)} in total`}
        </p>
        </>)}

        {!r.ready && <p className="text-cocoa text-[13.5px]">Loading the participation record...</p>}

        {r.ready && !r.rows.length && (
          <div className="bg-card border border-line rounded-[18px] p-7 shadow-soft max-w-[720px]">
            <h2 className="panel-h text-[17px] mb-2">{p.name} names fellows, not organizations</h2>
            <p className="text-cocoa text-[13.5px] leading-[1.7]">
              This program publishes the people it accepted and the project each of them worked on; it has
              never published a list of participating organizations, so there is nothing here we could show you
              honestly. The organizer's own page, linked at the top, is the source for that - and the
              {" "}<Link to={`/programs/${p.id}`} className="text-accent underline underline-offset-2">program page</Link>{" "}
              carries what we do hold about how it runs.
            </p>
          </div>
        )}

        {r.ready && !!r.rows.length && !hits.length && (
          <div className="bg-card border border-line rounded-[18px] p-7 shadow-soft max-w-[620px]">
            <h2 className="panel-h text-[17px] mb-2">{areas ? "No project area matches those filters" : "No organization matches those filters"}</h2>
            <p className="text-cocoa text-[13.5px] leading-[1.7]">
              {fmtCompact(r.rows.length)} {units} {areas ? "group the projects in" : "took part in"} {p.name}.{" "}
              <button type="button" onClick={clear} className="text-accent font-semibold underline underline-offset-2">Clear the filters</button>
              {" "}to see all of them.
            </p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 max-[1080px]:grid-cols-2 max-[640px]:grid-cols-1">
          {hits.slice(0, shown).map((o) => <OrgCard key={o.key + o.name} o={o} pid={p.id} areas={areas} />)}
        </div>

        {hits.length > shown && (
          <button type="button" onClick={() => setShown((s) => s + PAGE * 2)} className={btn("outline", "md", "mt-6")}>
            Show more {units} · {fmtCompact(hits.length - shown)} left
          </button>
        )}

        {r.ready && r.rows.length > 0 && (
          <p className="text-dim text-[11.5px] leading-[1.65] mt-6 max-w-[860px]">
            {fmtCompact(withLogo)} of these {units} show their own logo - the image from their GitHub account
            where they have one, otherwise the mark their program publishes.
          </p>
        )}

        {/* ── the same organizations, in the other programs' records ── */}
        {overlaps.length > 0 && (
          <section className="mt-10 bg-card border border-line rounded-[18px] p-[22px] shadow-soft">
            <h2 className="panel-h text-[16px]">Organizations this program <Word>shares</Word></h2>
            <p className="text-cocoa text-[12.5px] mt-1.5 mb-4 max-w-[680px] leading-[1.6]">
              Counted by name across the participant records we hold, so a match means the same organization
              appears in both programs' lists.
            </p>
            <div className="flex gap-2.5 flex-wrap">
              {overlaps.map((ov) => (
                <Link key={ov.other} to={`/programs/${ov.other}/organizations`}
                  title={`${ov.examples.slice(0, 4).join(", ")}${ov.examples.length > 4 ? "..." : ""}`}
                  className="group flex items-center gap-2.5 border border-line rounded-full pl-1.5 pr-3.5 py-1.5 bg-cream hover:border-accent/50 hover:bg-peach/60 transition-colors">
                  <span className="w-6 h-6 rounded-full overflow-hidden shrink-0 bg-white border border-line grid place-items-center">
                    <OrgImg src={avatarOf(PROGRAMS.find((x) => x.id === ov.other)?.owner ?? ov.other, 48)} name={ov.label} className="w-full h-full object-cover" />
                  </span>
                  <span className="text-[12.5px] font-semibold text-ink group-hover:text-accent transition-colors">{ov.label}</span>
                  <span className="font-mono text-[11px] font-bold text-accent tabular-nums">{fmtCompact(ov.mine)}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
