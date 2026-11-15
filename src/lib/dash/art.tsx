"use client"
/* ══ art.tsx — the board's own artwork ═══════════════════════════════
   One line language for every drawing: 1.7 stroke, round caps and
   joins, currentColor for the structure and the signal green for the
   single thing in the picture that matters. Nothing here is filler:
   the stage glyphs draw what a stage *is*, the emblems draw what a
   page *opens*, and each scene draws the thing an empty page is
   waiting for you to put on it.                                   ═ */
import type { ReactNode } from "react";
import type { IssueStage } from "./shared";

const S = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};
/** the accent twin: same stroke, the one colour that means "this one" */
const A = { ...S, stroke: "var(--color-accent)" };
/** a faint construction line - rails, shelves, beams */
const F = { ...S, stroke: "currentColor", strokeWidth: 1.2, opacity: 0.45 };

/* ── stage glyphs ───────────────────────────────────────────────────
   24x24, drawn so the four pipeline stages read as four different
   physical acts: put it down, look closer, cut a branch, land it.  ── */
const STAGE_ART: Record<IssueStage, ReactNode> = {
  saved: (
    <>
      {/* a card put on the shelf, bookmark still sticking out */}
      <rect x="3.5" y="4.5" width="13" height="15" rx="2.5" {...S} />
      <path d="M6.5 8.5h7M6.5 11.5h4.5" {...S} />
      <path d="M16.5 4.5h3.5a.8.8 0 0 1 .8.8V19l-2.6-1.7-2.6 1.7V4.5z" {...A} />
    </>
  ),
  interested: (
    <>
      {/* read it properly: a lens over the lines */}
      <path d="M4 5.5h11M4 9h7.5M4 12.5h5" {...S} />
      <circle cx="15" cy="14" r="5" {...A} />
      <path d="M18.7 17.7 21.5 20.5" {...S} />
    </>
  ),
  working: (
    <>
      {/* a branch cut off the line, with your commit on it */}
      <path d="M6 3.5v17" {...S} />
      <path d="M6 12.5c0-4.5 3-6 7.5-6H18" {...A} />
      <circle cx="6" cy="20.5" r="2" {...S} />
      <circle cx="20" cy="6.5" r="2" {...A} />
    </>
  ),
  done: (
    <>
      {/* the branch comes home and the record is checked */}
      <path d="M6 4v16" {...S} />
      <circle cx="6" cy="20" r="2" {...S} />
      <path d="M18 4v5c0 3.5-5 3.6-9 4.5" {...S} />
      <circle cx="18" cy="4" r="2" {...S} />
      <path d="M13.5 16.5 16.1 19.1 21.5 12.9" {...A} />
    </>
  ),
};

export function StageGlyph({ stage, size = 26, className = "" }: { stage: IssueStage; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className={className}>
      {STAGE_ART[stage]}
    </svg>
  );
}

/* ── feature emblems ────────────────────────────────────────────────
   The brand's diamond, once per page, with a different mark inside.
   Keyed by FeatureId so a new board page cannot quietly reuse one.  ── */
const MARKS: Record<string, ReactNode> = {
  issues: (
    <>
      <circle cx="12" cy="12" r="7.8" {...S} />
      <circle cx="12" cy="12" r="2.6" fill="var(--color-accent)" stroke="none" />
    </>
  ),
  repos: (
    <>
      <path d="M5 4.5h10.5a2 2 0 0 1 2 2V20H7a2 2 0 0 1-2-2V4.5z" {...S} />
      <path d="M9 4.5V20" {...S} />
      <path d="M12.5 9h3M12.5 12.5h3" {...A} />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5.5" width="16" height="15" rx="2.5" {...S} />
      <path d="M4 10h16M8.5 3.5v3.5M15.5 3.5v3.5" {...S} />
      <path d="M8 13.5h.1M12 13.5h.1M16 13.5h.1M8 17h.1M12 17h.1" {...S} strokeWidth={2.4} />
      <path d="M16 17h.1" {...A} strokeWidth={2.4} />
    </>
  ),
  matcher: (
    <>
      <path d="M12 3.5l2.1 6.4 6.4 2.1-6.4 2.1L12 20.5l-2.1-6.4-6.4-2.1 6.4-2.1L12 3.5z" {...S} />
      <circle cx="12" cy="12" r="1.6" fill="var(--color-accent)" stroke="none" />
    </>
  ),
  mentors: (
    <>
      <circle cx="8.5" cy="8" r="3.2" {...S} />
      <path d="M3.5 19.5c0-3 2.3-5 5-5s5 2 5 5" {...S} />
      <circle cx="17" cy="10.5" r="2.4" {...A} />
      <path d="M15 19.5c0-2.4 1-3.8 2.8-3.8 1.6 0 2.7 1.2 2.7 3.8" {...A} />
    </>
  ),
  compare: (
    <>
      <path d="M4 20h16" {...S} />
      <rect x="5.5" y="11" width="4.5" height="9" rx="1.5" {...S} />
      <rect x="14" y="6" width="4.5" height="14" rx="1.5" {...A} />
    </>
  ),
  gitstart: (
    <>
      <path d="M7 4.5v15" {...S} />
      <path d="M7 12c0-4 2.5-5.5 6-5.5h3" {...S} />
      <circle cx="7" cy="19.5" r="2.2" {...S} />
      <circle cx="17" cy="6.5" r="2.2" {...A} />
      <path d="M13.5 17.5h6" {...A} />
    </>
  ),
  drafts: (
    <>
      <path d="M14 3.5H7a1.8 1.8 0 0 0-1.8 1.8v13.4A1.8 1.8 0 0 0 7 20.5h10a1.8 1.8 0 0 0 1.8-1.8V8.3L14 3.5z" {...S} />
      <path d="M13.6 3.8v4.6h4.8" {...S} />
      <path d="M8.5 12.5h7M8.5 16h4" {...S} />
      <path d="M15.5 16h.1" {...A} strokeWidth={2.2} />
    </>
  ),
  analyser: (
    <>
      <path d="M3 13h3.5L9 6l3.6 12L15.4 13H21" {...S} />
      <path d="M18.5 13H21" {...A} />
    </>
  ),
  demand: (
    <>
      <circle cx="12" cy="12" r="8.5" {...S} />
      <circle cx="12" cy="12" r="4.5" {...F} />
      <path d="M12 12 17 7" {...S} />
      <circle cx="15.5" cy="15.5" r="1.5" fill="var(--color-accent)" stroke="none" />
    </>
  ),
  settings: (
    <>
      {/* two rails with a knob on each - the board's own settings, not a sun */}
      <path d="M4 8.5h16M4 15.5h16" {...S} />
      <circle {...S} cx="10" cy="8.5" r="2.6" fill="var(--color-card)" />
      <circle {...A} cx="15.5" cy="15.5" r="2.6" fill="var(--color-card)" />
    </>
  ),
};

/** the diamond bed every emblem sits on - the same mark the nav uses */
const BED = <path d="M17 2.6 31.4 17 17 31.4 2.6 17 17 2.6z" fill="var(--color-accent)" opacity="0.09" stroke="var(--color-accent)" strokeOpacity="0.28" strokeWidth="1" />;

export function FeatureMark({ id, size = 34, className = "" }: { id: string; size?: number; className?: string }) {
  const mark = MARKS[id] ?? MARKS.issues;
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" aria-hidden className={className}>
      {BED}
      <g transform="translate(5 5)">{mark}</g>
    </svg>
  );
}

/* ── empty-state scenes ─────────────────────────────────────────────
   140x96 so they hold detail at 200-260px wide. Each one belongs to
   exactly one page and shows what that page looks like once it has
   work on it.                                                     ── */
const Scene = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <svg viewBox="0 0 140 96" className={"art w-full h-auto max-w-[240px] " + className} aria-hidden>
    {children}
  </svg>
);

/** My Issues: cards dropping onto the four-station pipeline */
export const ArtLedger = ({ className }: { className?: string }) => (
  <Scene className={className}>
    <path className="draw" d="M14 74h112" {...F} strokeDasharray="2 6" />
    <rect className="draw" x="8" y="12" width="42" height="26" rx="7" {...S} />
    <path d="M16 21h20M16 28h12" {...S} />
    <rect className="draw-2" x="60" y="20" width="42" height="26" rx="7" {...A} />
    <path d="M68 29h20M68 36h12" {...A} />
    <path className="draw-2" d="M29 38v22M81 46v16" {...F} strokeDasharray="2 5" />
    <circle className="pop" cx="29" cy="74" r="7" {...S} />
    <circle className="pop-2" cx="81" cy="74" r="7" {...A} />
    <circle className="pop-3" cx="123" cy="74" r="7" {...F} />
  </Scene>
);

/** My Repositories: a shelf with one slot still open */
export const ArtShelf = ({ className }: { className?: string }) => (
  <Scene className={className}>
    <path className="draw" d="M12 78h116" {...S} />
    <rect className="draw" x="20" y="30" width="17" height="48" rx="4" {...S} />
    <rect className="draw-2" x="43" y="22" width="17" height="56" rx="4" {...S} />
    <rect className="draw-3" x="66" y="38" width="17" height="40" rx="4" {...A} />
    <path d="M26 40h5M49 32h5" {...S} />
    <rect className="draw-2" x="95" y="26" width="30" height="52" rx="5" {...F} strokeDasharray="4 5" />
    <path className="pop-3" d="M110 44v16M102 52h16" {...A} />
  </Scene>
);

/** Repo analyser: a repository under the lens, readings coming off it */
export const ArtScope = ({ className }: { className?: string }) => (
  <Scene className={className}>
    <rect className="draw" x="10" y="14" width="72" height="52" rx="9" {...S} />
    <path d="M22 28h34M22 38h46M22 48h24" {...S} />
    <circle cx="18" cy="21" r="1.6" {...F} />
    <path className="draw-2" d="M58 14v52" {...A} strokeDasharray="3 5" />
    <circle className="pop" cx="98" cy="40" r="19" {...A} />
    <path className="draw-2" d="M112 54l14 14" {...S} />
    <path d="M20 84v-8M32 84v-14M44 84v-6M56 84v-11" {...S} strokeWidth={3.2} />
    <path className="pop-3" d="M68 84v-18" {...A} strokeWidth={3.2} />
  </Scene>
);

/** Git initializer: the branch you are about to cut, and land */
export const ArtBranch = ({ className }: { className?: string }) => (
  <Scene className={className}>
    <path className="draw" d="M12 66h116" {...S} />
    <path className="draw-2" d="M46 66c0-22 16-28 34-28h16" {...A} />
    <circle className="pop" cx="26" cy="66" r="6" {...S} />
    <circle className="pop-2" cx="46" cy="66" r="6" {...S} />
    <circle className="pop-2" cx="66" cy="46" r="6" {...A} />
    <circle className="pop-3" cx="96" cy="38" r="6" {...A} />
    <circle className="pop-3" cx="112" cy="66" r="6" {...S} />
    <path className="draw-3" d="M100 44c8 6 12 14 12 22" {...F} strokeDasharray="3 5" />
  </Scene>
);

/** Draft studio: the four files, one still blank */
export const ArtSheets = ({ className }: { className?: string }) => (
  <Scene className={className}>
    <g className="draw" transform="rotate(-13 44 52)">
      <rect x="18" y="20" width="46" height="60" rx="8" {...F} />
    </g>
    <g className="draw-2" transform="rotate(-6 62 52)">
      <rect x="40" y="16" width="46" height="64" rx="8" {...F} />
    </g>
    <rect className="draw-3" x="62" y="14" width="52" height="68" rx="9" {...S} />
    <path d="M74 30h20M74 40h28M74 50h22M74 60h12" {...S} />
    <path className="pop-3" d="M92 68v8" {...A} strokeWidth={2.2} />
    <path d="M104 14v10h10" {...F} />
  </Scene>
);

/** Compare orgs: two organizations on one beam */
export const ArtScales = ({ className }: { className?: string }) => (
  <Scene className={className}>
    <path className="draw" d="M70 16v56M56 76h28M70 16a5 5 0 1 0 0 .1" {...S} />
    <path className="draw-2" d="M26 28h88" {...S} />
    <path className="draw-3" d="M14 28a12 12 0 0 0 24 0" {...S} />
    <path className="draw-3" d="M102 28a12 12 0 0 0 24 0" {...A} />
    <path d="M20 44h4v8h-4zM28 40h4v12h-4z" {...S} />
    <path className="pop-3" d="M108 42h4v10h-4zM116 36h4v16h-4z" {...A} />
  </Scene>
);

/** Mentor finder: the people behind accepted projects */
export const ArtPeople = ({ className }: { className?: string }) => (
  <Scene className={className}>
    <path className="draw" d="M34 30l26 22M96 26l-22 12M60 74l26-14" {...F} strokeDasharray="3 5" />
    <circle className="pop" cx="26" cy="24" r="9" {...S} />
    <path d="M12 46c0-8 6-13 14-13s14 5 14 13" {...S} />
    <circle className="pop-2" cx="70" cy="60" r="10" {...A} />
    <path d="M54 86c0-9 7-15 16-15s16 6 16 15" {...A} />
    <circle className="pop-3" cx="108" cy="20" r="8" {...S} />
    <path d="M96 40c0-7 5-11 12-11s12 4 12 11" {...S} />
  </Scene>
);
