"use client"
/* ══ NotFound.tsx ═══════════════════════════════════════════ */
import { Link } from "@/lib/router";
import { STATS, fmtFull } from "../lib/siteStats";
import { btn, Word } from "../components/ui";

export default function NotFound() {
  return (
    <div className="max-w-[1240px] mx-auto px-6 py-28 text-center">
      <p className="font-mono text-[11px] tracking-[.16em] uppercase text-dim mb-4">404 · not in the snapshot</p>
      <h1 className="font-display font-extrabold text-[clamp(34px,5vw,56px)] tracking-[-.02em] mb-3">
        This page <Word>moved</Word> - or never shipped.
      </h1>
      <p className="text-cocoa max-w-[440px] mx-auto text-[15.5px] leading-[1.65] mb-8">
        The URL you followed isn't part of the catalog. The {fmtFull(STATS.repos)} repos that are, all live one click away.
      </p>
      <div className="flex gap-3 justify-center flex-wrap">
        <Link to="/" className={btn("primary", "lg")}>Back to the home page</Link>
        <Link to="/skills" className={btn("outline", "lg")}>Browse skills</Link>
      </div>
    </div>
  );
}
