"use client"
/* ══ plat.tsx — shared kit for the /platform pages: pills, icons,
   mock product panels, step headers, behind-the-scenes cards ── */
import type { ReactNode } from "react";
import { Link } from "@/lib/router";
import { btn } from "./ui";

export const W = "max-w-[1240px] mx-auto px-6";

export const Pill = ({ children, center = false }: { children: ReactNode; center?: boolean }) => (
  <span className={`inline-flex items-center gap-2.5 font-mono text-[10.5px] font-bold tracking-[.18em] uppercase text-rust bg-peach border border-accent/25 rounded-full px-4 py-2 shadow-soft ${center ? "mx-auto" : ""}`}>
    <span className="leading-none">✦</span>{children}
  </span>
);

export const Ico = ({ d, size = 17, sw = 1.9 }: { d: string; size?: number; sw?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

export const Check = ({ className = "text-leaf" }: { className?: string }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
    <path d="M4 12.5 10 18.5 20 6" />
  </svg>
);
export const Cross = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden className="text-brick">
    <path d="M5 5l14 14M19 5 5 19" />
  </svg>
);

export const TONES: Record<string, string> = {
  rust: "text-rust bg-peach border-accent/25",
  leaf: "text-leaf bg-leaf/10 border-leaf/25",
  honey: "text-honey bg-honey/12 border-honey/40",
  denim: "text-denim bg-denim/10 border-denim/25",
  plum: "text-plum bg-plum/10 border-plum/25",
  brick: "text-brick bg-brick/10 border-brick/25",
};
export const Tile = ({ d, tone = "rust", size = 44 }: { d: string; tone?: string; size?: number }) => (
  <span className={`rounded-[13px] border grid place-items-center shrink-0 ${TONES[tone] ?? TONES.rust}`} style={{ width: size, height: size }}>
    <Ico d={d} size={size * 0.46} />
  </span>
);

/* window-style mock product panel (the "ONBOARDING WIZARD" cards) */
export function MockPanel({ title, children, label }: { title: string; children: ReactNode; label?: string }) {
  return (
    <div className="rounded-[26px] border border-line bg-cream p-3.5 shadow-lift">
      <div className="rounded-[18px] border border-line bg-card overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-liness bg-paper/60">
          <span className="w-[26px] h-[26px] rounded-[8px] bg-peach border border-accent/25 text-rust grid place-items-center"><Ico d="M12 3 3 8l9 5 9-5-9-5ZM3 16l9 5 9-5M3 12l9 5 9-5" size={13} /></span>
          <b className="font-mono text-[10.5px] font-bold tracking-[.16em] uppercase text-ink">{title}</b>
          <span className="ml-auto flex gap-1" aria-hidden>
            {[0, 1, 2].map((i) => <i key={i} className="w-[5px] h-[5px] rounded-full bg-clay" />)}
          </span>
        </div>
        <div className="p-4">
          {label && <p className="font-mono text-[9.5px] tracking-[.14em] uppercase text-dim px-2 pb-2">{label}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}
export function MockRow({ n, children, tone = "rust" }: { n: number | string; children: ReactNode; tone?: string }) {
  return (
    <div className="flex items-center gap-3.5 bg-paper border border-line rounded-[14px] px-4 py-3.5 mb-2.5 last:mb-0 shadow-soft">
      <span className={`w-[26px] h-[26px] rounded-full grid place-items-center font-mono text-[11px] font-bold shrink-0 border ${TONES[tone] ?? TONES.rust}`}>{n}</span>
      <span className="text-[13.5px] font-semibold text-ink min-w-0">{children}</span>
    </div>
  );
}

/* STEP 01 / Assess & configure header block */
export function StepHead({ step, label, d, tone = "rust" }: { step: string; label: string; d: string; tone?: string }) {
  return (
    <div className="flex items-center gap-3.5 mb-7">
      <Tile d={d} tone={tone} size={48} />
      <span>
        <span className={`block font-mono text-[10.5px] font-bold tracking-[.18em] uppercase ${TONES[tone]?.split(" ")[0] ?? "text-rust"}`}>Step {step}</span>
        <b className="block font-display font-bold text-[16px] text-ink mt-0.5">{label}</b>
      </span>
    </div>
  );
}

/* "Behind the scenes" checklist card */
export function Behind({ items, tone = "rust" }: { items: string[]; tone?: string }) {
  return (
    <div className={`relative overflow-hidden bg-card border border-line rounded-[20px] p-6 shadow-soft mt-9`}>
      <span aria-hidden className="absolute -right-10 -top-10 w-40 h-40 rounded-full opacity-60 pointer-events-none" style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--color-accent) 12%, transparent), transparent 65%)" }} />
      <p className="flex items-center gap-2.5 font-mono text-[10.5px] font-bold tracking-[.16em] uppercase text-ink mb-4">
        <span className="w-[7px] h-[7px] rounded-full bg-ink" />Behind the scenes
      </p>
      <ul className="grid gap-3 list-none">
        {items.map((x) => (
          <li key={x} className="flex items-start gap-3 text-[14px] text-cocoa leading-snug">
            <span className={`mt-0.5 ${TONES[tone]?.split(" ")[0] ?? "text-leaf"}`}><Check /></span>{x}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* "Your action" band */
export function YourAction({ children, tone = "rust" }: { children: ReactNode; tone?: string }) {
  return (
    <div className="mt-8 border-l-[3px] pl-5" style={{ borderColor: "var(--color-accent)" }}>
      <p className={`font-mono text-[10.5px] font-bold tracking-[.16em] uppercase mb-1.5 ${TONES[tone]?.split(" ")[0] ?? "text-rust"}`}>Your action</p>
      <p className="text-cocoa text-[14px] leading-[1.65]">{children}</p>
    </div>
  );
}

/* big centered section opener. `as` is there because a page whose first
   heading is a section heading leaves the whole document without an h1 -
   /platform/trust opens with this, and its page title is the one a screen
   reader or a search result should be reading. */
export function CenterHead({ pill, h2, sub, as = "h2" }: { pill: string; h2: ReactNode; sub?: string; as?: "h1" | "h2" }) {
  const Head = as;
  return (
    <div className="text-center max-w-[700px] mx-auto">
      <Pill center>{pill}</Pill>
      <Head className="font-display font-extrabold tracking-[-.025em] text-[clamp(28px,3.6vw,42px)] leading-[1.12] mt-6">{h2}</Head>
      {sub && <p className="text-cocoa text-[15.5px] leading-[1.7] mt-4">{sub}</p>}
    </div>
  );
}

export const PageHero = ({ pill, h1, sub, cta }: { pill: string; h1: ReactNode; sub: string; cta?: ReactNode }) => (
  <header className={`${W} pt-[72px] pb-6 text-center`}>
    <Pill center>{pill}</Pill>
    <h1 className="font-display font-extrabold tracking-[-.025em] leading-[1.06] text-[clamp(36px,4.8vw,60px)] mt-6 max-w-[860px] mx-auto">{h1}</h1>
    <p className="text-cocoa text-[16.5px] leading-[1.7] max-w-[620px] mx-auto mt-5">{sub}</p>
    {cta && <div className="flex gap-3 justify-center flex-wrap mt-8">{cta}</div>}
  </header>
);

/* dotted-grid page backdrop strip */
export const GridBG = ({ pos = "50% 30%" }: { pos?: string }) => (  <span aria-hidden className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_right,var(--gl)_1px,transparent_1px),linear-gradient(to_bottom,var(--gl)_1px,transparent_1px)] [background-size:38px_38px]" style={{ maskImage: `radial-gradient(820px 480px at ${pos}, #000 45%, transparent)`, WebkitMaskImage: `radial-gradient(820px 480px at ${pos}, #000 45%, transparent)` }} />
);

/* full-bleed seam that divides one section from the next */
export const Rule = () => (
  <div className="mt-[64px] h-px w-full bg-rule" aria-hidden />
);

/* shared closing CTA row */
export const PlatCTA = ({ to, label, also }: { to: string; label: string; also?: [string, string] }) => (
  <div className="flex gap-3 justify-center flex-wrap mt-10">
    <Link to={to} className={btn("dark", "lg")}>{label}</Link>
    {also && <Link to={also[0]} className={btn("outline", "lg")}>{also[1]}</Link>}
  </div>
);
