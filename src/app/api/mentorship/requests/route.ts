/* ══ src/app/api/mentorship/requests/route.ts — mentorship requests ════════ */

import { listMentorships, requestMentorship } from "@/lib/server/mentorship";
import type { MentorshipStatus } from "@/lib/mentorship/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mentorId = searchParams.get("mentorId") || undefined;
  const menteeId = searchParams.get("menteeId") || undefined;
  const status = (searchParams.get("status") as MentorshipStatus) || undefined;

  const requests = await listMentorships({ mentorId, menteeId, status });
  return Response.json({ requests });
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.mentorId || typeof body.mentorId !== "string") {
    return Response.json({ error: "mentorId is required" }, { status: 400 });
  }
  if (!body.menteeId || typeof body.menteeId !== "string") {
    return Response.json({ error: "menteeId is required" }, { status: 400 });
  }

  try {
    const mentorship = await requestMentorship({
      mentorId: body.mentorId,
      menteeId: body.menteeId,
      message: typeof body.message === "string" ? body.message : null,
    });
    return Response.json({ ok: true, mentorship }, { status: 201 });
  } catch (err: any) {
    return Response.json({ error: err.message || "Failed to create mentorship request" }, { status: 400 });
  }
}
