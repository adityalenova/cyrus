"use client"
/* ══ ui.tsx — small shared primitives ═══════════════════════ */
import { useState } from "react";
import type { ReactNode, CSSProperties } from "react";
import Image from "next/image";
import { tileBG, initials, hash, LEVEL_LABEL } from "../lib/util";
import type { Level } from "../lib/types";

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <rect width="100" height="100" rx="27" fill="#241b13" />
      <path d="M68 34a21.5 21.5 0 1 0 .9 32" fill="none" stroke="#f5eee3" strokeWidth="11" strokeLinecap="round" />
      <path d="M76 22c1.6 8.4 5.2 12 13.5 13.6C81.2 37.2 77.6 40.8 76 49.2 74.4 40.8 70.8 37.2 62.4 35.6 70.8 34 74.4 30.4 76 22z" fill="#d98546" />
    </svg>
  );
}

export const Brand = () => (
  <span className="font-display font-extrabold text-[19px] tracking-[-.02em]">cyrus</span>
);

export function Word({ children }: { children: ReactNode }) {
  return <span className="word-accent">{children}</span>;
}

export const Eyebrow = ({ children }: { children: ReactNode }) => (
  <span className="inline-flex items-center gap-2 font-mono text-[11.5px] font-medium text-rust bg-peach border border-accent/20 rounded-full px-4 py-2">
    <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden className="shrink-0 animate-diamond">
      <path d="M12 1.8c.95 4.9 3.32 8.1 8.4 9.5.6.16.6 1.04 0 1.2-5.08 1.4-7.45 4.6-8.4 9.5-.16.6-1.04.6-1.2 0-.95-4.9-3.32-8.1-8.4-9.5-.6-.16-.6-1.04 0-1.2 5.08-1.4 7.45-4.6 8.4-9.5.16-.6 1.04-.6 1.2 0z" fill="#b4602c" />
      <path d="M18.6 3.2c.4 2.05 1.35 3.4 3.6 4.05.26.07.26.45 0 .52-2.25.65-3.2 2-3.6 4.05-.07.26-.45.26-.52 0-.4-2.05-1.35-3.4-3.6-4.05a.28.28 0 0 1 0-.52c2.25-.65 3.2-2 3.6-4.05.07-.26.45-.26.52 0z" fill="#d98546" opacity=".8" />
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
  primary: "bg-accent text-white border border-accent shadow-[0_10px_26px_-10px_rgba(180, 96, 44,.55)] hover:bg-accentd",
  dark: "bg-coffee text-foam border border-coffee hover:bg-bean hover:border-roast",
  outline: "bg-card border border-line text-ink shadow-soft hover:border-accent hover:-translate-y-px",
  ghost: "text-cocoa hover:text-ink hover:bg-card border border-transparent hover:border-line",
};
export function btn(variant = "outline", size = "md", extra = "") {
  return `${BTN_BASE} ${BTN_SIZES[size]} ${BTN_VARIANTS[variant]} ${extra}`;
}

/* avatar with graceful fallback */
export function OrgImg({ src, name, className = "", size = 96, title, style }:
  { src: string; name: string; className?: string; size?: number; title?: string; style?: CSSProperties }) {
  const [broken, setBroken] = useState(false);
  if (broken) {
    return (
      <span className={`grid place-items-center bg-clay text-dim font-display font-bold ${className}`} style={{ background: tileBG(name), color: "#fff" }}>
        {initials(name)}
      </span>
    );
  }
  return <Image src={src} alt={name} title={title} width={size} height={size} onError={() => setBroken(true)} className={className} style={style} />;
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
