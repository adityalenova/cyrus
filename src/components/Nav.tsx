"use client"
/* ══ Nav.tsx — floating pill header + clean circle theme toggle + user menu
   Desktop (lg+) keeps the tightened single row. Phone/tablet get a proper
   hamburger to the RIGHT of the Sign in button that opens a warm slide-in
   sheet with every page and the full Platform section.                ═ */
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "@/lib/router";
import { Logo, Brand, Avatar, btn } from "./ui";
import { TONES } from "./plat";
import { useStore } from "../lib/store";

/* Header order is the site's own priority: what a contributor comes to look at
   first (the programs that fund them), then who runs them, then the work.
   "Home" is not a link - the wordmark at the left of the strip already is one,
   and spending a slot on it pushed the real destinations into an overflow. */
const LINKS: { to: string; label: string; short?: string }[] = [
  { to: "/programs", label: "Programs" },
  { to: "/organizations", label: "Organizations", short: "Orgs" },
  { to: "/projects", label: "Projects" },
  { to: "/issues", label: "Issues" },
  { to: "/skills", label: "Skills" },
  { to: "/sponsors", label: "Sponsors" },
  { to: "/leaderboard", label: "Leaderboard" },
  { to: "/about", label: "About" },
];

/* Platform menu entries: slug, label, blurb, icon path, tone class from the plat kit */
const PLAT: [string, string, string, string, string][] = [
  ["features", "Features", "The whole contributor workflow.", "M12 3 3 8l9 5 9-5-9-5ZM3 16l9 5 9-5M3 12l9 5 9-5", "rust"],
  ["trust", "Trust centre", "Data sources, snapshots, verification.", "M12 3l7 3v5c0 5-3 8.5-7 10-4-1.5-7-5-7-10V6l7-3Z", "leaf"],
  ["how", "How it works", "Three steps from empty tabs to merged PR.", "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l3.5 2", "honey"],
];

/* pill size bases. The row is measured, not guessed: at 1024px the pill strip
   has about 660px to live in once the wordmark, the right-hand controls and
   the pill's own padding are counted, so the pills carry 10px of horizontal
   padding at 12px type and sit 2px apart. Anything looser and the last item
   ("Platform") gets clipped behind the controls. */
const PILL = "px-2.5 py-[7px] rounded-full text-[12px] font-semibold whitespace-nowrap transition-colors cursor-pointer";
const pillCls = (on: boolean) => on ? "bg-coffee text-foam" : "text-cocoa hover:bg-card hover:text-ink";

export default function Nav() {
  const { user, signOut, saved, savedOrgs, setAuthOpen } = useStore();
  const [pop, setPop] = useState(false);
  const [menu, setMenu] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const loc = useLocation();

  useEffect(() => { setPop(false); setMenu(false); }, [loc.pathname]);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (accountRef.current?.contains(e.target as Node)) return;
      setPop(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);
  /* Sheet open: lock page scroll, move focus inside, keep Tab inside, and hand
     focus back to the button that opened it. A sheet that only *looks* modal
     is not one - a keyboard visitor who Tabs past the last link walks straight
     into the page behind the overlay and starts activating things they cannot
     see. The panel is labelled and now traps, so aria-modal is the truth. */
  const sheetRef = useRef<HTMLElement | null>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!menu) return;
    document.body.style.overflow = "hidden";
    const inside = () => Array.from(
      sheetRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? []
    ).filter((el) => el.offsetParent !== null);
    inside()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setMenu(false); openerRef.current?.focus(); return; }
      if (e.key !== "Tab") return;
      const els = inside();
      if (!els.length) return;
      const first = els[0], last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", key);
    };
  }, [menu]);

  const active = (to: string) =>
    to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(to) || (to === "/skills" && loc.pathname.startsWith("/repo/"));

  return (
    <header>
      <nav className="sticky top-0 z-[60] bg-paper px-4 pt-3 max-[700px]:px-2.5">
        <div className="max-w-[1340px] mx-auto bg-paper/92 backdrop-blur-[16px] saturate-[1.35] border border-liness rounded-full shadow-soft">
          <div className="flex items-center gap-4 h-[62px] pl-4 pr-4 max-[1179px]:gap-3 max-[1023px]:h-[54px] max-[700px]:gap-2.5 max-[700px]:pl-2.5 max-[700px]:pr-2.5">
            {/* min-h keeps the mark's own link a 36px thumb target now that the
                logo itself is 28px; the a11y suite measures this strip. */}
            <Link to="/" className="flex items-center gap-3 shrink-0 min-h-[36px] max-[700px]:gap-2.5"><Logo size={28} /><Brand /></Link>
            {/* desktop strip: single tightened row, lg+ only. Below 1280 the
                one label that will not spare the pixels keeps its short form;
                from xl the full name comes back. */}
            <div className="hidden lg:flex items-center gap-0.5 min-w-0">
              {LINKS.map((l) => (
                <NavLink key={l.to} to={l.to}
                  className={`${PILL} ${pillCls(active(l.to))}`}>
                  {l.short ? (
                    <><span className="hidden xl:inline">{l.label}</span><span className="xl:hidden">{l.short}</span></>
                  ) : l.label}
                </NavLink>
              ))}
              <PlatformMenu />
            </div>

            <div className="ml-auto flex items-center gap-3.5 max-[1179px]:gap-2.5 max-[700px]:gap-2">
              <ThemeToggle />
              <span className="w-px h-6 bg-line shrink-0 max-[1179px]:hidden" aria-hidden />
              {user ? (
                <div className="relative" ref={accountRef}>
                  <button className="!p-0 border-0" onClick={() => setPop((open) => !open)} aria-label="Account" aria-expanded={pop}>
                    <Avatar name={user.name} size={34} src={user.picture} />
                  </button>
                  {pop && (
                    <div className="absolute right-0 top-[46px] w-[232px] bg-card border border-line rounded-[16px] shadow-lift p-1.5 z-[70]">
                      <div className="px-3 py-2.5 border-b border-liness mb-1.5">
                        <b className="block text-[14px]">{user.name}</b>
                        <span className="text-[12px] text-cocoa block truncate">{user.email || (user.provider === "guest" ? "Guest session" : "Signed in with " + user.provider)}</span>
                      </div>
                      <Link to="/dashboard" className="flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-[13.5px] font-medium text-cocoa hover:bg-peach hover:text-rust"><MenuIcon d="M4 18v-6M10 18V7M16 18v-4M22 18H2" /> Dashboard</Link>
                      <Link to="/dashboard/issues" className="flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-[13.5px] font-semibold text-rust hover:bg-peach"><MenuIcon d="M12 8.5v4.5M12 16.6v.1M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" /> My Issues</Link>
                      <Link to="/dashboard/repos" className="flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-[13.5px] font-medium text-cocoa hover:bg-peach hover:text-rust"><MenuIcon d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.9z" /> Followed ({saved.length + savedOrgs.length})</Link>
                      <button onClick={signOut} className="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-[13.5px] font-medium text-cocoa hover:bg-peach hover:text-rust"><MenuIcon d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 8l-4 4 4 4M6 12h10" /> Sign out</button>
                    </div>
                  )}
                </div>
              ) : (
                <SignInButton className="max-[700px]:!px-3.5 max-[700px]:!py-2 max-[700px]:!text-[12.5px]" />
              )}
              {/* hamburger: phone + tablet only, always the rightmost control */}
              <button ref={openerRef} onClick={(e) => { e.stopPropagation(); setMenu(!menu); }}
                aria-label={menu ? "Close menu" : "Open menu"} aria-expanded={menu}
                className="lg:hidden relative w-[38px] h-[38px] rounded-full grid place-items-center border border-line bg-card/60 text-ink transition-colors duration-200 hover:bg-peach shrink-0 cursor-pointer">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.1" strokeLinecap="round" aria-hidden>
                  <line x1="4" y1="7" x2="20" y2="7" style={{
                    transformBox: "fill-box", transformOrigin: "center",
                    transform: menu ? "translateY(5px) rotate(45deg)" : "none", transition: "transform .28s cubic-bezier(.55,1.2,.45,1)"
                  }} />
                  <line x1="4" y1="12" x2="20" y2="12" style={{
                    transformBox: "fill-box", transformOrigin: "center",
                    opacity: menu ? 0 : 1, transform: menu ? "scaleX(.4)" : "none", transition: "all .22s ease"
                  }} />
                  <line x1="4" y1="17" x2="20" y2="17" style={{
                    transformBox: "fill-box", transformOrigin: "center",
                    transform: menu ? "translateY(-5px) rotate(-45deg)" : "none", transition: "transform .28s cubic-bezier(.55,1.2,.45,1)"
                  }} />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {menu && (
          <>
            <div onClick={() => setMenu(false)} aria-hidden
              className="lg:hidden fixed inset-0 z-[80] bg-ink/45 backdrop-blur-[3px]"
              style={{ animation: "fadeIn .25s ease both" }} />
            <aside ref={sheetRef} role="dialog" aria-modal="true" aria-label="Site menu" className="lg:hidden fixed top-0 right-0 bottom-0 z-[85] w-[min(86vw,340px)]
            bg-paper border-l border-line rounded-l-[28px] shadow-lift flex flex-col
            max-[1023px]:rounded-none max-[1023px]:border-l-0"
              style={{ animation: "sheetIn .34s cubic-bezier(.32,.9,.35,1) both" }}>
              <div className="flex items-center justify-between px-5 h-[62px] shrink-0">
                <Link to="/" className="flex items-center gap-2.5 min-h-[36px]"><Logo size={28} /><Brand /></Link>
                <button onClick={() => setMenu(false)} aria-label="Close menu"
                  className="w-[34px] h-[34px] rounded-full grid place-items-center border border-line text-cocoa hover:bg-card hover:text-ink transition-colors cursor-pointer">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"><path d="M5 5l14 14M19 5 5 19" /></svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-3.5 pb-4">
                <p className="px-2.5 pt-1 pb-2 font-mono text-[10px] font-semibold tracking-[.14em] text-dim">BROWSE</p>
                <div className="grid gap-0.5">
                  {LINKS.map((l) => (
                    <NavLink key={l.to} to={l.to} end={l.to === "/"}
                      className={`px-3.5 py-2.5 rounded-[14px] text-[14.5px] font-semibold transition-colors ${pillCls(active(l.to))}`}>
                      {l.label}
                    </NavLink>
                  ))}
                </div>
                <p className="px-2.5 pt-4 pb-2 font-mono text-[10px] font-semibold tracking-[.14em] text-dim">PLATFORM</p>
                <div className="grid gap-0.5">
                  {PLAT.map(([slug, label, desc, d, tone]) => (
                    <Link key={slug} to={`/platform/${slug}`}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-[14px] hover:bg-peach transition-colors">
                      <span className={`w-[34px] h-[34px] rounded-[10px] border grid place-items-center shrink-0 ${TONES[tone]}`}><MenuIcon d={d} /></span>
                      <span className="min-w-0">
                        <b className="block text-[13.5px] font-bold text-ink leading-tight">{label}</b>
                        <span className="block text-[11px] text-dim mt-0.5 truncate">{desc}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
              <div className="shrink-0 px-5 py-4 border-t border-liness">
                {user ? (
                  <div className="flex items-center gap-3">
                    <Avatar name={user.name} size={36} src={user.picture} />
                    <span className="min-w-0 flex-1">
                      <b className="block text-[13.5px] truncate">{user.name}</b>
                      <span className="block text-[11.5px] text-dim truncate">{user.email || "Signed in"}</span>
                    </span>
                    <Link to="/dashboard" className={btn("dark", "sm")}>Dashboard</Link>
                  </div>
                ) : (
                  <button className={btn("dark", "lg", "!w-full")} onClick={() => { setMenu(false); setAuthOpen(true); }}>Sign in</button>
                )}
              </div>
            </aside>
          </>
        )}
      </nav>
    </header>

  );
}

export function SignInButton({ label = "Sign in", size = "md" as const, variant = "dark" as const, onClick, className = "" }: { label?: string; size?: "sm" | "md" | "lg"; variant?: "dark" | "primary" | "outline"; onClick?: () => void; className?: string }) {
  const { setAuthOpen } = useStore();
  return <button className={btn(variant, size, className)} onClick={onClick ?? (() => setAuthOpen(true))}>{label}</button>;
}

/* ── Platform dropdown (desktop row): caret pill + card panel ── */
function PlatformMenu() {
  const [pop, setPop] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const loc = useLocation();
  useEffect(() => setPop(false), [loc.pathname]);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (boxRef.current?.contains(e.target as Node)) return;
      setPop(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);
  const on = loc.pathname.startsWith("/platform");
  return (
    <div className="relative" ref={boxRef}>
      <button onClick={() => setPop((open) => !open)} aria-expanded={pop}
        className={`${PILL} flex items-center gap-1.5 ${pillCls(on)}`}>
        Platform
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden
          className={`transition-transform duration-200 ${pop ? "rotate-180" : ""}`}><path d="m5 9 7 7 7-7" /></svg>
      </button>
      {pop && (
        <div className="absolute left-0 top-[42px] w-[340px] bg-card border border-line rounded-[18px] shadow-lift p-2 z-[70]">
          {PLAT.map(([slug, label, desc, d, tone]) => (
            <Link key={slug} to={`/platform/${slug}`}
              onClick={() => setPop(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-[12px] hover:bg-peach transition-colors">
              <span className={`w-[36px] h-[36px] rounded-[11px] border grid place-items-center shrink-0 ${TONES[tone]}`}><MenuIcon d={d} /></span>
              <span className="min-w-0">
                <b className="block text-[13.5px] font-bold text-ink leading-tight">{label}</b>
                <span className="block text-[11.5px] text-dim mt-0.5 truncate">{desc}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export const SearchIcon = ({ size = 14 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
  </svg>
);

const MenuIcon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
    <path d={d} />
  </svg>
);

/* ── light / dark switch: warm track, white circle knob, flat circle sun ── */
const RAYS = [0, 45, 90, 135, 180, 225, 270, 315];
const SUN = (color: string) => (
  <g stroke={color} strokeWidth="1.8" strokeLinecap="round">
    <circle cx="12" cy="12" r="4.2" fill={color} stroke="none" />
    {RAYS.map((a) => (
      <line key={a} x1="12" y1="3" x2="12" y2="5" transform={`rotate(${a} 12 12)`} />
    ))}
  </g>
);
const MOON = (color: string) => (
  <path d="M20.4 14.2A8.6 8.6 0 0 1 9.8 3.6a.6.6 0 0 0-.8-.7 9.2 9.2 0 1 0 12.1 12.1.6.6 0 0 0-.7-.8Z" fill={color} />
);

export function ThemeToggle() {
  const { theme, toggleTheme } = useStore();
  const dark = theme === "dark";
  return (
    <button role="switch" aria-checked={dark} aria-label="Toggle dark theme" onClick={toggleTheme}
      title={dark ? "Switch to light theme" : "Switch to dark theme"}
      className="group relative w-[70px] h-[36px] rounded-full cursor-pointer shrink-0 border transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      style={{
        borderColor: dark ? "#2a2d31" : "#d8dde0",
        background: dark ? "#1d2023" : "#e9ebee",
        boxShadow: dark ? "inset 0 1px 4px rgba(0,0,0,.5)" : "inset 0 1px 3px rgba(133, 116, 97,.18)",
      }}>
      {/* idle icon resting on the track (opposite side from the knob) */}
      <svg aria-hidden width="17" height="17" viewBox="0 0 24 24"
        className="absolute top-[9.5px] transition-opacity duration-300" style={{ right: "9px", opacity: dark ? 0 : 1 }}>
        {MOON("#8b9298")}
      </svg>
      <svg aria-hidden width="17" height="17" viewBox="0 0 24 24"
        className="absolute top-[9.5px] transition-opacity duration-300" style={{ left: "9px", opacity: dark ? 1 : 0 }}>
        {SUN("#fbbf24")}
      </svg>
      {/* knob: a clean white circle carrying the active glyph */}
      <span aria-hidden className="absolute top-[5px] left-[5px] w-[26px] h-[26px] rounded-full bg-white grid place-items-center transition-transform duration-400 ease-[cubic-bezier(.55,1.6,.45,1)] group-hover:scale-[1.06]"
        style={{ boxShadow: "0 2px 6px rgba(58, 40, 22,.22), 0 0 0 1px rgba(58, 40, 22,.04)", transform: dark ? "translateX(34px)" : "none" }}>
        <svg width="19" height="19" viewBox="0 0 24 24" style={{ opacity: dark ? 0 : 1, position: "absolute", transition: "opacity .3s" }}>
          <circle cx="12" cy="12" r="4.8" fill="#fbbf24" />
          <g stroke="#fbbf24" strokeWidth="1.7" strokeLinecap="round">
            {RAYS.map((a) => (
              <line key={a} x1="12" y1="2.6" x2="12" y2="4.4" transform={`rotate(${a} 12 12)`} />
            ))}
          </g>
        </svg>
        <svg width="14" height="14" viewBox="0 0 24 24" style={{ opacity: dark ? 1 : 0, position: "absolute", transition: "opacity .3s" }}>
          {MOON("#2a2d31")}
        </svg>
      </span>
    </button>
  );
}
