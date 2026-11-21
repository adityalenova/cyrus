/* ══ /api/me/saved — cross-device saved items ═══════════════════
   GET    -> every saved row for this session's user
   POST   -> { itemType, itemId, title?, meta? } - idempotent add
   PATCH  -> { itemType, itemId, title }         - rename one row
   DELETE -> { itemType, itemId }                - returns removed flag

   Everything here is scoped to the session: the user id is read from the
   cookie, never from the body, and every helper takes it as its first
   argument so it lands in the SQL predicate.

   A "search" row is the issue finder's question, not its answer: the name
   the contributor typed plus the normalised filters. That is the one type
   with rules of its own, because a stored search is the only payload this
   site replays - so the shape is checked before it is written.
   ═══════════════════════════════════════════════════════════════ */
import { currentUser } from "@/lib/server/auth";
import {
  addSaved, listSaved, removeSaved, renameSaved,
  validId, validItemType, type ITEM_TYPES,
} from "@/lib/server/queries";
import { canonicalFilters, clipName, searchFiltersError, searchNameError } from "@/lib/savedSearches";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const unauthorized = () => Response.json({ error: "signed out" }, { status: 401 });
const bad = (msg: string) => Response.json({ error: msg }, { status: 400 });

type ItemTypeOf = (typeof ITEM_TYPES)[number];

async function user() {
  return currentUser();
}

/** the name a search row carries, or null when it is not a usable one */
function searchName(title: unknown): string | null {
  return searchNameError(title) ? null : clipName(title);
}

export async function GET() {
  const u = await user();
  if (!u) return unauthorized();
  const items = await listSaved(u.id);
  return Response.json({
    items: items.map((i) => ({ itemType: i.itemType, itemId: i.itemId, title: i.title, meta: i.meta, createdAt: i.createdAt })),
  });
}

export async function POST(req: Request) {
  const u = await user();
  if (!u) return unauthorized();
  let body: { itemType?: unknown; itemId?: unknown; title?: unknown; meta?: unknown };
  try { body = await req.json(); } catch { return bad("JSON body required"); }
  if (!validItemType(body.itemType) || !validId(body.itemId)) return bad("itemType or itemId is invalid");

  let title = typeof body.title === "string" ? body.title.slice(0, 200) : null;
  let meta = body.meta;

  if (body.itemType === "search") {
    const name = searchName(body.title);
    if (!name) return bad("a saved search needs a name of at most 80 characters");
    const filters = isObject(meta) ? meta.filters : undefined;
    const err = searchFiltersError(filters);
    if (err) return bad(err);
    title = name;
    /* only the filters go on the row, and only in the shape the finder
       itself would write, so a replay cannot smuggle anything along */
    meta = { filters: canonicalFilters(filters) };
  }

  const row = await addSaved(u.id, body.itemType as ItemTypeOf, body.itemId, title, meta);
  return Response.json({ ok: true, item: row ? { itemType: row.itemType, itemId: row.itemId, title: row.title } : null });
}

/* PATCH is the rename: the search's id and filters stay put, its name does
   not. Same three columns the row is unique on, and the session's user id,
   so another account's search is simply not matched. */
export async function PATCH(req: Request) {
  const u = await user();
  if (!u) return unauthorized();
  let body: { itemType?: unknown; itemId?: unknown; title?: unknown };
  try { body = await req.json(); } catch { return bad("JSON body required"); }
  if (!validItemType(body.itemType) || !validId(body.itemId)) return bad("itemType or itemId is invalid");

  let name: string | null;
  if (body.itemType === "search") {
    name = searchName(body.title);
    if (!name) return bad("a saved search needs a name of at most 80 characters");
  } else {
    if (typeof body.title !== "string" || !body.title.trim()) return bad("title is required");
    name = body.title.trim().slice(0, 200);
  }

  const row = await renameSaved(u.id, body.itemType as ItemTypeOf, body.itemId, name);
  if (!row) return Response.json({ error: "item not found" }, { status: 404 });
  return Response.json({ ok: true, item: { itemType: row.itemType, itemId: row.itemId, title: row.title } });
}

export async function DELETE(req: Request) {
  const u = await user();
  if (!u) return unauthorized();
  let body: { itemType?: unknown; itemId?: unknown };
  try { body = await req.json(); } catch { return bad("JSON body required"); }
  if (!validItemType(body.itemType) || !validId(body.itemId)) return bad("itemType or itemId is invalid");
  const removed = await removeSaved(u.id, body.itemType as ItemTypeOf, body.itemId);
  return Response.json({ ok: true, removed });
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
