/* ══ programs/[id]/opengraph-image.tsx — one card per program page ══
   The program name is the thing worth seeing in a share, so each detail
   page gets its own image. Stipend, window and reach are the record's own
   fields; an unknown id falls back to the home card rather than 500-ing. ══ */
import { PROGRAMS } from "@/data/orgs";
import { renderOgCard } from "@/lib/ogCard";
import { homeCard, programCard } from "@/lib/ogContent";

export const alt = "Open-source program profiled on cyrus.ai";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/* Ten programs, ten cards, all rendered during the build. Static on purpose:
 * a runtime route would have to read the vendored TTFs from inside the
 * serverless bundle, and a share image is a poor thing to lose to a missing
 * file. The catalog is regenerated nightly, so the cards refresh with it. */
export function generateStaticParams() {
  return PROGRAMS.map((p) => ({ id: p.id }));
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = PROGRAMS.find((x) => x.id === decodeURIComponent(id ?? ""));
  return renderOgCard(p ? programCard(p) : homeCard());
}
