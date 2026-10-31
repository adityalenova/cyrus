"use client"
/* ══ AuthCanvas.tsx — the sign-in panel's left half ═══════════════
   A graphite plate: a dashed hairline grid, a brighter crosshair every four
   cells, and the mark sitting in a dark tile with a soft bloom behind it.
   Measured from the reference rather than eyeballed (scratch/auth-measure.mjs
   reads the supplied screenshot):

     canvas        #161612, with the middle lifted about 4 luminance points
     grid          34px module, 1px lines, dash 9 / gap 8, ~5.5% white
     crosshair     + at every 4th intersection (136px), ~16% white
     tile          153px on an 864px plate (18%), corner radius 26px (17% of the
                   side), fill #0f0d0c - three points darker than the plate
     mark          59% of the tile, brushed silver: bright at the top-left,
                   mid-grey at the bottom-right

   Everything here stays dark in both themes. The plate is the one place on the
   site that is a lit object on a dark ground rather than text on paper, and the
   form column keeps the visitor's own theme, so the split reads as a cover page
   rather than as a half-styled form.
   ══ */
import { motion } from "framer-motion";
import { Logo } from "./ui";

/** 34px module in the reference; the plate here is wider than the reference
 *  crop, so the same module keeps the grid as quiet as it is there. */
const CELL = 34;
/** A crosshair lands on every 4th intersection, i.e. once per 4x4 cells. */
const CROSS = CELL * 4;

export default function AuthCanvas() {
  const easeSilk = [0.22, 1, 0.36, 1] as const;
  return (
    <div className="relative flex items-center justify-center overflow-hidden auth-plate max-[900px]:hidden">
      {/* the grid, and the crosshairs over it */}
      <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <pattern id="auth-grid" width={CELL} height={CELL} patternUnits="userSpaceOnUse">
            <path d={`M${CELL} 0V${CELL}M0 ${CELL}H${CELL}`} fill="none"
              stroke="rgba(255,255,255,.055)" strokeWidth="1" strokeDasharray="9 8" />
          </pattern>
          <pattern id="auth-cross" width={CROSS} height={CROSS} patternUnits="userSpaceOnUse">
            <path d={`M${CELL * 2} ${CELL * 2 - 6}v12M${CELL * 2 - 6} ${CELL * 2}h12`} fill="none"
              stroke="rgba(255,255,255,.16)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#auth-grid)" />
        <rect width="100%" height="100%" fill="url(#auth-cross)" />
      </svg>

      {/* the bloom behind the tile, then the tile itself */}
      <div className="relative">
        <motion.div className="mark-tile relative grid place-items-center"
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: easeSilk, delay: 0.05 }}>
          <span aria-hidden className="auth-halo" />
          <Logo size={112} tone="steel" />
        </motion.div>
        {/* the reference's tile is not labelled; this one says what it is, in
            the same hairline voice as the grid */}
        <p className="auth-caption mt-9 text-center font-mono text-[10.5px] uppercase tracking-[.22em] text-white/28">
          cyrus<span className="text-white/14"> · </span>open source, mapped
        </p>
      </div>
    </div>
  );
}
