"use client"
/* ══ shell.tsx — the board's own application chrome ═════════════
   A full-width app: top utility bar, a collapsible grouped sidebar with
   live counts and a pinned account card, then the page column. The
   marketing header is swapped for this one on /dashboard routes by
   Shell.tsx, so the board reads as a product and not as a page.   ══ */
import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Link } from "@/lib/router";
import { Avatar, btn, Logo } from "../../components/ui";
import { ThemeToggle } from "../../components/Nav";
import { useStored } from "../util";
import { DP, ISSUE_STAGES, STAGE_LABEL, W } from "./shared";
import type { Dash } from "./useDash";

const SW = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export const Ic = ({ d, size = 17, filled }: { d: string; size?: number; filled?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    {filled ? <path d={d} fill="currentColor" stroke="none" /> : <path d={d} {...SW} />}
  </svg>
);

export function Toggle({ on, flip }: { on: boolean; flip: () => void }) {
  return (
    <button role="switch" aria-checked={on} onClick={flip}
      className={`relative w-[38px] h-[22px] rounded-full shrink-0 transition-colors cursor-pointer ${on ? "bg-accent" : "bg-roast"}`}>
      <span className={`absolute top-[3px] w-4 h-4 rounded-full transition-all duration-200 ease-silk ${on ? "left-[19px] bg-white" : "left-[3px] bg-steam"}`} />
    </button>
  );
}

export const Card = ({ children, className = "", style }: { children: ReactNode; className?: string; style?: CSSProperties }) => (
  <section className={`bg-card border border-line rounded-[18px] p-5 shadow-soft ${className}`} style={style}>{children}</section>
);

/* dotted stat row: the reference card footer. Label left, value right,
   a hairline dotted rule carrying between them. */
export const StatRow = ({ items }: { items: [string, ReactNode][] }) => (
  <div className="flex items-center gap-1.5 flex-wrap pt-3 mt-3 border-t border-dashed border-line">
    {items.map(([l, v], i) => (
      <span key={l} className={`flex items-baseline gap-1.5 font-mono text-[11px] ${i ? "before:content-['·'] before:text-rule before:mr-1.5" : ""}`}>
        <span className="text-dim">{l}</span>
        <b className="text-ink font-semibold">{v}</b>
      </span>
    ))}
  </div>
);

/* ── sign-in gate for every board route ─────────────────────────── */
export function DashGate({ dash, children }: { dash: Dash; children: ReactNode }) {
  /* the board is read out of this browser a frame after the first paint, so
     wait for it instead of showing the sign-in door to someone who is
     already through it */
  if (!dash.boardReady)
    return (
      <div className="min-h-[60vh] grid place-items-center" aria-busy="true">
        <span className="font-mono text-[10.5px] uppercase tracking-[.16em] text-dim">Loading your board</span>
      </div>
    );
  if (dash.user) return <>{children}</>;

  /* The board itself needs no account - it lives in this browser. So the
     signed-out screen is not a wall: it shows what this browser already
     holds, read from the same live state the board renders, and asks for a
     sign-in only to sync it. Every number here is the visitor's own. */
  const stages = ISSUE_STAGES.map((s) => [s, dash.byStage(s).length] as const);
  const holdings: [string, number][] = [
    ["issues on your ledger", dash.issues.length],
    ["repositories followed", dash.saved.length],
    ["organizations followed", dash.savedOrgs.length],
  ];
  const anything = holdings.some(([, n]) => n > 0);
  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

  return (
    <div className={`${W} min-h-[calc(100vh-64px)] grid items-center py-14`}>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] gap-10 lg:gap-16 items-center">
        {/* ── the ask ── */}
        <div>
          <p className="eyebrow mb-4">Your board</p>
          <h1 className="font-display font-extrabold text-[clamp(30px,4.4vw,50px)] leading-[1.06] tracking-[-.03em] mb-4 max-w-[620px]">
            <span className="word-accent">Sign in</span> to sync the board.
          </h1>
          <p className="text-cocoa max-w-[520px] text-[15.5px] leading-[1.65] mb-8">
            Everything on the board is held in this browser and works without an account.
            Signing in only puts the same board on any device you open next.
          </p>
          <div className="flex gap-3 flex-wrap">
            <button className={btn("primary", "lg")} onClick={dash.googleIn} disabled={dash.gBusy}>
              {dash.gBusy ? "Opening Google..." : "Continue with Google"}
            </button>
            <button className={btn("outline", "lg")} onClick={() => dash.setAuthOpen(true)}>Use email instead</button>
          </div>
          <p className="mt-6 font-mono text-[10.5px] uppercase tracking-[.14em] text-dim">
            Or keep browsing - <Link to="/issues" className="text-cocoa hover:text-accent transition-colors normal-case tracking-[.02em] font-sans font-semibold">find an issue to track</Link>
          </p>
        </div>

        {/* ── what this browser already holds ── */}
        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-line bg-sand flex items-center gap-2.5">
            <span className="w-[7px] h-[7px] rounded-full bg-accent shrink-0" aria-hidden />
            <b className="font-display font-bold text-[14px] tracking-[-.01em]">In this browser</b>
            <span className="ml-auto font-mono text-[9.5px] uppercase tracking-[.14em] text-dim">no account needed</span>
          </div>

          <div className="p-5 grid gap-1">
            {holdings.map(([label, n], i) => (
              <div key={label} className={`flex items-baseline gap-3 py-2.5 ${i ? "border-t border-dashed border-line" : ""}`}>
                <span className="text-[13.5px] text-cocoa">{label}</span>
                <span className="flex-1 border-t border-dotted border-line self-center min-w-[24px]" aria-hidden />
                <b className="font-mono text-[15px] font-bold text-ink">{n || "—"}</b>
              </div>
            ))}
          </div>

          <div className="px-5 pb-5">
            <p className="font-mono text-[9.5px] uppercase tracking-[.16em] text-dim mb-2.5">
              {anything ? "Ledger by stage" : "The board has four stages"}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {stages.map(([s, n]) => (
                <div key={s} className="flex items-center gap-2 rounded-[11px] border border-line bg-paper px-3 py-2.5">
                  <span className={`w-[6px] h-[6px] rounded-full shrink-0 ${n ? "bg-accent" : "bg-rule"}`} aria-hidden />
                  <span className="text-[12.5px] font-semibold text-cocoa truncate">{STAGE_LABEL[s]}</span>
                  <b className="ml-auto font-mono text-[12px] font-bold text-ink">{n || "—"}</b>
                </div>
              ))}
            </div>
          </div>

          <p className="px-5 py-3.5 border-t border-line bg-sand text-[12px] leading-[1.55] text-cocoa">
            {anything
              ? <>You have {dash.issues.length} {plural(dash.issues.length, "issue", "issues")} and {dash.saved.length} {plural(dash.saved.length, "repository", "repositories")}
                  {" "}on this device. Sign in and they move to your account; nothing is re-entered.</>
              : <>Nothing tracked here yet. Save an issue or follow a repository and it appears on this card - then sign in whenever you want it on another device.</>}
          </p>
        </Card>
      </div>
    </div>
  );
}

/* ── sidebar model: three groups, only routes that exist ────────── */
function rail(d: Dash): { label: string; items: { icon: string; text: string; to: string; count?: string }[] }[] {
  return [
    {
      label: "Board",
      items: [
        { icon: DP.grid, text: "Overview", to: "/dashboard" },
        { icon: DP.issue, text: "My Issues", to: "/dashboard/issues", count: String(d.issues.length) },
        { icon: DP.repo, text: "My Repositories", to: "/dashboard/repos", count: String(d.saved.length) },
      ],
    },
    {
      label: "Plan",
      items: [
        { icon: DP.calendar, text: "Season calendar", to: "/dashboard/calendar" },
        { icon: DP.star, text: "Demand radar", to: "/dashboard/demand" },
      ],
    },
    {
      label: "Tools",
      items: [
        { icon: DP.spark, text: "Co-pilot", to: "/dashboard/matcher" },
        { icon: DP.pulse, text: "Repo analyser", to: "/dashboard/analyser" },
        { icon: DP.file, text: "Draft studio", to: "/dashboard/drafts" },
        { icon: DP.target, text: "Mentor finder", to: "/dashboard/mentors" },
        { icon: DP.layers, text: "Compare orgs", to: "/dashboard/compare" },
        { icon: DP.code, text: "Git initializer", to: "/dashboard/gitstart" },
      ],
    },
    {
      label: "Discover",
      items: [
        { icon: DP.search, text: "Issue finder", to: "/issues" },
        { icon: DP.building, text: "Organizations", to: "/organizations", count: String(d.savedOrgs.length) },
        { icon: DP.flag, text: "Leaderboard", to: "/leaderboard" },
        { icon: DP.layers, text: "Project archive", to: "/projects" },
        { icon: DP.star, text: "Skill catalog", to: "/skills" },
        { icon: DP.spark, text: "Sponsors", to: "/sponsors" },
      ],
    },
    {
      label: "Account",
      items: [{ icon: DP.settings, text: "Settings", to: "/dashboard/settings" }],
    },
  ];
}

export function DashShell({ dash, active, children }: { dash: Dash; active: string; children: ReactNode }) {
  const user = dash.user!;
  const [narrow, setNarrow] = useStored<boolean>("cyrus.nav.collapsed", false);
  const [menu, setMenu] = useState(false);
  const groups = rail(dash);
  const flat = groups.flatMap((g) => g.items.map((it) => ({ ...it, group: g.label })));

  return (
    <div className="bg-paper">
      {/* ── app top bar ── */}
      <header className="sticky top-0 z-50 bg-paper/92 backdrop-blur-[14px] border-b border-line">
        <div className="flex items-center gap-3 h-[58px] px-4 md:px-5">
          <button onClick={() => setMenu(true)} aria-label="Open board menu"
            className="lg:hidden w-[34px] h-[34px] rounded-[10px] grid place-items-center border border-line text-cocoa hover:text-ink hover:border-accent transition-colors cursor-pointer shrink-0">
            <Ic d={DP.collapse} size={16} />
          </button>
          <Link to="/dashboard" className="flex items-center gap-2.5 shrink-0 min-w-0">
            <Logo size={34} />
            <span className="font-display font-extrabold text-[17px] tracking-[-.02em]">cyrus<span className="text-accent">.ai</span></span>
          </Link>
          <span className="hidden md:inline-flex items-center gap-1.5 font-mono text-[9.5px] font-semibold uppercase tracking-[.14em] text-dim border border-line rounded-full px-2.5 py-1">
            <span className="w-[5px] h-[5px] rounded-full bg-accent shrink-0" aria-hidden />Board
          </span>

          <div className="ml-auto flex items-center gap-2.5">
            <button onClick={() => dash.setPaletteOpen(true)}
              className="hidden md:flex items-center gap-2 w-[220px] h-[34px] px-3 rounded-[10px] border border-line bg-card text-dim text-[13px] hover:border-accent/60 hover:text-cocoa transition-colors cursor-pointer">
              <Ic d={DP.search} size={14} />
              <span className="truncate">Search repos and orgs</span>
              <kbd className="ml-auto font-mono text-[9.5px] border border-line rounded px-1.5 py-px bg-paper">&#8984;K</kbd>
            </button>
            <ThemeToggle />
            <span className="w-px h-6 bg-line hidden lg:block" aria-hidden />
            <Link to="/" className="hidden lg:inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-cocoa hover:text-ink transition-colors">
              <Ic d={DP.external} size={13} /> Site
            </Link>
            <Link to="/dashboard/settings" className={`w-[34px] h-[34px] rounded-full grid place-items-center overflow-hidden border transition-colors ${active === "/dashboard/settings" ? "border-accent" : "border-line hover:border-accent/60"}`} aria-label="Settings">
              <Avatar name={user.name} size={34} src={user.picture} />
            </Link>
          </div>
        </div>
      </header>

      <div className="flex items-start">
        {/* ── sidebar (desktop) ── */}
        <aside className={`hidden lg:flex flex-col sticky top-[58px] h-[calc(100vh-58px)] shrink-0 border-r border-line bg-sand transition-[width] duration-200 ease-silk ${narrow ? "w-[74px]" : "w-[248px]"} max-h-[calc(100vh-58px)]`}>
          <nav className="flex-1 overflow-y-auto panel-scroll px-3 py-4" aria-label="Board sections">
            {groups.map((g, gi) => (
              <div key={g.label} className={gi ? "mt-5" : ""}>
                <div className={`flex items-center mb-1.5 ${narrow ? "justify-center" : "px-2.5"}`}>
                  {narrow
                    ? <span className="w-6 h-px bg-line" aria-hidden />
                    : <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[.16em] text-dim">{g.label}</span>}
                </div>
                <div className="grid gap-[3px]">
                  {g.items.map((it) => {
                    const on = active === it.to;
                    return (
                      <Link key={it.to} to={it.to} title={narrow ? it.text : undefined}
                        className={`group relative flex items-center gap-3 rounded-[10px] text-[13.5px] font-semibold transition-colors ${narrow ? "justify-center px-0 py-2.5" : "px-2.5 py-2.5"} ${on ? "bg-clay text-ink" : "text-cocoa hover:bg-clay/60 hover:text-ink"}`}>
                        <span className={`shrink-0 w-[17px] text-center ${on ? "text-accent" : ""}`}><Ic d={it.icon} size={16} /></span>
                        {!narrow && <span className="truncate">{it.text}</span>}
                        {!narrow && it.count && it.count !== "0" && (
                          <span className={`ml-auto font-mono text-[10.5px] font-bold ${on ? "text-accent" : "text-dim"}`}>{it.count}</span>
                        )}
                        {on && <span className="absolute right-0 top-1/2 -translate-y-1/2 h-[18px] w-[3px] rounded-l-full bg-accent" aria-hidden />}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="border-t border-line p-3">
            {narrow ? (
              <button onClick={() => setNarrow(false)} aria-label="Expand sidebar"
                className="w-full grid place-items-center py-2.5 rounded-[10px] text-dim hover:text-ink hover:bg-clay/60 transition-colors cursor-pointer">
                <Ic d={DP.expand} size={16} />
              </button>
            ) : (
              <div className="flex items-center gap-2.5 p-2 rounded-[12px] bg-card border border-line">
                <Avatar name={user.name} size={32} src={user.picture} />
                <span className="min-w-0 flex-1">
                  <b className="block text-[12.5px] font-semibold truncate">{user.name}</b>
                  <span className="block text-[11px] text-dim truncate">{user.email || (user.provider === "guest" ? "Guest session" : user.provider)}</span>
                </span>
                <button onClick={() => setNarrow(true)} aria-label="Collapse sidebar"
                  className="w-[26px] h-[26px] grid place-items-center rounded-[8px] text-dim hover:text-ink hover:bg-clay transition-colors cursor-pointer shrink-0">
                  <Ic d={DP.collapse} size={14} />
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* ── sidebar (phone / tablet drawer) ── */}
        {menu && (
          <>
            <div onClick={() => setMenu(false)} aria-hidden className="lg:hidden fixed inset-0 z-[70] bg-black/55 backdrop-blur-[3px]" style={{ animation: "fadeIn .2s ease both" }} />
            <aside role="dialog" aria-label="Board menu" className="lg:hidden fixed top-0 left-0 bottom-0 z-[75] w-[min(84vw,300px)] bg-sand border-r border-line flex flex-col" style={{ animation: "sheetIn .3s cubic-bezier(.32,.9,.35,1) both" }}>
              <div className="flex items-center gap-2.5 h-[58px] px-4 border-b border-line shrink-0">
                <Logo size={32} />
                <b className="font-display font-extrabold text-[16px] tracking-[-.02em]">cyrus<span className="text-accent">.ai</span></b>
                <button onClick={() => setMenu(false)} aria-label="Close menu" className="ml-auto w-[32px] h-[32px] grid place-items-center rounded-[9px] border border-line text-cocoa hover:text-ink cursor-pointer">
                  <Ic d={DP.x} size={14} />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto panel-scroll px-3 py-4" aria-label="Board sections">
                {groups.map((g, gi) => (
                  <div key={g.label} className={gi ? "mt-5" : ""}>
                    <p className="px-2.5 mb-1.5 font-mono text-[9.5px] font-semibold uppercase tracking-[.16em] text-dim">{g.label}</p>
                    <div className="grid gap-[3px]">
                      {g.items.map((it) => (
                        <Link key={it.to} to={it.to} onClick={() => setMenu(false)}
                          className={`relative flex items-center gap-3 px-2.5 py-2.5 rounded-[10px] text-[13.5px] font-semibold ${active === it.to ? "bg-clay text-ink" : "text-cocoa"}`}>
                          <span className="w-[17px] text-center"><Ic d={it.icon} size={16} /></span>
                          {it.text}
                          {it.count && it.count !== "0" && <span className="ml-auto font-mono text-[10.5px] text-dim">{it.count}</span>}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </nav>
              <div className="border-t border-line p-3 grid gap-2">
                <Link to="/" onClick={() => setMenu(false)} className="flex items-center gap-3 px-2.5 py-2.5 rounded-[10px] text-[13.5px] font-semibold text-cocoa hover:bg-clay/60"><Ic d={DP.external} size={16} /> Back to the site</Link>
                <button onClick={() => { setMenu(false); dash.signOut(); }} className="flex items-center gap-3 px-2.5 py-2.5 rounded-[10px] text-[13.5px] font-semibold text-cocoa hover:bg-clay/60 cursor-pointer"><Ic d={DP.logout} size={16} /> Sign out</button>
              </div>
            </aside>
          </>
        )}

        {/* ── page column ── */}
        <div className="flex-1 min-w-0">
          {/* phone chip rail keeps the board reachable without the drawer */}
          <nav className="lg:hidden flex gap-2 overflow-x-auto no-scrollbar px-4 py-3 border-b border-line bg-sand" aria-label="Board sections">
            {flat.map((it) => (
              <Link key={it.to} to={it.to}
                className={`shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full border text-[12.5px] font-semibold transition-colors ${active === it.to ? "bg-accent border-accent text-accentfg" : "border-line bg-card text-cocoa"}`}>
                <Ic d={it.icon} size={13} />{it.text}{it.count && it.count !== "0" && <span className="font-mono text-[10px] opacity-80">{it.count}</span>}
              </Link>
            ))}
          </nav>
          <main className="mx-auto max-w-[1160px] px-4 md:px-7 py-6 md:py-9 grid gap-6 md:gap-7 [&>*]:min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}

/* page header: title, one short line, and any actions the page owns */
export function DashHead({ title, sub, action, tag }: { title: string; sub: string; action?: ReactNode; tag?: string }) {
  return (
    <div className="flex items-end gap-4 flex-wrap">
      <div className="min-w-0">
        {tag && <p className="eyebrow mb-2">{tag}</p>}
        <h1 className="font-display font-extrabold tracking-[-.025em] text-[clamp(24px,3vw,34px)]">{title}</h1>
        <p className="text-cocoa text-[14px] leading-[1.6] mt-1.5 max-w-[640px]">{sub}</p>
      </div>
      {action && <div className="ml-auto flex gap-2.5 flex-wrap shrink-0">{action}</div>}
    </div>
  );
}
