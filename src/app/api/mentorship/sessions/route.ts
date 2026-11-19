/* ══ src/app/api/mentorship/sessions/route.ts — mentorship sessions ════════ */

import { getMentorship, scheduleSession, updateSessionStatus } from "@/lib/server/mentorship";
import type { SessionStatus } from "@/lib/mentorship/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mentorshipId = searchParams.get("mentorshipId");
  if (!mentorshipId) {
    return Response.json({ error: "mentorshipId is required" }, { status: 400 });
  }

  const mentorship = await getMentorship(mentorshipId);
  if (!mentorship) {
    return Response.json({ error: "Mentorship not found" }, { status: 404 });
  }

  return Response.json({ sessions: mentorship.sessions });
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.mentorshipId || !body.title || !body.scheduledAt) {
    return Response.json({ error: "mentorshipId, title, and scheduledAt are required" }, { status: 400 });
  }

  try {
    const session = await scheduleSession({
      mentorshipId: body.mentorshipId,
      title: body.title,
      scheduledAt: body.scheduledAt,
      durationMinutes: Number(body.durationMinutes) || 45,
      meetingUrl: body.meetingUrl || null,
      notes: body.notes || null,
    });
    return Response.json({ ok: true, session }, { status: 201 });
  } catch (err: any) {
    return Response.json({ error: err.message || "Failed to schedule session" }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.mentorshipId || !body.sessionId || !body.status) {
    return Response.json({ error: "mentorshipId, sessionId, and status are required" }, { status: 400 });
  }

  try {
    const session = await updateSessionStatus({
      mentorshipId: body.mentorshipId,
      sessionId: body.sessionId,
      status: body.status as SessionStatus,
      notes: body.notes,
    });
    return Response.json({ ok: true, session });
  } catch (err: any) {
    return Response.json({ error: err.message || "Failed to update session" }, { status: 400 });
  }
}
