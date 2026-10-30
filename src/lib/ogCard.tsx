/* ══ ogCard.tsx — renders a 1200x630 share card with ImageResponse ═══
   Satori only lays out with flex, wants every string inside a <span>, and
   needs real font bytes, so this file is deliberately un-Tailwind: inline
   styles, vendored TTFs, no network at build. The palette values are the
   same tokens globals.css binds (--color-paper, --color-ink, --color-accent,
   --color-ember, --color-rust), copied as literals because a server image
   route cannot read a CSS custom property.                             ══ */
import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { OgCard as OgCardData } from "@/lib/ogContent";
/* the brand mark - the same seven-petal rosette Logo() draws; the petal paths
   are already in their final positions, which suits satori, since it does not
   lay out an SVG group transform */
import { PETALS as OG_PETALS } from "@/lib/mark";

const PAPER = "#0e0f10";
const CREAM = "#17191b";
const SAND = "#121314";
const INK = "#eceef0";
const COCOA = "#a2a8ad";
const DIM = "#71787e";
const RULE = "#2a2d31";
const ACCENT = "#4ade80";
const RUST = "#7ee7a4";
const FOAM = "#eceef0";

const FONT_DIR = join(process.cwd(), "public", "assets", "fonts");
let cached: { regular: ArrayBuffer; display: ArrayBuffer } | null = null;

/** Read once, reuse across every card in the build. */
function fonts() {
  if (!cached) {
    const read = (file: string) => {
      try {
        return readFileSync(join(FONT_DIR, file)).buffer.slice(0) as ArrayBuffer;
      } catch {
        throw new Error(`ogCard: missing ${FONT_DIR}/${file} - the share card cannot render without the display face`);
      }
    };
    cached = { regular: read("PlusJakartaSans-400.ttf"), display: read("PlusJakartaSans-800.ttf") };
  }
  return [
    { name: "Jakarta", data: cached.regular, weight: 400 as const, style: "normal" as const },
    { name: "Jakarta", data: cached.display, weight: 800 as const, style: "normal" as const },
  ];
}

/** A share image is read at thumbnail size, so the display line has to hold
 *  its width whatever the program is called. Long single names break at the
 *  space nearest the middle rather than letting the browser drop one word. */
function layoutTitle(title: string[]): { lines: string[]; size: number } {
  if (title.length > 1) {
    const longest = title.reduce((a, b) => (b.length > a.length ? b : a), "");
    return { lines: title, size: longest.length <= 18 ? 78 : 62 };
  }
  const name = title[0];
  if (name.length <= 15) return { lines: [name], size: 76 };
  const words = name.split(" ");
  let cut = 1;
  let best = Number.POSITIVE_INFINITY;
  for (let i = 1; i < words.length; i++) {
    const left = words.slice(0, i).join(" ").length;
    const gap = Math.abs(name.length - 2 * left);
    if (gap < best) {
      best = gap;
      cut = i;
    }
  }
  return { lines: [words.slice(0, cut).join(" "), words.slice(cut).join(" ")], size: name.length <= 30 ? 62 : 52 };
}

/** The mark from components/ui.tsx, watermarked into the corner. Sized so the
 *  rosette still reads as a rosette - all seven petals, not a crop - with only
 *  its outer edge cut by the card's border. */
function Stamp() {
  return (
    <div
      style={{
        position: "absolute",
        right: -74,
        bottom: -92,
        width: 400,
        height: 400,
        display: "flex",
      }}
    >
      <svg width={400} height={400} viewBox="0 0 100 100">
        {OG_PETALS.map((d) => (
          <path key={d} d={d} fill={FOAM} opacity={0.13} />
        ))}
      </svg>
    </div>
  );
}

function Mark() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <svg width={54} height={54} viewBox="0 0 100 100">
        {OG_PETALS.map((d) => (
          <path key={d} d={d} fill={FOAM} />
        ))}
      </svg>
      <span style={{ fontSize: 33, fontWeight: 800, color: INK, letterSpacing: -0.8 }}>cyrus.ai</span>
    </div>
  );
}

export function renderOgCard(card: OgCardData): ImageResponse {
  const { lines, size } = layoutTitle(card.title);
  /* the accent colour belongs to the line the content chose to emphasise,
     not to whatever the layout had to break in half */
  const accentLast = card.title.length > 1;
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          flexDirection: "column",
          padding: "50px 72px 44px",
          position: "relative",
          overflow: "hidden",
          fontFamily: "Jakarta",
          backgroundImage: `radial-gradient(760px 520px at 94% 98%, rgba(217,133,70,0.22), rgba(245,239,231,0) 68%), linear-gradient(178deg, ${CREAM} 0%, ${PAPER} 58%, ${SAND} 100%)`,
        }}
      >
        <Stamp />

        <Mark />

        <div style={{ display: "flex", flexDirection: "column", width: 690, marginTop: 34, position: "relative" }}>
          <span
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: RUST,
              letterSpacing: 2.4,
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            {card.eyebrow}
          </span>
          {lines.map((line, i) => (
            <span
              key={line}
              style={{
                fontSize: size,
                fontWeight: 800,
                lineHeight: 1.04,
                letterSpacing: -size * 0.033,
                color: accentLast && i === lines.length - 1 ? ACCENT : INK,
              }}
            >
              {line}
            </span>
          ))}
          {card.tag ? (
            <span style={{ fontSize: 24, fontWeight: 400, color: COCOA, lineHeight: 1.35, marginTop: 16 }}>{card.tag}</span>
          ) : null}
        </div>

        <div style={{ display: "flex", flexDirection: "column", width: 690, marginTop: 26, position: "relative" }}>
          {card.rows.map((r) => (
            <div
              key={r.k}
              style={{
                display: "flex",
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "baseline",
                borderTop: `1px solid ${RULE}`,
                padding: "11px 0",
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 800, color: DIM, letterSpacing: 1.8, textTransform: "uppercase" }}>
                {r.k}
              </span>
              <span style={{ fontSize: 21, fontWeight: 400, color: INK }}>{r.v}</span>
            </div>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            marginTop: "auto",
            paddingTop: 18,
            position: "relative",
          }}
        >
          <span style={{ fontSize: 17, fontWeight: 400, color: DIM }}>{card.foot}</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630, fonts: fonts() }
  );
}
