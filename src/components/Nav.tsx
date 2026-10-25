"use client"

import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "@/lib/router";
import { Logo, Brand, Avatar, btn } from "./ui";
import { TONES } from "./plat";
import { useStore } from "../lib/store";

const PRIMARY = [
  { to: "/", label: "Home" },
  { to: "/organizations", label: "Organizations" },
  { to: "/issues", label: "Issues" },
  { to: "/leaderboard", label: "Leaderboard" },
  { to: "/projects", label: "Projects" },
];

const SECONDARY = [
  { to: "/programs", label: "Programs" },
  { to: "/skills", label: "Skills" },
  { to: "/sponsors", label: "Sponsors" },
  { to: "/about", label: "About us" },
];

/* Platform menu entries: slug, label, blurb, icon path, tone class from the plat kit */
const PLAT: [string, string, string, string, string][] = [
  ["features", "Features", "The whole contributor workflow.", "M12 3 3 8l9 5 9-5-9-5ZM3 16l9 5 9-5M3 12l9 5 9-5", "rust"],
  ["trust", "Trust centre", "Data sources, snapshots, verification.", "M12 3l7 3v5c0 5-3 8.5-7 10-4-1.5-7-5-7-10V6l7-3Z", "leaf"],
  ["how", "How it works", "Three steps from empty tabs to merged PR.", "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l3.5 2", "honey"],
];

/* pill size bases – tightened for clean single-row desktop layout */
const PILL =
  "px-2.5 py-[6px] rounded-full text-[12.5px] font-semibold whitespace-nowrap transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const pillCls = (on: boolean) =>
  on
    ? "bg-coffee text-foam shadow-sm"
    : "text-cocoa hover:bg-card hover:text-ink";

export default function Nav() {
  const { user, signOut, saved, savedOrgs, setAuthOpen } = useStore();
  const [pop, setPop] = useState(false);
  const [menu, setMenu] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const loc = useLocation();

  useEffect(() => {
    setPop(false);
    setMenu(false);
  }, [loc.pathname]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (accountRef.current?.contains(e.target as Node)) return;
      setPop(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  /* sheet open: lock page scroll, Escape closes */
  useEffect(() => {
    if (!menu) return;
    document.body.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(false);
    };
    document.addEventListener("keydown", esc);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", esc);
    };
  }, [menu]);

  const active = (to: string) =>
    to === "/"
      ? loc.pathname === "/"
      : loc.pathname.startsWith(to) ||
        (to === "/skills" && loc.pathname.startsWith("/repo/"));

  return (
    <header>
      <nav className="sticky top-0 z-[60] bg-paper px-4 pt-3 max-[700px]:px-2.5">
        <div className="max-w-[1340px] mx-auto bg-paper/92 backdrop-blur-[16px] saturate-[1.35] border border-liness rounded-full shadow-soft">
          <div className="flex items-center gap-3 h-[58px] pl-3.5 pr-3.5 max-[1023px]:h-[54px] max-[700px]:gap-2 max-[700px]:pl-2.5 max-[700px]:pr-2.5">
            <Link
              to="/"
              className="flex items-center gap-2 shrink-0 max-[700px]:gap-1.5"
            >
              <Logo size={32} />
              <Brand />
            </Link>

            {/* desktop strip: primary links + Platform + More */}
            <div className="hidden lg:flex items-center gap-0.5 min-w-0">
              {PRIMARY.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.to === "/"}
                  className={`${PILL} ${pillCls(active(l.to))}`}
                >
                  {l.label}
                </NavLink>
              ))}
              <PlatformMenu active={active} />
              <MoreMenu active={active} />
            </div>

            <div className="ml-auto flex items-center gap-2.5 max-[700px]:gap-2">
              <ThemeToggle />
              <span
                className="w-px h-5 bg-line shrink-0 max-[700px]:hidden"
                aria-hidden
              />
              {user ? (
                <div className="relative" ref={accountRef}>
                  <button
                    className="!p-0 border-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent rounded-full"
                    onClick={() => setPop((open) => !open)}
                    aria-label="Account"
                    aria-expanded={pop}
                  >
                    <Avatar name={user.name} size={32} src={user.picture} />
                  </button>
                  {pop && (
                    <div className="absolute right-0 top-[42px] w-[232px] bg-card border border-line rounded-[16px] shadow-lift p-1.5 z-[70]">
                      <div className="px-3 py-2.5 border-b border-liness mb-1.5">
                        <b className="block text-[14px]">{user.name}</b>
                        <span className="text-[12px] text-cocoa block truncate">
                          {user.email ||
                            (user.provider === "guest"
                              ? "Guest session"
                              : "Signed in with " + user.provider)}
                        </span>
                      </div>
                      <Link
                        to="/dashboard"
                        className="flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-[13.5px] font-medium text-cocoa hover:bg-peach hover:text-rust transition-colors"
                      >
                        <MenuIcon d="M4 18v-6M10 18V7M16 18v-4M22 18H2" />{" "}
                        Dashboard
                      </Link>
                      <Link
                        to="/dashboard/issues"
                        className="flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-[13.5px] font-semibold text-rust hover:bg-peach transition-colors"
                      >
                        <MenuIcon d="M12 8.5v4.5M12 16.6v.1M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" />{" "}
                        My Issues
                      </Link>
                      <Link
                        to="/dashboard/repos"
                        className="flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-[13.5px] font-medium text-cocoa hover:bg-peach hover:text-rust transition-colors"
                      >
                        <MenuIcon d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.9z" />{" "}
                        Followed ({saved.length + savedOrgs.length})
                      </Link>
                      <button
                        onClick={signOut}
                        className="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-[13.5px] font-medium text-cocoa hover:bg-peach hover:text-rust transition-colors"
                      >
                        <MenuIcon d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 8l-4 4 4 4M6 12h10" />{" "}
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <SignInButton className="max-[700px]:!px-3.5 max-[700px]:!py-2 max-[700px]:!text-[12.5px]" />
              )}

              {/* hamburger: phone + tablet only */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenu(!menu);
                }}
                aria-label={menu ? "Close menu" : "Open menu"}
                aria-expanded={menu}
                className="lg:hidden relative w-[36px] h-[36px] rounded-full grid place-items-center border border-line bg-card/60 text-ink transition-colors duration-200 hover:bg-peach shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.1"
                  strokeLinecap="round"
                  aria-hidden
                >
                  <line
                    x1="4"
                    y1="7"
                    x2="20"
                    y2="7"
                    style={{
                      transformBox: "fill-box",
                      transformOrigin: "center",
                      transform: menu
                        ? "translateY(5px) rotate(45deg)"
                        : "none",
                      transition:
                        "transform .28s cubic-bezier(.55,1.2,.45,1)",
                    }}
                  />
                  <line
                    x1="4"
                    y1="12"
                    x2="20"
                    y2="12"
                    style={{
                      transformBox: "fill-box",
                      transformOrigin: "center",
                      opacity: menu ? 0 : 1,
                      transform: menu ? "scaleX(.4)" : "none",
                      transition: "all .22s ease",
                    }}
                  />
                  <line
                    x1="4"
                    y1="17"
                    x2="20"
                    y2="17"
                    style={{
                      transformBox: "fill-box",
                      transformOrigin: "center",
                      transform: menu
                        ? "translateY(-5px) rotate(-45deg)"
                        : "none",
                      transition:
                        "transform .28s cubic-bezier(.55,1.2,.45,1)",
                    }}
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {menu && (
          <>
            <div
              onClick={() => setMenu(false)}
              aria-hidden
              className="lg:hidden fixed inset-0 z-[80] bg-ink/45 backdrop-blur-[3px]"
              style={{ animation: "fadeIn .25s ease both" }}
            />
            <aside
              role="dialog"
              aria-label="Site menu"
              className="lg:hidden fixed top-0 right-0 bottom-0 z-[85] w-[min(86vw,340px)]
            bg-paper border-l border-line rounded-l-[28px] shadow-lift flex flex-col
            max-[1023px]:rounded-none max-[1023px]:border-l-0"
              style={{
                animation:
                  "sheetIn .34s cubic-bezier(.32,.9,.35,1) both",
              }}
            >
              <div className="flex items-center justify-between px-5 h-[58px] shrink-0">
                <Link to="/" className="flex items-center gap-2">
                  <Logo size={28} />
                  <Brand />
                </Link>
                <button
                  onClick={() => setMenu(false)}
                  aria-label="Close menu"
                  className="w-[34px] h-[34px] rounded-full grid place-items-center border border-line text-cocoa hover:bg-card hover:text-ink transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.3"
                    strokeLinecap="round"
                  >
                    <path d="M5 5l14 14M19 5 5 19" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-3.5 pb-4">
                <p className="px-2.5 pt-1 pb-2 font-mono text-[10px] font-semibold tracking-[.14em] text-dim">
                  BROWSE
                </p>
                <div className="grid gap-1">
                  {[...PRIMARY, ...SECONDARY].map((l) => (
                    <NavLink
                      key={l.to}
                      to={l.to}
                      end={l.to === "/"}
                      className={`px-3.5 py-3 rounded-[14px] text-[14.5px] font-semibold transition-colors ${pillCls(
                        active(l.to)
                      )}`}
                    >
                      {l.label}
                    </NavLink>
                  ))}
                </div>
                <p className="px-2.5 pt-5 pb-2 font-mono text-[10px] font-semibold tracking-[.14em] text-dim">
                  PLATFORM
                </p>
                <div className="grid gap-1">
                  {PLAT.map(([slug, label, desc, d, tone]) => (
                    <Link
                      key={slug}
                      to={`/platform/${slug}`}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-[14px] hover:bg-peach transition-colors"
                    >
                      <span
                        className={`w-[34px] h-[34px] rounded-[10px] border grid place-items-center shrink-0 ${TONES[tone]}`}
                      >
                        <MenuIcon d={d} />
                      </span>
                      <span className="min-w-0">
                        <b className="block text-[13.5px] font-bold text-ink leading-tight">
                          {label}
                        </b>
                        <span className="block text-[11px] text-dim mt-0.5 truncate">
                          {desc}
                        </span>
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
                      <b className="block text-[13.5px] truncate">
                        {user.name}
                      </b>
                      <span className="block text-[11.5px] text-dim truncate">
                        {user.email || "Signed in"}
                      </span>
                    </span>
                    <Link to="/dashboard" className={btn("dark", "sm")}>
                      Dashboard
                    </Link>
                  </div>
                ) : (
                  <button
                    className={btn("dark", "lg", "!w-full")}
                    onClick={() => {
                      setMenu(false);
                      setAuthOpen(true);
                    }}
                  >
                    Sign in
                  </button>
                )}
              </div>
            </aside>
          </>
        )}
      </nav>
    </header>
  );
}

export function SignInButton({
  label = "Sign in",
  size = "md" as const,
  variant = "dark" as const,
  onClick,
  className = "",
}: {
  label?: string;
  size?: "sm" | "md" | "lg";
  variant?: "dark" | "primary" | "outline";
  onClick?: () => void;
  className?: string;
}) {
  const { setAuthOpen } = useStore();
  return (
    <button
      className={btn(variant, size, className)}
      onClick={onClick ?? (() => setAuthOpen(true))}
    >
      {label}
    </button>
  );
}

/* ── Platform dropdown (desktop) ── */
function PlatformMenu({
  active,
}: {
  active: (to: string) => boolean;
}) {
  const [pop, setPop] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const loc = useLocation();

  useEffect(() => setPop(false), [loc.pathname]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (boxRef.current?.contains(e.target as Node)) return;
      setPop(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPop(false);
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", esc);
    };
  }, []);

  const on = loc.pathname.startsWith("/platform");

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => setPop((open) => !open)}
        aria-expanded={pop}
        aria-haspopup="true"
        className={`${PILL} flex items-center gap-1 ${pillCls(on)}`}
      >
        Platform
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className={`transition-transform duration-200 ${
            pop ? "rotate-180" : ""
          }`}
        >
          <path d="m5 9 7 7 7-7" />
        </svg>
      </button>
      {pop && (
        <div className="absolute left-0 top-[40px] w-[320px] bg-card border border-line rounded-[16px] shadow-lift p-1.5 z-[70]">
          {PLAT.map(([slug, label, desc, d, tone]) => (
            <Link
              key={slug}
              to={`/platform/${slug}`}
              onClick={() => setPop(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-[12px] hover:bg-peach transition-colors"
            >
              <span
                className={`w-[34px] h-[34px] rounded-[10px] border grid place-items-center shrink-0 ${TONES[tone]}`}
              >
                <MenuIcon d={d} />
              </span>
              <span className="min-w-0">
                <b className="block text-[13.5px] font-bold text-ink leading-tight">
                  {label}
                </b>
                <span className="block text-[11.5px] text-dim mt-0.5 truncate">
                  {desc}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── More dropdown for secondary links ── */
function MoreMenu({
  active,
}: {
  active: (to: string) => boolean;
}) {
  const [pop, setPop] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const loc = useLocation();

  useEffect(() => setPop(false), [loc.pathname]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (boxRef.current?.contains(e.target as Node)) return;
      setPop(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPop(false);
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", esc);
    };
  }, []);

  const on = SECONDARY.some((l) => active(l.to));

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => setPop((open) => !open)}
        aria-expanded={pop}
        aria-haspopup="true"
        className={`${PILL} flex items-center gap-1 ${pillCls(on)}`}
      >
        More
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className={`transition-transform duration-200 ${
            pop ? "rotate-180" : ""
          }`}
        >
          <path d="m5 9 7 7 7-7" />
        </svg>
      </button>
      {pop && (
        <div className="absolute left-0 top-[40px] w-[200px] bg-card border border-line rounded-[16px] shadow-lift p-1.5 z-[70]">
          {SECONDARY.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/about"}
              onClick={() => setPop(false)}
              className={`flex items-center px-3 py-2.5 rounded-[12px] text-[13.5px] font-semibold transition-colors ${
                active(l.to)
                  ? "bg-coffee text-foam"
                  : "text-cocoa hover:bg-peach hover:text-ink"
              }`}
            >
              {l.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export const SearchIcon = ({ size = 14 }: { size?: number }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

const MenuIcon = ({ d }: { d: string }) => (
  <svg
    viewBox="0 0 24 24"
    width="15"
    height="15"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="shrink-0"
  >
    <path d={d} />
  </svg>
);

/* ── compact light / dark switch ── */
const RAYS = [0, 45, 90, 135, 180, 225, 270, 315];
const SUN = (color: string) => (
  <g stroke={color} strokeWidth="1.8" strokeLinecap="round">
    <circle cx="12" cy="12" r="4.2" fill={color} stroke="none" />
    {RAYS.map((a) => (
      <line
        key={a}
        x1="12"
        y1="3"
        x2="12"
        y2="5"
        transform={`rotate(${a} 12 12)`}
      />
    ))}
  </g>
);
const MOON = (color: string) => (
  <path
    d="M20.4 14.2A8.6 8.6 0 0 1 9.8 3.6a.6.6 0 0 0-.8-.7 9.2 9.2 0 1 0 12.1 12.1.6.6 0 0 0-.7-.8Z"
    fill={color}
  />
);

export function ThemeToggle() {
  const { theme, toggleTheme } = useStore();
  const dark = theme === "dark";
  return (
    <button
      role="switch"
      aria-checked={dark}
      aria-label="Toggle dark theme"
      onClick={toggleTheme}
      title={dark ? "Switch to light theme" : "Switch to dark theme"}
      className="group relative w-[58px] h-[30px] rounded-full cursor-pointer shrink-0 border transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      style={{
        borderColor: dark ? "#2a2d31" : "#d8dde0",
        background: dark ? "#1d2023" : "#e9ebee",
        boxShadow: dark
          ? "inset 0 1px 4px rgba(0,0,0,.5)"
          : "inset 0 1px 3px rgba(133, 116, 97,.18)",
      }}
    >
      {/* idle icon on the track */}
      <svg
        aria-hidden
        width="15"
        height="15"
        viewBox="0 0 24 24"
        className="absolute top-[7px] transition-opacity duration-300"
        style={{ right: "8px", opacity: dark ? 0 : 1 }}
      >
        {MOON("#8b9298")}
      </svg>
      <svg
        aria-hidden
        width="15"
        height="15"
        viewBox="0 0 24 24"
        className="absolute top-[7px] transition-opacity duration-300"
        style={{ left: "8px", opacity: dark ? 1 : 0 }}
      >
        {SUN("#fbbf24")}
      </svg>
      {/* knob */}
      <span
        aria-hidden
        className="absolute top-[2px] left-[2px] w-[24px] h-[24px] rounded-full bg-white grid place-items-center transition-transform duration-400 ease-[cubic-bezier(.55,1.6,.45,1)] group-hover:scale-[1.05]"
        style={{
          boxShadow:
            "0 2px 5px rgba(58, 40, 22,.2), 0 0 0 1px rgba(58, 40, 22,.04)",
          transform: dark ? "translateX(28px)" : "none",
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          style={{
            opacity: dark ? 0 : 1,
            position: "absolute",
            transition: "opacity .3s",
          }}
        >
          <circle cx="12" cy="12" r="4.4" fill="#fbbf24" />
          <g stroke="#fbbf24" strokeWidth="1.6" strokeLinecap="round">
            {RAYS.map((a) => (
              <line
                key={a}
                x1="12"
                y1="2.8"
                x2="12"
                y2="4.2"
                transform={`rotate(${a} 12 12)`}
              />
            ))}
          </g>
        </svg>
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          style={{
            opacity: dark ? 1 : 0,
            position: "absolute",
            transition: "opacity .3s",
          }}
        >
          {MOON("#2a2d31")}
        </svg>
      </span>
    </button>
  );
}
