/* ══ src/app/api/mentorship/feedback/route.ts — submit feedback & ratings ═ */

import { submitMentorshipFeedback } from "@/lib/server/mentorship";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.mentorshipId || typeof body.mentorshipId !== "string") {
    return Response.json({ error: "mentorshipId is required" }, { status: 400 });
  }
  if (body.role !== "mentee" && body.role !== "mentor") {
    return Response.json({ error: "role must be 'mentee' or 'mentor'" }, { status: 400 });
  }
  const rating = Number(body.rating);
  if (!rating || rating < 1 || rating > 5) {
    return Response.json({ error: "rating must be an integer between 1 and 5" }, { status: 400 });
  }

  try {
    const mentorship = await submitMentorshipFeedback({
      mentorshipId: body.mentorshipId,
      role: body.role,
      rating,
      comment: typeof body.comment === "string" ? body.comment : null,
    });
    return Response.json({ ok: true, mentorship });
  } catch (err: any) {
    return Response.json({ error: err.message || "Failed to submit feedback" }, { status: 400 });
  }
}
