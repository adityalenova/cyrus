/* ══ src/app/api/mentorship/mentors/route.ts — list & register mentors ══════ */

import { listMentors, registerMentor } from "@/lib/server/mentorship";
import type { MentorStatus } from "@/lib/mentorship/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = (searchParams.get("status") as MentorStatus) || undefined;
  const skill = searchParams.get("skill") || undefined;

  const mentors = await listMentors({ status, skill });
  return Response.json({ mentors });
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
    return Response.json({ error: "Name is required" }, { status: 400 });
  }
  if (!body.email || typeof body.email !== "string" || !body.email.includes("@")) {
    return Response.json({ error: "Valid email is required" }, { status: 400 });
  }
  if (!Array.isArray(body.expertise) || body.expertise.length === 0) {
    return Response.json({ error: "At least one skill in expertise is required" }, { status: 400 });
  }

  try {
    const mentor = await registerMentor({
      name: body.name,
      email: body.email,
      bio: body.bio,
      expertise: body.expertise,
      interests: Array.isArray(body.interests) ? body.interests : [],
      timezone: body.timezone || "UTC",
      availabilityHours: Number(body.availabilityHours) || 5,
      maxMentees: Number(body.maxMentees) || 2,
    });
    return Response.json({ ok: true, mentor }, { status: 201 });
  } catch (err: any) {
    return Response.json({ error: err.message || "Failed to register mentor" }, { status: 500 });
  }
}
