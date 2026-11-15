/* ══ scripts/fetch-outreachy-communities.mjs — every community Outreachy names ═
   node scripts/fetch-outreachy-communities.mjs

   Outreachy's project archive only tells us which communities ran an internship
   in the rounds we crawled. outreachy.org/communities/cfp/ publishes the wider
   list directly, in three labelled sections:

     "Mentoring Communities"              - participating in the current round;
     "Not Participating FOSS Communities" - signed up but cut from this round;
     "Past Communities"                   - ran a past round, or applied to.

   The third section is the one that matters for a roster, and its own wording is
   careful: "have participated in past rounds, OR submitted an application to
   participate". We keep that distinction in the section field and say the same
   thing on the page instead of claiming every entry shipped an intern.

   Output: public/data/outreachy-communities.json.                      ═ */
import { writeFileSync, renameSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public/data/outreachy-communities.json");
const PAGE = "https://www.outreachy.org/communities/cfp/";

const SECTIONS = [
  ["current", "Mentoring Communities", "Not Participating FOSS Communities"],
  ["declined", "Not Participating FOSS Communities", "Past Communities"],
  ["past", "Past Communities", "Questions?"],
];

const get = async (url, tries = 3) => {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { accept: "text/html", "user-agent": "cyrus.ai directory roster check" } });
      if (r.ok) return await r.text();
      if (r.status < 500 && r.status !== 429) throw new Error(`outreachy.org ${r.status}`);
    } catch (e) {
      if (i === tries - 1) throw e;
    }
    await new Promise((r) => setTimeout(r, 1200 * (i + 1)));
  }
  return "";
};

const strip = (s) => String(s ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

/* one round block per community link; the anchor text is the community name */
function parse(html) {
  const round = strip(
    (html.match(/participating in the ([A-Z][a-z]+ \d{4}) internship/) || [])[1] ||
    (html.match(/in the ([A-Z][a-z]+ \d{4}) to ([A-Z][a-z]+ \d{4}) internship round/) || []).slice(1, 3).join(" to ")
  ) || null;
  const bySlug = new Map();
  for (const [key, from, to] of SECTIONS) {
    const i = html.indexOf(from);
    if (i < 0) continue;
    const j = html.indexOf(to, i);
    const seg = html.slice(i, j > i ? j : undefined);
    for (const m of seg.matchAll(/href="\/communities\/cfp\/([a-z0-9-]+)\/"[^>]*>([^<]{2,70})</g)) {
      const name = strip(m[2]);
      if (!name || name.toLowerCase() === "cfp") continue;
      if (!bySlug.has(m[1])) bySlug.set(m[1], { slug: m[1], name, section: key });
    }
  }
  return { round, communities: [...bySlug.values()] };
}

const main = async () => {
  const html = await get(PAGE);
  if (html.length < 5000) throw new Error("outreachy.org returned an unexpectedly small page - refusing to write");
  const { round, communities } = parse(html);
  if (communities.length < 100) throw new Error(`only ${communities.length} communities parsed - the page structure changed, refusing to write`);

  const by = { current: 0, declined: 0, past: 0 };
  for (const c of communities) by[c.section] += 1;

  const file = {
    generated: new Date().toISOString().slice(0, 10),
    source: PAGE,
    round,
    note: "Outreachy publishes this list itself. current means approved for the named round, declined means signed up but cut from it, and past covers communities that ran an earlier round or applied to participate - the site says so rather than implying every one shipped an intern.",
    communities: communities.sort((a, b) => a.name.localeCompare(b.name)),
  };
  const tmp = OUT + ".tmp";
  writeFileSync(tmp, JSON.stringify(file, null, 1));
  renameSync(tmp, OUT);

  console.log(`Outreachy communities: ${communities.length} named (${JSON.stringify(by)}) for the ${round ?? "current"} round`);
};

main().catch((e) => { console.error(e); process.exit(1); });
