/* ══ src/app/api/mentorship/mentees/route.ts — list & register mentees ══════ */

import { listMentees, registerMentee } from "@/lib/server/mentorship";
import type { MenteeStatus, SkillLevel } from "@/lib/mentorship/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = (searchParams.get("status") as MenteeStatus) || undefined;

  const mentees = await listMentees({ status });
  return Response.json({ mentees });
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
  if (!body.goals || typeof body.goals !== "string" || !body.goals.trim()) {
    return Response.json({ error: "Mentorship goals are required" }, { status: 400 });
  }
  if (!Array.isArray(body.desiredSkills) || body.desiredSkills.length === 0) {
    return Response.json({ error: "At least one desired skill is required" }, { status: 400 });
  }

  try {
    const mentee = await registerMentee({
      name: body.name,
      email: body.email,
      bio: body.bio,
      goals: body.goals,
      skillLevel: (body.skillLevel as SkillLevel) || "beginner",
      interests: Array.isArray(body.interests) ? body.interests : [],
      currentSkills: Array.isArray(body.currentSkills) ? body.currentSkills : [],
      desiredSkills: body.desiredSkills,
      timezone: body.timezone || "UTC",
      availabilityHours: Number(body.availabilityHours) || 5,
    });
    return Response.json({ ok: true, mentee }, { status: 201 });
  } catch (err: any) {
    return Response.json({ error: err.message || "Failed to register mentee" }, { status: 500 });
  }
}
