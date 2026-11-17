/* ══ src/app/api/mentorship/requests/[id]/route.ts — accept/decline request ═ */

import { respondToMentorship } from "@/lib/server/mentorship";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!id) {
    return Response.json({ error: "Missing request id" }, { status: 400 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.action !== "accept" && body.action !== "decline") {
    return Response.json({ error: "Action must be 'accept' or 'decline'" }, { status: 400 });
  }

  try {
    const mentorship = await respondToMentorship({
      mentorshipId: id,
      action: body.action,
      responseMessage: typeof body.responseMessage === "string" ? body.responseMessage : null,
    });
    return Response.json({ ok: true, mentorship });
  } catch (err: any) {
    return Response.json({ error: err.message || "Failed to update mentorship request" }, { status: 400 });
  }
}
