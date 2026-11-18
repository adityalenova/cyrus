/* ══ src/app/api/mentorship/matches/route.ts — compatibility matches ═══════ */

import { getMentee, getMentor, listMentors, listMentees } from "@/lib/server/mentorship";
import { rankMentorsForMentee, rankMenteesForMentor } from "@/lib/mentorship/matching";
import type { Mentee } from "@/lib/mentorship/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const menteeId = searchParams.get("menteeId");
  const mentorId = searchParams.get("mentorId");
  const minScore = searchParams.get("minScore") ? parseInt(searchParams.get("minScore")!, 10) : 0;
  const onlyAvailable = searchParams.get("onlyAvailable") === "true";
  const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 50;

  if (menteeId) {
    const mentee = await getMentee(menteeId);
    if (!mentee) {
      return Response.json({ error: "Mentee not found" }, { status: 404 });
    }
    const mentors = await listMentors();
    const matches = rankMentorsForMentee(mentors, mentee, { minScore, onlyAvailable, limit });
    return Response.json({ matches });
  }

  if (mentorId) {
    const mentor = await getMentor(mentorId);
    if (!mentor) {
      return Response.json({ error: "Mentor not found" }, { status: 404 });
    }
    const mentees = await listMentees();
    const matches = rankMenteesForMentor(mentees, mentor, { minScore, limit });
    return Response.json({ matches });
  }

  return Response.json({ error: "Provide menteeId or mentorId" }, { status: 400 });
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Real-time matching for an ad-hoc mentee profile
  const menteeCandidate: Mentee = {
    id: "temp-mentee",
    name: body.name || "Anonymous",
    email: body.email || "",
    goals: body.goals || "",
    skillLevel: body.skillLevel || "beginner",
    interests: Array.isArray(body.interests) ? body.interests : [],
    currentSkills: Array.isArray(body.currentSkills) ? body.currentSkills : [],
    desiredSkills: Array.isArray(body.desiredSkills) ? body.desiredSkills : [],
    timezone: body.timezone || "UTC",
    availabilityHours: Number(body.availabilityHours) || 5,
    status: "seeking",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mentors = await listMentors();
  const minScore = Number(body.minScore) || 0;
  const onlyAvailable = body.onlyAvailable === true;
  const limit = Number(body.limit) || 50;

  const matches = rankMentorsForMentee(mentors, menteeCandidate, { minScore, onlyAvailable, limit });
  return Response.json({ matches });
}
