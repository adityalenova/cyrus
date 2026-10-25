"use client"
/* ══ Hackathons.tsx — cover art, shelf cards, list + full prep-plan detail ═ */
import Image from "next/image";
import { Link, useParams, useNavigate, useSearchParams } from "@/lib/router";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { HACKS, HACK_STATUS } from "../data/hackathons";
import type { Hack } from "../data/hackathons";
import { HACKS_LIVE } from "../data/hackathonsLive";
import type { HackLive } from "../data/hackathonsLive";
import { LIVE_CREDITS } from "../data/liveCovers";
import { HACK_ART } from "../data/hackArt";
import { REPOS } from "../data/repos";
import { avatarOf, byStars, hash } from "../lib/util";
import { Word, SectionTag, btn, OrgImg, Chip } from "../components/ui";

/* curated prep plans first, then the live Devpost pull (open → upcoming → closed) */
export const ALL_HACKS: Hack[] = [...HACKS, ...HACKS_LIVE];
export const hackLink = (h: Hack): string => (h as HackLive).url || REGISTER[h.id] || "https://devpost.com/hackathons";

/* registration / info links kept honest: official hubs, not deep guesses */
export const REGISTER: Record<string, string> = {
  "nebius-x-nvidia-global-ai-hackathon": "https://devpost.com/hackathons",
  "hacktoberfest-2026": "https://hacktoberfest.com",
  "smart-india-hackathon-2026": "https://sih.gov.in",
  "microsoft-imagine-cup-2027": "https://imaginecup.microsoft.com",
  "google-solution-challenge-2027": "https://solutionchallenge.withgoogle.com",
  "openai-build-week": "https://openai.com/devday/",
  "meta-global-ai-developer-hackathon": "https://dev.meta.ai",
  "hackon-with-amazon": "https://unstop.com/hackathons",
  "mlh-global-hack-week": "https://mlh.io",
  "kaggle-playground-series": "https://www.kaggle.com/competitions",
  "google-cloud-agents-for-impact": "https://cloud.google.com/resources",
  "ai-builder-cup-2026": "https://unstop.com/hackathons",
  "github-universe-ai-hackathon-2026": "https://github.com/universe",
  "anthropic-claude-code-hackathon": "https://www.anthropic.com/events",
  "nvidia-jetson-physical-ai-hackathon": "https://developer.nvidia.com/hackathon",
  "hugging-face-open-model-hackathon": "https://huggingface.co",
  "devpost-hack-new-year-2027": "https://devpost.com/hackathons",
  "microsoft-ai-tour-hackathon": "https://aitour.microsoft.com",
};

const daysTo = (iso: string) => Math.ceil((+new Date(iso) - +new Date("2026-10-03")) / 864e5);

/* cover artwork: eight generative art series - nebula, aurora, circuit, ink,
   ridge, prism, bloom, wave. Each curated hackathon is mapped to the series
   that fits its theme; the live Devpost listings rotate through all eight by
   seed. Every composition is re-rolled per event, so no two covers match,
   and all palettes stay deep enough that the cream card text always reads. */
type Series = "silk" | "nebula" | "aurora" | "circuit" | "ink" | "ridge" | "prism" | "bloom" | "wave";
const SERIES_FOR: Record<string, Series> = {
  "github-universe-ai-hackathon-2026": "nebula",
  "devpost-hack-new-year-2027": "nebula",
  "google-solution-challenge-2027": "aurora",
  "google-cloud-agents-for-impact": "aurora",
  "mlh-global-hack-week": "aurora",
  "nvidia-jetson-physical-ai-hackathon": "circuit",
  "nebius-x-nvidia-global-ai-hackathon": "circuit",
  "smart-india-hackathon-2026": "circuit",
  "openai-build-week": "ink",
  "anthropic-claude-code-hackathon": "ink",
  "hugging-face-open-model-hackathon": "ink",
  "microsoft-imagine-cup-2027": "ridge",
  "microsoft-ai-tour-hackathon": "prism",
  "kaggle-playground-series": "prism",
  "hacktoberfest-2026": "bloom",
  "meta-global-ai-developer-hackathon": "wave",
  "hackon-with-amazon": "wave",
};
const PAL: Record<Series, { bg: [string, string]; c: [string, string, string] }> = {
  silk:   { bg: ["#171425", "#221a2c"], c: ["#bfe3d2", "#f6cfae", "#cfc3ea"] },
  nebula: { bg: ["#100b16", "#1b1222"], c: ["#f4bd77", "#a98bd0", "#e8c9a0"] },
  aurora: { bg: ["#0d110f", "#161a14"], c: ["#8fd0a8", "#f0c27f", "#6fb3b8"] },
  circuit: { bg: ["#12100a", "#1d150c"], c: ["#d9a441", "#7fb069", "#e07a4a"] },
  ink:    { bg: ["#140d0d", "#221214"], c: ["#e8b48a", "#b4602c", "#8a5560"] },
  ridge:  { bg: ["#171008", "#241a10"], c: ["#f6d9a2", "#cf7426", "#8c4a2a"] },
  prism:  { bg: ["#101016", "#1a1520"], c: ["#f4bd77", "#a3b8cc", "#cf7426"] },
  bloom:  { bg: ["#150d07", "#241209"], c: ["#e07a4a", "#f0c27f", "#8c3a34"] },
  wave:   { bg: ["#100e0a", "#1e150c"], c: ["#df9355", "#f6d9a2", "#96491f"] },
};

export function HackCover({ h, className = "" }: { h: Hack; className?: string }) {
  const seed = Math.abs(hash(h.id)) + 7;
  let s = (seed * 2654435761) % 2147483647 || 12345;
  const rnd = () => (s = (s * 48271) % 2147483647) / 2147483647;
  const series: Series = SERIES_FOR[h.id] ?? "silk";
  const { bg, c } = PAL[series];
  const uid = `${series}-${seed}`;
  /* silk re-rolls its pastel set per event so 140+ live covers never repeat */
  const PASTELS = [
    ["#bfe3d2", "#f6cfae", "#cfc3ea"], ["#a8d8ea", "#f7c8d4", "#ffe1a8"],
    ["#d4c5f9", "#bde0fe", "#ffc8dd"], ["#cdb4db", "#a2e3a4", "#ffd6a5"],
    ["#b5e2fa", "#e0c3fc", "#f6d6a0"], ["#c2e59c", "#f8c8dc", "#bde0fe"],
    ["#f5c6aa", "#b8c0ff", "#d6eadb"], ["#e2c6ff", "#b8e0d2", "#ffccb6"],
  ];
  const pc = PASTELS[seed % PASTELS.length];
  const stars = (n: number, maxY = 180) => Array.from({ length: n }, () => (
    <circle key={rnd()} cx={rnd() * 220} cy={rnd() * maxY} r={.4 + rnd() * .9} fill="#f6e7c9" opacity={.12 + rnd() * .45} />
  ));

  let art: ReactNode = null;
  if (series === "silk") {
    art = (<>
      {[0, 1, 2, 3].map((i) => {
        const y = 24 + i * (30 + rnd() * 14);
        const bend = 24 + rnd() * 40;
        return <path key={i} d={`M-30 ${(y + rnd() * 14).toFixed(1)} C 50 ${(y - bend).toFixed(1)}, 150 ${(y + bend).toFixed(1)}, 250 ${(y - bend * .5).toFixed(1)}`}
          fill="none" stroke={`url(#k-${uid}-${i})`} strokeWidth={(26 + rnd() * 26).toFixed(1)} strokeLinecap="round"
          opacity={.48 + rnd() * .3} filter={`url(#kblur-${uid})`} />;
      })}
      {stars(6, 60)}
    </>);
  } else if (series === "nebula") {
    const px = 138 + rnd() * 44, py = 34 + rnd() * 34, pr = 20 + rnd() * 12;
    art = (<>
      {stars(26)}
      <circle cx={px} cy={py} r={pr * 2.6} fill={`url(#g-${uid})`} />
      <circle cx={px} cy={py} r={pr} fill={`url(#p-${uid})`} />
      <ellipse cx={px} cy={py} rx={pr * 1.9} ry={pr * .38} fill="none" stroke={c[0]} strokeOpacity=".5"
        strokeWidth="1.6" transform={`rotate(${-18 + rnd() * 36} ${px} ${py})`} />
      <ellipse cx={px} cy={py} rx={pr * 1.55} ry={pr * .3} fill="none" stroke={c[2]} strokeOpacity=".35"
        strokeWidth="1" transform={`rotate(${-18 + rnd() * 36} ${px} ${py})`} />
    </>);
  } else if (series === "aurora") {
    const x0 = 20 + rnd() * 30;
    art = (<>
      {stars(10, 70)}
      {[0, 1, 2].map((i) => {
        const x = x0 + i * (44 + rnd() * 22), w = 26 + rnd() * 26;
        return <path key={i} d={`M${x} -6 C ${x + w} 50, ${x - w * .6} 100, ${x + w * .5} 190 L ${x + w * 1.5} 190 C ${x + w * .4} 100, ${x + w * 1.6} 50, ${x + w} -6 Z`}
          fill={`url(#a-${uid}-${i})`} opacity={.5 + rnd() * .3} />;
      })}
      <rect y="150" width="220" height="30" fill={`url(#f-${uid})`} />
    </>);
  } else if (series === "circuit") {
    const nodes = Array.from({ length: 7 }, () => ({ x: 16 + rnd() * 188, y: 14 + rnd() * 150 }));
    art = (<>
      {nodes.map((n, i) => {
        const m = nodes[(i + 1) % nodes.length];
        return <path key={i} d={`M${n.x} ${n.y} H${m.x} V${m.y}`} fill="none" stroke={c[i % 3]} strokeOpacity=".38" strokeWidth="1.1" />;
      })}
      {nodes.map((n, i) => (
        <g key={i}>
          <circle cx={n.x} cy={n.y} r="4.6" fill={`url(#n-${uid})`} opacity=".8" />
          <circle cx={n.x} cy={n.y} r="1.7" fill={c[i % 3]} opacity=".95" />
        </g>
      ))}
      <rect x={54 + rnd() * 90} y={52 + rnd() * 56} width="34" height="26" rx="4" fill="none" stroke={c[0]} strokeOpacity=".55" strokeWidth="1.3" />
    </>);
  } else if (series === "ink") {
    const y0 = 50 + rnd() * 60;
    art = (<>
      {[0, 1, 2].map((i) => {
        const y = y0 + i * (18 + rnd() * 16);
        return <path key={i} d={`M-16 ${y} C 50 ${y - 40 - rnd() * 30}, 130 ${y + 34 + rnd() * 26}, 236 ${y - 12 - rnd() * 24}`}
          fill="none" stroke={c[i]} strokeWidth={9 + rnd() * 13} strokeLinecap="round"
          opacity={.34 + rnd() * .2} filter={`url(#b-${uid})`} />;
      })}
      <path d={`M-16 ${y0 + 16} C 60 ${y0 - 22}, 140 ${y0 + 44}, 236 ${y0 + 4}`} fill="none" stroke={c[0]} strokeWidth="1.3" strokeLinecap="round" opacity=".65" />
      {stars(6, 60)}
    </>);
  } else if (series === "ridge") {
    const sx = 60 + rnd() * 100, sy = 40 + rnd() * 18;
    const layer = (base: number, amp: number, o: number, fill: string, key: number) => {
      let d = `M0 180 L0 ${base}`;
      for (let x = 0; x <= 220; x += 44) d += ` L${x + 22} ${base - amp * (.5 + rnd())} L${x + 44} ${base - amp * rnd() * .4}`;
      return <path key={key} d={`${d} L220 180 Z`} fill={fill} opacity={o} />;
    };
    art = (<>
      <circle cx={sx} cy={sy} r="26" fill={`url(#s-${uid})`} />
      <circle cx={sx} cy={sy} r="8.5" fill={c[0]} opacity=".9" />
      {layer(118, 34, .5, c[2], 1)}
      {layer(140, 30, .72, "#241a12", 2)}
      {layer(160, 22, .95, "#120c07", 3)}
    </>);
  } else if (series === "prism") {
    art = (<>
      {Array.from({ length: 6 }, (_, i) => {
        const x = 12 + rnd() * 180, y = 10 + rnd() * 130, r = 16 + rnd() * 30, rot = rnd() * 360;
        return <path key={i} d={`M${x} ${y} L${x + r} ${y + r * (.6 + rnd())} L${x - r * (.4 + rnd())} ${y + r} Z`}
          transform={`rotate(${rot} ${x} ${y})`} fill={c[i % 3]} opacity={.1 + rnd() * .16}
          stroke={c[i % 3]} strokeOpacity=".3" strokeWidth=".8" />;
      })}
      <path d={`M${30 + rnd() * 40} -8 L${120 + rnd() * 60} 190`} stroke={`url(#r-${uid})`} strokeWidth="26" opacity=".3" filter={`url(#b-${uid})`} />
      {stars(8)}
    </>);
  } else if (series === "bloom") {
    const cx = 70 + rnd() * 90, cy = 54 + rnd() * 40;
    art = (<>
      {Array.from({ length: 6 }, (_, i) => {
        const ang = i * 60 + rnd() * 18, rx = 30 + rnd() * 18, ry = 11 + rnd() * 6;
        return <ellipse key={i} cx={cx + rx * .72} cy={cy} rx={rx} ry={ry} fill={c[i % 3]} opacity={.2 + rnd() * .18}
          transform={`rotate(${ang} ${cx} ${cy})`} />;
      })}
      <circle cx={cx} cy={cy} r={5 + rnd() * 3} fill={c[1]} opacity=".9" />
      {stars(9)}
    </>);
  } else {
    const y0 = 44 + rnd() * 40;
    art = (<>
      {[0, 1, 2, 3].map((i) => {
        const y = y0 + i * (26 + rnd() * 10), amp = 12 + rnd() * 16, ph = rnd() * 40;
        return <path key={i} d={`M-14 ${y} Q ${40 + ph} ${y - amp}, ${92 + ph} ${y} T ${206 + ph} ${y} L 236 ${y + amp * .4}`}
          fill="none" stroke={`url(#w-${uid})`} strokeWidth={2 + rnd() * 5} strokeLinecap="round" opacity={.42 + rnd() * .4} />;
      })}
      {stars(7, 40)}
    </>);
  }

  return (
    <svg viewBox="0 0 220 180" className={className} preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id={`bg-${uid}`} x1="0" y1="0" x2=".4" y2="1">
          <stop offset="0" stopColor={bg[0]} /><stop offset="1" stopColor={bg[1]} />
        </linearGradient>
        <radialGradient id={`g-${uid}`}><stop offset="0" stopColor={c[1]} stopOpacity=".4" /><stop offset="1" stopColor={c[1]} stopOpacity="0" /></radialGradient>
        <radialGradient id={`p-${uid}`} cx="35%" cy="30%"><stop offset="0" stopColor={c[2]} /><stop offset=".7" stopColor={c[0]} stopOpacity=".75" /><stop offset="1" stopColor={c[1]} stopOpacity=".5" /></radialGradient>
        <radialGradient id={`n-${uid}`}><stop offset="0" stopColor={c[0]} stopOpacity=".7" /><stop offset="1" stopColor={c[0]} stopOpacity="0" /></radialGradient>
        <radialGradient id={`s-${uid}`} cx="50%" cy="50%"><stop offset="0" stopColor={c[0]} stopOpacity=".85" /><stop offset=".5" stopColor={c[1]} stopOpacity=".35" /><stop offset="1" stopColor={c[1]} stopOpacity="0" /></radialGradient>
        <linearGradient id={`f-${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={c[0]} stopOpacity="0" /><stop offset="1" stopColor={c[0]} stopOpacity=".16" /></linearGradient>
        <linearGradient id={`r-${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={c[0]} stopOpacity=".7" /><stop offset="1" stopColor={c[2]} stopOpacity="0" /></linearGradient>
        <linearGradient id={`w-${uid}`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={c[2]} stopOpacity="0" /><stop offset=".25" stopColor={c[0]} /><stop offset=".7" stopColor={c[1]} /><stop offset="1" stopColor={c[2]} stopOpacity="0" /></linearGradient>
        {series === "aurora" && [0, 1, 2].map((i) => (
          <linearGradient key={i} id={`a-${uid}-${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={c[i]} stopOpacity=".85" /><stop offset=".6" stopColor={c[i]} stopOpacity=".28" /><stop offset="1" stopColor={c[i]} stopOpacity="0" />
          </linearGradient>
        ))}
        {series === "silk" && [0, 1, 2, 3].map((i) => (
          <linearGradient key={i} id={`k-${uid}-${i}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={pc[i % 3]} stopOpacity="0" />
            <stop offset=".3" stopColor={pc[i % 3]} stopOpacity=".9" />
            <stop offset=".7" stopColor={pc[(i + 1) % 3]} stopOpacity=".85" />
            <stop offset="1" stopColor={pc[(i + 1) % 3]} stopOpacity="0" />
          </linearGradient>
        ))}
        {series === "silk" && (
          <filter id={`kblur-${uid}`} x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="6.5" /></filter>
        )}
        <filter id={`b-${uid}`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.2" /></filter>
      </defs>
      <rect width="220" height="180" fill={`url(#bg-${uid})`} />
      {art}
    </svg>
  );
}

/* ── cover artwork: the dark warm-gradient HackCover compositions above are
   the covers for every event (no photos). The credit pill on each card links
   to the event's OFFICIAL page on Devpost / Unstop / hack2skill / the
   organizer site, so the organizer always gets the click. */
export interface Credit { label: string; url: string }
const CURATED_CREDITS: Record<string, Credit> = {
  "github-universe-ai-hackathon-2026": { label: "GitHub", url: "https://github.com/universe" },
  "anthropic-claude-code-hackathon": { label: "Anthropic", url: "https://www.anthropic.com/events" },
  "nvidia-jetson-physical-ai-hackathon": { label: "NVIDIA Developer", url: "https://developer.nvidia.com/hackathon" },
  "hugging-face-open-model-hackathon": { label: "Hugging Face", url: "https://huggingface.co" },
  "devpost-hack-new-year-2027": { label: "Devpost", url: "https://devpost.com" },
  "microsoft-ai-tour-hackathon": { label: "Microsoft", url: "https://aitour.microsoft.com" },
  "nebius-x-nvidia-global-ai-hackathon": { label: "Devpost", url: "https://devpost.com/hackathons" },
  "hacktoberfest-2026": { label: "GitHub", url: "https://hacktoberfest.com" },
  "google-solution-challenge-2027": { label: "Google", url: "https://solutionchallenge.withgoogle.com" },
  "openai-build-week": { label: "OpenAI", url: "https://openai.com/devday/" },
  "meta-global-ai-developer-hackathon": { label: "Meta", url: "https://dev.meta.ai" },
  "mlh-global-hack-week": { label: "MLH", url: "https://mlh.io" },
  "google-cloud-agents-for-impact": { label: "Google Cloud", url: "https://cloud.google.com/resources" },
  "ai-builder-cup-2026": { label: "hack2skill", url: "https://hack2skill.com" },
  "smart-india-hackathon-2026": { label: "Smart India Hackathon", url: "https://sih.gov.in" },
  "microsoft-imagine-cup-2027": { label: "Microsoft", url: "https://imaginecup.microsoft.com" },
  "hackon-with-amazon": { label: "Unstop", url: "https://unstop.com/hackathons" },
  "kaggle-playground-series": { label: "Kaggle", url: "https://www.kaggle.com/competitions" },
};
/* every event gets a credit: the curated table, its Devpost listing url, or the live object's own url */
export const creditFor = (h: Hack): Credit =>
  CURATED_CREDITS[h.id] ?? LIVE_CREDITS[h.id] ?? { label: "Devpost", url: hackLink(h) };

/* ── shelf card, reused on Home and the list page. The whole card links to the
   prep plan; the "cover ©" pill is a sibling of the stretched link and opens
   the artwork credit + a jump to the official event page. ── */
export function HackCard({ h }: { h: Hack }) {
  const [label, cls] = HACK_STATUS[h.status];
  const d = daysTo(h.deadline);
  const [showCredit, setShowCredit] = useState(false);
  const cr = creditFor(h);
  const art = HACK_ART[h.id];
  const coverCls = "absolute inset-0 -z-20 w-full h-full transition-transform duration-[900ms] ease-out group-hover:scale-[1.06]";
  return (
    <div className="group relative rounded-[22px] overflow-hidden flex flex-col min-h-[430px] text-foam isolate bg-coffee border border-bean transition-all duration-300 hover:-translate-y-[7px] hover:shadow-[0_34px_66px_-22px_rgba(34, 26, 19,.55)]">
      {art
        ? <Image src={art} alt="" aria-hidden width={660} height={440} sizes="(max-width: 768px) 100vw, 420px" className={`${coverCls} object-cover`} />
        : <HackCover h={h} className={coverCls} />}
      <span className={`absolute inset-0 -z-10 bg-gradient-to-b ${art ? "from-white/30 via-coffee/55 to-[#0f1012]/95" : "from-coffee/25 via-coffee/55 to-[#0f1012]/95"}`} />
      <div className="flex items-center justify-between gap-2 px-5 pt-[18px]">
        <span className="w-11 h-11 rounded-xl bg-white grid place-items-center overflow-hidden shadow-[0_8px_18px_-6px_rgba(0,0,0,.5)]">
          <OrgImg src={avatarOf(h.orgLogo, 64)} name={h.orgLogo} className="w-[30px] h-[30px] object-contain" />
        </span>
        <span className={`font-mono text-[9.5px] font-bold tracking-[.1em] uppercase px-3 py-[5px] rounded-full border ${cls}`}>{label}</span>
      </div>
      <div className="mt-auto p-5 flex flex-col gap-2.5">
        <span className="font-mono text-[10.5px] tracking-[.1em] uppercase text-foam/70">{h.org}</span>
        <h3 className="card-title-xl text-white">{h.name}</h3>
        <p className="text-foam/75 text-[13.5px] leading-[1.6]">{h.theme}</p>
        <div className="flex items-center justify-between gap-2.5 mt-1.5">
          <span className="font-mono text-[13px] font-bold text-white">{h.prize.split("+")[0]}
            <small className="block text-[9.5px] font-medium text-foam/55 tracking-[.08em] uppercase">{h.status === "open" || h.status === "rolling" ? (d > 0 ? `closes in ${d} days` : "closing") : `deadline ${h.deadline.slice(0, 7)}`}</small></span>
          <span className="inline-flex items-center gap-2 text-[12.5px] font-bold text-white bg-white/10 border border-white/20 rounded-full px-3.5 py-[7px] group-hover:bg-accent group-hover:border-accent transition-colors">Prep plan</span>
        </div>
      </div>
      <div className="border-t border-white/10 px-5 py-3 flex items-center gap-3.5 font-mono text-[10.5px] text-foam/60">
        <span>Scale · <b className="text-white font-semibold">{h.participants}</b></span>
        <span>Format · <b className="text-white font-semibold">{h.format.split(":")[0]}</b></span>
      </div>
      <Link to={`/hackathons/${h.id}`} aria-label={`${h.name} prep plan`}
        className="absolute inset-0 z-10 rounded-[22px] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent" />
      <button type="button" onClick={() => setShowCredit((v) => !v)} aria-label="Event credit"
        className="absolute right-3.5 bottom-[42px] z-20 font-mono text-[9px] font-bold tracking-[.08em] uppercase text-foam/65 bg-[#0f1012]/65 border border-white/20 rounded-full px-2.5 py-[4px] hover:text-white hover:border-accent cursor-pointer transition-colors">
        event ©
      </button>
      {showCredit && (
        <div className="absolute right-3.5 bottom-[68px] z-30 w-[250px] bg-card border border-line rounded-[14px] shadow-lift p-3.5 text-ink">
          <p className="font-mono text-[9.5px] font-bold uppercase tracking-[.12em] text-dim mb-1.5">Event credit</p>
          <p className="text-[12.5px] leading-[1.55]">
            {h.name} is organized by {h.org} - listing, artwork and marks belong to the organizer on {cr.label}.{" "}
            <a href={cr.url} target="_blank" rel="noopener" className="text-accent font-semibold hover:underline">Official page</a>
          </p>
          <button type="button" onClick={() => setShowCredit(false)} className="mt-2 font-mono text-[10px] font-bold uppercase tracking-[.1em] text-dim hover:text-rust cursor-pointer">Close</button>
        </div>
      )}
    </div>
  );
}

/* ── list page ── */
export default function Hackathons() {
  const [params, setParams] = useSearchParams();
  const STATUS_VALUES = ["all", "open", "upcoming", "closed"] as const;
  const rawStatus = params.get("status");
  const [q, setQ] = useState(params.get("q") ?? "");
  const [status, setStatus] = useState<"all" | Hack["status"]>(
    STATUS_VALUES.includes(rawStatus as any) ? (rawStatus as "all" | Hack["status"]) : "all"
  );
  const [tag, setTag] = useState(params.get("tag") ?? "all");

  const setQUrl = (v: string) => { setQ(v); setParams({ q: v }); };
  const setStatusUrl = (v: "all" | Hack["status"]) => { setStatus(v); setParams({ status: v }); };
  const setTagUrl = (v: string) => { setTag(v); setParams({ tag: v }); };
  const clearUrl = () => { setQ(""); setStatus("all"); setTag("all"); setParams({}); };

  const hotTags = useMemo(() => {
    const c: Record<string, number> = {};
    ALL_HACKS.forEach((h) => h.tags.forEach((t) => { c[t] = (c[t] ?? 0) + 1; }));
    return Object.entries(c).filter(([t, n]) => n >= 3 && t !== "hackathon").sort((a, b) => b[1] - a[1]).slice(0, 10).map(([t]) => t);
  }, []);

  const list = useMemo(() => ALL_HACKS.filter((h) =>
    (status === "all" || h.status === status) &&
    (tag === "all" || h.tags.includes(tag)) &&
    (!q.trim() || (h.name + " " + h.org + " " + h.theme + " " + h.tags.join(" ")).toLowerCase().includes(q.trim().toLowerCase()))
  ), [q, status, tag]);

  const fin = "w-full bg-paper border border-line rounded-xl px-3.5 py-2.5 text-[14px] outline-none transition-all focus:border-accent focus:shadow-[0_0_0_3px_rgba(180, 96, 44,.12)]";

  return (
    <div className="max-w-[1240px] mx-auto px-6 pt-14 pb-4">
      <h1 className="font-display font-extrabold tracking-[-.02em] leading-[1.08] text-[clamp(38px,4.8vw,58px)]">
        Top <Word>hackathons</Word>, decoded.
      </h1>
      <p className="text-ink font-medium mt-4 text-[16.5px] leading-[1.6] max-w-[620px]">
        Every event decoded - deadlines, prep plan, judging strategy and the right stack.
      </p>

      <div className="flex gap-3 items-center flex-wrap mt-8">
        <input className={`${fin} !w-[320px] max-[640px]:w-full`} placeholder="Search hackathons - “ai”, “nvidia”, “web3”…" value={q} onChange={(e) => setQUrl(e.target.value)} aria-label="Search hackathons" />
        <div className="flex gap-1.5 flex-wrap ml-auto max-[900px]:ml-0" role="group" aria-label="Filter by status">
          {(["all", "open", "upcoming", "closed"] as const).map((s) => (
            <button key={s} onClick={() => setStatusUrl(s)}
              className={`font-mono text-[11px] font-semibold rounded-full px-3.5 py-2 border transition-all cursor-pointer ${status === s ? "bg-coffee border-coffee text-foam" : "bg-paper border-line text-cocoa hover:border-accent hover:text-rust"}`}>
              {s === "all" ? `All · ${ALL_HACKS.length}` : `${s} · ${ALL_HACKS.filter((h) => h.status === s).length}`}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-1.5 flex-wrap mt-3" role="group" aria-label="Filter by theme">
        <button onClick={() => setTagUrl("all")} className={`text-[12px] font-semibold rounded-full px-3 py-1.5 border transition-all cursor-pointer ${tag === "all" ? "bg-accent border-accent text-white" : "bg-card border-line text-cocoa hover:border-accent hover:text-rust"}`}>Any theme</button>
        {hotTags.map((t) => (
          <button key={t} onClick={() => setTagUrl(tag === t ? "all" : t)} className={`text-[12px] font-semibold rounded-full px-3 py-1.5 border transition-all cursor-pointer ${tag === t ? "bg-accent border-accent text-white" : "bg-card border-line text-cocoa hover:border-accent hover:text-rust"}`}>#{t}</button>
        ))}
      </div>

      <p className="font-mono text-[11.5px] tracking-[.1em] uppercase text-cocoa mt-7 mb-5">
        <b className="text-accent">{list.length}</b> hackathon{list.length === 1 ? "" : "s"} shown
        {(q || status !== "all" || tag !== "all") && (
          <button className="normal-case tracking-normal font-semibold text-accent ml-3 hover:underline cursor-pointer" onClick={() => clearUrl()}>Clear filters</button>
        )}
      </p>
      {list.length ? (
        <div className="grid grid-cols-3 gap-4 max-[1100px]:grid-cols-2 max-[700px]:grid-cols-1">
          {list.map((h) => <HackCard key={h.id} h={h} />)}
        </div>
      ) : (
        <div className="text-center py-16 text-dim border border-dashed border-line rounded-[22px] bg-cream">
          No hackathon matches those filters. <button className="text-accent font-semibold hover:underline cursor-pointer" onClick={() => clearUrl()}>Clear filters</button>
        </div>
      )}
    </div>
  );
}

/* ── detail: the full prep plan ── */
function Block({ tag, title, children }: { tag: string; title: string; children: ReactNode }) {
  return (
    <section className="mt-9">
      <SectionTag>{tag}</SectionTag>
      <h2 className="font-display font-extrabold tracking-[-.02em] text-[26px] mt-2">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function HackathonDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const h = ALL_HACKS.find((x) => x.id === id);
  if (!h) {
    return (
      <div className="max-w-[720px] mx-auto px-6 py-24 text-center">
        <h1 className="font-display font-extrabold text-[30px]">Hackathon not found</h1>
        <p className="text-cocoa mt-3">That edition drifted off the calendar. The current shelf is one click away.</p>
        <Link className={btn("primary", "md", "mt-6")} to="/hackathons">All hackathons</Link>
      </div>
    );
  }
  const [label, cls] = HACK_STATUS[h.status];
  const d = daysTo(h.deadline);
  const deadlineLabel = new Date(h.deadline).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
  const skills = REPOS.slice().sort(byStars).filter((r) => h.tags.some((t) => r.tags.includes(t)) || h.stack.frameworks.some((f) => r.tags.includes(f.toLowerCase()) || r.desc.toLowerCase().includes(f.toLowerCase()))).slice(0, 6);

  return (
    <div className="max-w-[1240px] mx-auto px-6 pt-10 pb-4">
      <button onClick={() => nav("/hackathons")} className="font-mono text-[11px] tracking-[.1em] uppercase text-dim hover:text-rust cursor-pointer transition-colors">← All hackathons</button>

      {/* hero */}
      <div className="grid grid-cols-[1.15fr_.85fr] gap-8 mt-5 items-stretch max-[1020px]:grid-cols-1">
        <div>
          <div className="flex items-center gap-4 flex-wrap">
            <span className="w-[54px] h-[54px] rounded-[15px] bg-card border border-line grid place-items-center shadow-soft overflow-hidden">
              <OrgImg src={avatarOf(h.orgLogo, 96)} name={h.orgLogo} className="w-[34px] h-[34px] object-contain" />
            </span>
            <div className="min-w-0">
              <h1 className="font-display font-extrabold tracking-[-.02em] text-[clamp(26px,3.4vw,42px)] leading-[1.08]">{h.name}</h1>
              <span className="text-cocoa text-[14px]">{h.org}</span>
            </div>
            <span className={`font-mono text-[10px] font-bold tracking-[.1em] uppercase px-3 py-[6px] rounded-full border ${cls} !text-rust !border-accent/40 !bg-peach`}>{label}{d > 0 && h.status !== "recurring" ? ` · ${d}d left` : ""}</span>
          </div>
          <p className="text-[16px] leading-[1.7] text-ink mt-5 max-w-[560px]">{h.theme}.</p>
          <div className="grid grid-cols-2 gap-3 mt-6 max-[640px]:grid-cols-1">
            {([["Deadline", deadlineLabel], ["Scale", h.participants + " builders"], ["Format", h.format], ["Eligibility", h.eligibility]] as [string, string][]).map(([k, v]) => (
              <div key={k} className="bg-card border border-line rounded-[16px] p-4 shadow-soft">
                <span className="font-mono text-[10px] tracking-[.12em] uppercase text-dim">{k}</span>
                <p className="text-[13.5px] font-semibold text-ink mt-1.5 leading-snug">{v}</p>
              </div>
            ))}
          </div>
          {h.estimated && <p className="font-mono text-[10.5px] text-dim mt-3">Dates marked estimated are best-known projections; confirm on the organizer page before booking travel.</p>}
        </div>
        {/* event brief - a typographic UI panel, no cover art on the detail page */}
        <div className="rounded-[22px] border border-bean bg-gradient-to-b from-coffee to-bean shadow-lift min-h-[280px] p-6 flex flex-col text-foam">
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-[10px] tracking-[.14em] uppercase text-foam/60">The brief</span>
            <span className={`font-mono text-[10px] font-bold tracking-[.1em] uppercase px-3 py-[6px] rounded-full border ${cls}${h.status === "closed" ? " !text-foam/70 !border-white/15 !bg-white/5" : ""}`}>{label}</span>
          </div>
          <p className="font-display font-extrabold tracking-[-.02em] text-[clamp(30px,3.6vw,46px)] leading-[1.08] mt-6">{h.prize}</p>
          <p className="font-mono text-[10px] tracking-[.14em] uppercase text-foam/55 mt-1.5">prize pool at stake</p>
          {h.status === "closed" ? (
            <p className="text-[13.5px] text-foam/80 mt-6 leading-relaxed">This edition has wrapped. Winners and projects live on the organizer page below.</p>
          ) : h.status === "recurring" ? (
            <p className="text-[13.5px] text-foam/80 mt-6 leading-relaxed">Runs every year - the next window opens around {deadlineLabel}.</p>
          ) : d > 0 ? (
            <div className="flex items-end gap-3.5 mt-6">
              <span className="font-display font-extrabold text-[52px] leading-[.9] text-honey">{d}</span>
              <span className="text-[13px] leading-snug text-foam/85 pb-1">days left<br /><span className="font-mono text-[10.5px] text-foam/60">closes {deadlineLabel}</span></span>
            </div>
          ) : (
            <p className="text-[13.5px] text-foam/80 mt-6 leading-relaxed">Deadline {deadlineLabel} - check the organizer page for the current window.</p>
          )}
          <div className="h-px bg-white/10 my-5" />
          <div className="flex gap-1.5 flex-wrap">{h.tags.map((t) => <span key={t} className="font-mono text-[10px] font-semibold text-foam/80 border border-white/20 bg-white/10 rounded-full px-2.5 py-1">#{t}</span>)}</div>
          {(() => { const cr = creditFor(h); return (
            <p className="font-mono text-[9.5px] text-foam/55 mt-auto pt-4">
              {h.name} by {h.org} - listing and marks belong to the organizer on {cr.label} ·{" "}
              <a href={cr.url} target="_blank" rel="noopener" className="text-foam/90 underline decoration-white/30 hover:text-white">Official page</a>
            </p>
          ); })()}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-8 mt-4 items-start max-[1020px]:grid-cols-1">
        <div>
          <Block tag="The calendar" title="Key timelines">
            <ol className="relative grid gap-0 list-none border-l-2 border-liness ml-[7px]">
              {h.timeline.map((p, i) => (
                <li key={p.label} className="pl-7 pb-7 relative last:pb-1">
                  <span className="absolute -left-[9px] top-0.5 w-[16px] h-[16px] rounded-full border-[3px] bg-card" style={{ borderColor: i === 0 ? "var(--color-accent)" : "var(--color-line)" }} />
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <b className="font-display text-[15.5px]">{p.label}</b>
                    <span className="font-mono text-[11px] text-rust font-semibold">{p.when}</span>
                  </div>
                  <p className="text-cocoa text-[13.5px] mt-1 leading-[1.55]">{p.note}</p>
                </li>
              ))}
            </ol>
          </Block>

          <Block tag="Weeks before" title="How to prepare">
            <ul className="grid gap-2.5 list-none">
              {h.prep.map((p) => (
                <li key={p} className="flex gap-3 text-[14px] leading-[1.6] text-cocoa">
                  <span className="mt-[7px] w-[7px] h-[7px] rounded-[3px] shrink-0" style={{ background: h.color }} />{p}
                </li>
              ))}
            </ul>
          </Block>

          <Block tag="During + judging" title="How to approach it">
            <ul className="grid gap-2.5 list-none">
              {h.approach.map((p) => (
                <li key={p} className="flex gap-3 text-[14px] leading-[1.6] text-cocoa">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="var(--color-leaf)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="mt-[4px] shrink-0"><path d="m4.5 12.5 5 5 10-11" /></svg>{p}
                </li>
              ))}
            </ul>
          </Block>

          <Block tag="From the cyrus bench" title="Ideas that fit this brief">
            <div className="grid grid-cols-3 gap-3.5 max-[900px]:grid-cols-1">
              {h.ideas.map((idea) => (
                <div key={idea.title} className="bg-card border border-line rounded-[16px] p-[18px] shadow-soft hover:-translate-y-1 hover:border-ember transition-all">
                  <b className="font-display text-[15px] block">{idea.title}</b>
                  <p className="text-cocoa text-[13px] leading-[1.6] mt-1.5">{idea.pitch}</p>
                </div>
              ))}
            </div>
            <p className="font-mono text-[10.5px] text-dim mt-3">Original directions drafted by cyrus for this brief - build them, or fork one into your own.</p>
          </Block>

          <Block tag="What winners run" title="Ideal tech stack">
            <div className="bg-card border border-line rounded-[18px] p-5 shadow-soft">
              {([["Languages", h.stack.languages], ["Frameworks", h.stack.frameworks], ["Tools & platforms", h.stack.tools]] as [string, string[]][]).map(([k, arr]) => (
                <div key={k} className="flex items-center gap-2 flex-wrap py-2 border-b border-liness last:border-0">
                  <span className="font-mono text-[10.5px] tracking-[.1em] uppercase text-dim w-[130px] shrink-0 max-[640px]:w-full">{k}</span>
                  {arr.map((s) => <Chip key={s} tone="lang">{s}</Chip>)}
                </div>
              ))}
              <p className="text-cocoa text-[13.5px] leading-[1.6] mt-3 italic">"{h.stack.why}"</p>
            </div>
          </Block>
        </div>

        <aside className="sticky top-[90px] max-[1020px]:static grid gap-4">
          <div className="bg-coffee text-foam rounded-[20px] p-6 shadow-lift">
            <p className="font-mono text-[10.5px] tracking-[.12em] uppercase text-ember">Register at the source</p>
            <a href={hackLink(h)} target="_blank" rel="noopener" className={btn("primary", "lg", "w-full mt-3")}>Open {h.orgLogo === "unstop" ? "Unstop" : h.orgLogo === "mlh" ? "MLH" : h.orgLogo === "kaggle" ? "Kaggle" : (h as HackLive).url ? "Devpost" : "official page"}</a>
            <p className="text-[12px] text-foam/60 mt-3 leading-[1.55]">{h.perks}</p>
          </div>

          <div className="bg-card border border-line rounded-[20px] p-5">
            <h3 className="panel-h mb-1.5">Skills for this stack</h3>
            <p className="text-[12px] text-dim mb-3 leading-relaxed">Install these from the catalog so your agent builds on the winning stack from hour one.</p>
            <ul className="grid gap-2.5 list-none">
              {skills.map((s) => (
                <li key={s.repo}>
                  <Link to={`/repo/${encodeURIComponent(s.repo)}`} className="flex items-center gap-2.5 text-[13px] font-semibold text-cocoa hover:text-rust transition-colors min-w-0">
                    <OrgImg src={avatarOf(s.repo.split("/")[0], 48)} name={s.repo} className="w-[22px] h-[22px] rounded-[6px] bg-sand object-cover shrink-0" />
                    <span className="truncate">{s.repo.split("/")[1]}</span>
                    <span className="ml-auto font-mono text-[10.5px] text-honey shrink-0">{Math.round(s.stars / 100) / 10}k</span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link to={`/projects?q=${h.tags[0]}`} className="font-mono text-[10.5px] font-bold tracking-[.08em] uppercase text-accent hover:text-rust mt-3 inline-block">Browse all #{h.tags[0]} skills</Link>
          </div>

          <div className="bg-card border border-line rounded-[20px] p-5">
            <h3 className="panel-h mb-1.5">Prep with the shelf</h3>
            <ul className="grid gap-2 list-none text-[13px]">
              <li><Link className="text-cocoa hover:text-rust font-semibold" to="/resources">Learning resources by company</Link></li>
              <li><Link className="text-cocoa hover:text-rust font-semibold" to="/#roadmap">The 6-step contributor blueprint</Link></li>
              <li><Link className="text-cocoa hover:text-rust font-semibold" to="/organizations">Study the organizer's repos</Link></li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
