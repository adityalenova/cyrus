/* ══ GET /api/catalog/repos — filterable project listing ════════
   Query params: cat, q, domain, model, format, framework, page, per.
   Backs the /projects 4-group filter once the classifier fills the
   array columns; unknown params are ignored, values are bound.      ═ */
import { OFFLINE, backendReady } from "@/lib/server/auth";
import { queryRepos } from "@/lib/server/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CATS = ["skills", "cursor", "agentsmd", "mcp", "tools"];

export async function GET(req: Request) {
  if (!backendReady()) return OFFLINE();
  const p = new URL(req.url).searchParams;
  const cat = p.get("cat") ?? undefined;
  if (cat && !CATS.includes(cat)) return Response.json({ error: `cat must be one of ${CATS.join(", ")}` }, { status: 400 });
  const page = Math.min(500, Math.max(1, Number(p.get("page") ?? 1) || 1));
  const per = Math.min(60, Math.max(1, Number(p.get("per") ?? 24) || 24));
  const word = (k: string) => (p.get(k) ?? "").replace(/[^a-z0-9+#._-]/gi, "").slice(0, 40) || undefined;
  try {
    const { rows, total } = await queryRepos({
      cat,
      q: word("q")?.replace(/[%_]/g, ""),
      domain: word("domain"),
      model: word("model"),
      format: word("format"),
      framework: word("framework"),
      page,
      perPage: per,
    });
    const pages = Math.max(1, Math.ceil(total / per));
    return Response.json({ total, page, per, pages, repos: rows });
  } catch (e) {
    return Response.json({ error: `query failed: ${(e as Error).message}` }, { status: 500 });
  }
}
