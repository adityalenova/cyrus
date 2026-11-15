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

   Two things this pass fixes, both of them alignment rather than decoration:

   1. The tile is centred on the plate, not merely centred on its own column.
      It used to share a shrink-wrapped box with the caption underneath, and
      because the caption is wider than the tile, the tile was left-aligned
      inside a box as wide as the text and rode up by the text's height plus
      its margin — 26px low and left at 1440x900. The caption is now taken out
      of that flow and pinned below the tile, so the tile's own box can sit
      dead centre on both axes.
   2. The field is phase-shifted so a grid crossing — and a crosshair — lands
      exactly behind the tile centre. A pattern starts at the SVG origin, which
      is the plate's top-left corner, so at any size the intersection nearest
      the middle was arbitrary. The plate is measured with a ResizeObserver and
      each pattern is offset by the remainder that pulls a line onto 50%/50%.

   Everything here stays dark in both themes. The plate is the one place on the
   site that is a lit object on a dark ground rather than text on paper, and the
   form column keeps the visitor's own theme, so the split reads as a cover page
   rather than as a half-styled form.
   ══ */
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Logo } from "./ui";

/** 34px module in the reference; the plate here is wider than the reference
 *  crop, so the same module keeps the grid as quiet as it is there. */
const CELL = 34;
/** A crosshair lands on every 4th intersection, i.e. once per 4x4 cells. */
const CROSS = CELL * 4;

/** The remainder that pulls a period-`n` field onto the plate's centre line. */
const phase = (half: number, n: number) => ((half % n) + n) % n;

export default function AuthCanvas() {
  const easeSilk = [0.22, 1, 0.36, 1] as const;
  const plate = useRef<HTMLDivElement>(null);
  /* grid and crosshair are phased separately: a crosshair sits at the middle
     of its own 136px period, so the two offsets differ by half a cell. */
  const [shift, setShift] = useState({ gridX: 0, gridY: 0, crossX: 0, crossY: 0 });

  useEffect(() => {
    const el = plate.current;
    if (!el) return;
    const measure = () => {
      const cx = el.clientWidth / 2;
      const cy = el.clientHeight / 2;
      setShift({
        gridX: phase(cx, CELL), gridY: phase(cy, CELL),
        crossX: phase(cx - CELL * 2, CROSS), crossY: phase(cy - CELL * 2, CROSS),
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={plate} className="relative overflow-hidden auth-plate max-[900px]:hidden">
      {/* the field: grid, then the crosshairs over it, both faded at the plate
          borders so the eye falls to the middle instead of the frame */}
      <svg className="auth-field absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <pattern id="auth-grid" width={CELL} height={CELL} patternUnits="userSpaceOnUse"
            x={shift.gridX} y={shift.gridY}>
            <path d={`M${CELL} 0V${CELL}M0 ${CELL}H${CELL}`} fill="none"
              stroke="rgba(255,255,255,.055)" strokeWidth="1" strokeDasharray="9 8" />
          </pattern>
          <pattern id="auth-cross" width={CROSS} height={CROSS} patternUnits="userSpaceOnUse"
            x={shift.crossX} y={shift.crossY}>
            <path d={`M${CELL * 2} ${CELL * 2 - 6}v12M${CELL * 2 - 6} ${CELL * 2}h12`} fill="none"
              stroke="rgba(255,255,255,.16)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#auth-grid)" />
        <rect width="100%" height="100%" fill="url(#auth-cross)" />
      </svg>

      {/* the optical axis: one hairline each way through the centre. The tile
          covers the middle of both, so each line reads as ending at the tile's
          edge — the registration that the caption below then names. */}
      <span aria-hidden className="auth-axis auth-axis-h" />
      <span aria-hidden className="auth-axis auth-axis-v" />

      {/* tile dead centre: the only in-flow child of a full-plate grid cell, so
          nothing beside it can push it off either axis */}
      <div className="absolute inset-0 grid place-items-center">
        <div className="relative">
          {/* four corner brackets, set off the tile by the same measure at every
              size — the plate saying where the mark is meant to sit */}
          <span aria-hidden className="auth-brackets" />
          <motion.div className="mark-tile relative grid place-items-center"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: easeSilk, delay: 0.05 }}>
            <span aria-hidden className="auth-halo" />
            <Logo tone="steel" />
          </motion.div>
        </div>
      </div>

      {/* pinned under the tile rather than stacked after it: 34px below the
          tile's own bottom edge, centred on the plate's own centre line */}
      <p className="auth-caption absolute left-1/2 -translate-x-1/2 text-center font-mono text-[10.5px] uppercase tracking-[.22em] text-white/28">
        cyrus<span className="text-white/14"> · </span>open source, mapped
      </p>
    </div>
  );
}
