/* == /api/notifications/preview - the email templates, with sample content ===
   GET ?template=deadlines|new_programs|weekly_digest|mentions|replies|digest
   returns the rendered HTML of that template with made-up content and
   placeholder links. It reads nothing about any user and sends nothing, so it
   needs no sign-in; the preferences panel shows it in a frame.             == */
import { isPreviewTemplate } from "@/lib/notificationPrefs";
import { renderPreview } from "@/lib/server/notificationEmail";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const template = new URL(req.url).searchParams.get("template");
  if (!isPreviewTemplate(template)) return Response.json({ error: "unknown template" }, { status: 400 });
  const { html } = await renderPreview(template);
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300", "x-robots-tag": "noindex" },
  });
}
