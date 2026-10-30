"use client"
/* ══ ui.tsx — small shared primitives ═══════════════════════ */
import { useState } from "react";
import type { ReactNode, ImgHTMLAttributes } from "react";
import { motion } from "framer-motion";
import { tileBG, initials, hash, LEVEL_LABEL } from "../lib/util";
import { PETALS, PETAL_OUT } from "../lib/mark";
import type { CSSProperties } from "react";
import type { Level } from "../lib/types";

/* Seven petals around one centre, traced from the brand artwork (src/lib/mark.ts
   keeps the paths and how they were measured: IoU 0.983 against the reference).
   No plate and no black field - the mark sits directly on whatever page it is
   on, in currentColor, so one component is correct on a cream page and on a
   near-black one. `tone="steel"` swaps that for a brushed-metal gradient, which
   is how the mark appears inside the dark tile on the sign-in canvas.

   `draw` is the entrance: the rosette opens from a bud - each petal scales out
   from the centre in ring order while the whole flower unwinds a few degrees,
   so it arrives the way it would be drawn. The hover answers with the same
   language in reverse: every petal pushes along its own outward axis and
   settles (globals.css owns that one). There is no idle spin - the petals are
   deliberately uneven, so a rotation would never land back on itself.
   Reduced-motion visitors get the finished, still mark, as everywhere else. */
export function Logo({ size = 30, draw = false, tone = "ink" }:
  { size?: number; draw?: boolean; tone?: "ink" | "steel" }) {
  /* The mark never asks here whether the visitor wants motion: that is
     MotionConfig's `reducedMotion="user"` in Shell, and the CSS media query
     in globals.css for the hover. Asking here used to make the server's HTML
     and the client's first render disagree about the logo's own transform - a
     hydration mismatch on every page, for every reduced-motion visitor. */
  const anim = draw;
  const easeSilk = [0.22, 1, 0.36, 1] as const;
  const steel = "cyrus-mark-steel";
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      {tone === "steel" && (
        <defs>
          <linearGradient id={steel} x1="16" y1="4" x2="84" y2="98" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#fbfcfd" />
            <stop offset=".4" stopColor="#c9cfd7" />
            <stop offset=".7" stopColor="#8d959e" />
            <stop offset="1" stopColor="#e8ebef" />
          </linearGradient>
        </defs>
      )}
      <motion.g className="mark-petals"
        initial={anim ? { rotate: -30 } : false}
        animate={{ rotate: 0 }}
        transition={{ duration: 0.86, ease: easeSilk }}
        style={{ transformBox: "view-box", transformOrigin: "50px 50px" }}>
        {PETALS.map((d, i) => (
          <motion.path key={i} d={d} fill={tone === "steel" ? `url(#${steel})` : "currentColor"}
            initial={anim ? { scale: 0.16, opacity: 0 } : false}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 + i * 0.062, duration: 0.62, ease: easeSilk }}
            style={{
              transformBox: "view-box",
              transformOrigin: "50px 50px",
              "--ox": PETAL_OUT[i][0],
              "--oy": PETAL_OUT[i][1],
            } as CSSProperties} />
        ))}
      </motion.g>
    </svg>
  );
}

export const Brand = () => (
  <span className="font-display font-extrabold text-[20px] tracking-[-.025em]">cyrus</span>
);

/* A flat-vector portrait, drawn from the name. These are illustrations, not
   photographs of anyone: a real face next to a quote nobody gave would be the
   worst kind of placeholder, so the avatars stay obviously made-up and say so. */
const SKIN = ["#f0c9a4", "#d9a173", "#a9713f", "#7c4a24", "#e8b48c", "#5c3620"];
const HAIR = ["#2b2b30", "#4a3320", "#1d1d20", "#6b4226", "#3a2a3f", "#8a8f98"];
const CLOTH = ["#2f6b4f", "#37506e", "#6b3f52", "#4a4f55", "#7a5321", "#2f5d63"];
export function Portrait({ name, size = 44, className = "" }: { name: string; size?: number; className?: string }) {
  const h = hash(name);
  const skin = SKIN[h % SKIN.length];
  const hair = HAIR[(h >> 3) % HAIR.length];
  const cloth = CLOTH[(h >> 6) % CLOTH.length];
  const style = (h >> 9) % 4;
  const glasses = (h >> 12) % 3 === 0;
  const bg = `hsl(${(h >> 4) % 360} 30% 88%)`;
  const doHair = () => {
    if (style === 0) return <path d="M20 34c0-9 5-15 12-15s12 6 12 15c0-4-3-6-12-6s-12 2-12 6Z" fill={hair} />;
    if (style === 1) return <><path d="M19 36c0-10 5-17 13-17s13 7 13 17c0 6-2 9-3 6 1-8-2-12-10-12s-11 4-10 12c-1 3-3 0-3-6Z" fill={hair} /></>;
    if (style === 2) return <><path d="M20 33c0-9 5-14 12-14s12 5 12 14v3c0-6-4-9-12-9s-12 3-12 9Z" fill={hair} /><circle cx="42" cy="24" r="5" fill={hair} /></>;
    return <path d="M19 35c1-11 6-16 13-16s12 5 13 16c-2-5-6-7-13-7s-11 2-13 7Z" fill={hair} />;
  };
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className={`shrink-0 rounded-full ${className}`} role="img">
      <clipPath id={`pc${h}`}><circle cx="32" cy="32" r="32" /></clipPath>
      <g clipPath={`url(#pc${h})`}>
        <rect width="64" height="64" fill={bg} />
        <path d="M32 44c9 0 16 6 17 14H15c1-8 8-14 17-14Z" fill={cloth} />
        <rect x="27" y="38" width="10" height="10" rx="4" fill={skin} />
        <ellipse cx="32" cy="30" rx="12.5" ry="13.5" fill={skin} />
        {doHair()}
        <circle cx="27" cy="30.5" r="1.7" fill="#22262a" />
        <circle cx="37" cy="30.5" r="1.7" fill="#22262a" />
        <path d="M28.5 36.5c1.6 1.3 5.4 1.3 7 0" stroke="#22262a" strokeWidth="1.4" strokeLinecap="round" fill="none" opacity=".75" />
        {glasses && <g stroke="#22262a" strokeWidth="1.3" fill="none" opacity=".7"><circle cx="27" cy="30.5" r="4.6" /><circle cx="37" cy="30.5" r="4.6" /><path d="M31.6 30.5h2.8" /></g>}
      </g>
      <circle cx="32" cy="32" r="31" fill="none" stroke="currentColor" strokeOpacity=".12" />
    </svg>
  );
}

export function Word({ children }: { children: ReactNode }) {
  return <span className="word-accent">{children}</span>;
}

/* section eyebrow: monospaced and uppercase, with the cyrus spark as its only
   ornament. The pill version read as a badge; a label should not shout. */
export const Eyebrow = ({ children }: { children: ReactNode }) => (
  <span className="inline-flex items-center gap-2.5 font-mono text-[10.5px] font-medium uppercase tracking-[.16em] text-dim">
    <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden className="shrink-0">
      <path d="M12 1.8c.95 4.9 3.32 8.1 8.4 9.5.6.16.6 1.04 0 1.2-5.08 1.4-7.45 4.6-8.4 9.5-.16.6-1.04.6-1.2 0-.95-4.9-3.32-8.1-8.4-9.5-.6-.16-.6-1.04 0-1.2 5.08-1.4 7.45-4.6 8.4-9.5.16-.6 1.04-.6 1.2 0z" fill="var(--color-accent)" />
    </svg>
    {children}
  </span>
);

export const SectionTag = ({ children }: { children: ReactNode }) => (
  <span className="font-mono text-[11px] tracking-[.14em] uppercase text-accent">{children}</span>
);

/* button variants */
const BTN_BASE = "inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition-all duration-150 active:scale-[.98] cursor-pointer";
const BTN_SIZES: Record<string, string> = {
  sm: "px-3.5 py-1.5 text-[12.5px]", md: "px-5 py-2.5 text-[14px]", lg: "px-7 py-3.5 text-[15.5px]",
};
export const BTN_VARIANTS: Record<string, string> = {
  /* the signal-green fill. Its label is near-black on graphite and white on
     paper, so it stays legible whichever mode the visitor is in. */
  primary: "bg-accent text-accentfg border border-accent shadow-[0_10px_26px_-12px_rgba(34,197,94,.5)] hover:bg-accentd hover:border-accentd",
  /* the neutral pill: near-white on graphite, graphite on paper */
  dark: "bg-ink text-paper border border-ink hover:-translate-y-px hover:shadow-lift",
  outline: "bg-card border border-line text-ink shadow-soft hover:border-accent hover:-translate-y-px",
  ghost: "text-cocoa hover:text-ink hover:bg-card border border-transparent hover:border-line",
};
export function btn(variant = "outline", size = "md", extra = "") {
  return `${BTN_BASE} ${BTN_SIZES[size]} ${BTN_VARIANTS[variant]} ${extra}`;
}

/* avatar with graceful fallback */
export function OrgImg({ src, name, className = "", ...rest }: { src: string; name: string } & ImgHTMLAttributes<HTMLImageElement>) {
  const [broken, setBroken] = useState(false);
  if (broken) {
    return (
      <span className={`grid place-items-center bg-clay text-dim font-display font-bold ${className}`} style={{ background: tileBG(name), color: "#fff" }}>
        {initials(name)}
      </span>
    );
  }
  return <img src={src} alt={name} loading="lazy" onError={() => setBroken(true)} {...rest} className={className} />;
}

export function Avatar({ name, size = 30, src }: { name: string; size?: number; src?: string }) {
  const [broken, setBroken] = useState(false);
  if (src && !broken) {
    return <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)}
      className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />;
  }
  return (
    <span className="rounded-full grid place-items-center font-bold text-white overflow-hidden shrink-0"
      style={{ width: size, height: size, background: tileBG(name), fontSize: size * 0.4 }}>
      {initials("u/" + name)}
    </span>
  );
}

/* level / tag chips */
const LEVEL_CLS: Record<Level, string> = {
  beginner: "text-leaf border-leaf/30 bg-leaf/8",
  intermediate: "text-honey border-honey/30 bg-honey/8",
  advanced: "text-brick border-brick/30 bg-brick/8",
};
export const LevelChip = ({ level }: { level: Level }) => (
  <span className={`font-mono text-[10.5px] font-semibold px-2.5 py-1 rounded-full border ${LEVEL_CLS[level]}`}>
    {LEVEL_LABEL[level]}
  </span>
);

export const Chip = ({ children, tone = "" }: { children: ReactNode; tone?: "cat" | "stars" | "lang" | "green" | "blue" | "purple" | "" }) => {
  const tones: Record<string, string> = {
    cat: "text-rust border-accent/30 bg-peach",
    stars: "text-honey border-honey/30 bg-honey/6",
    lang: "text-denim border-denim/30 bg-denim/6",
    green: "text-leaf border-leaf/35 bg-leaf/7",
    blue: "text-denim border-denim/35 bg-denim/7",
    purple: "text-plum border-plum/35 bg-plum/7",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-[10.5px] font-semibold rounded-full px-2.5 py-1 border ${tones[tone] ?? "text-cocoa border-line bg-cream"}`}>
      {children}
    </span>
  );
};

export const Tag = ({ children }: { children: ReactNode }) => (
  <span className="inline-block font-mono text-[10.5px] font-semibold px-2.5 py-[3px] rounded-full border border-line text-cocoa bg-cream">
    {children}
  </span>
);

/* section header with side link */
export function SectionHead({ tag, title, sub, side }: { tag: string; title: ReactNode; sub?: string; side?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-5 flex-wrap mb-10">
      <div>
        <SectionTag>{tag}</SectionTag>
        <h2 className="font-display font-extrabold tracking-[-.02em] leading-[1.08] mt-3 text-[clamp(32px,4vw,50px)]">{title}</h2>
        {sub && <p className="text-ink font-medium mt-3 text-[16.5px] leading-[1.6] max-w-[560px]">{sub}</p>}
      </div>
      {side && <div className="flex items-center gap-3">{side}</div>}
    </div>
  );
}

/* deterministic tiny sparkline path */
export function spark(seed: string, w = 110, h = 34): string {
  const pts: string[] = [];
  for (let i = 0; i <= 10; i++) {
    const y = h - 4 - rnd01(seed + i) * (h - 8);
    pts.push(`${(i / 10) * w},${y.toFixed(1)}`);
  }
  return "M" + pts.join(" L");
}
const rnd01 = (s: string) => (hash(s) % 1000) / 1000;
