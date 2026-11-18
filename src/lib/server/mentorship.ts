/* ══ src/lib/server/mentorship.ts — server service for mentorship system ════
   Supports both live Postgres via Drizzle ORM and an in-memory fallback
   store when DATABASE_URL is not set (offline, local dev, CI/vitest).
   ════════════════════════════════════════════════════════════════════════════ */

import { eq, desc, and } from "drizzle-orm";
import { getDb } from "../db";
import { mentors as mentorsTable, mentees as menteesTable, mentorships as mentorshipsTable } from "../db/schema";
import type {
  Mentor,
  Mentee,
  Mentorship,
  MentorshipSession,
  MentorshipFeedback,
  MentorStatus,
  MenteeStatus,
  SkillLevel,
  MentorshipStatus,
  SessionStatus,
} from "../mentorship/types";
import { computeCompatibility } from "../mentorship/matching";

/* ── In-Memory Store for Offline / Testing ────────────────────────────── */
const memMentors = new Map<string, Mentor>();
const memMentees = new Map<string, Mentee>();
const memMentorships = new Map<string, Mentorship>();

/** Reset in-memory store (for testing) */
export function __resetMentorshipStore(): void {
  memMentors.clear();
  memMentees.clear();
  memMentorships.clear();
}

function genId(prefix: string): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/* ── Mentor CRUD ──────────────────────────────────────────────────────── */

export interface RegisterMentorInput {
  userId?: string | null;
  name: string;
  email: string;
  bio?: string | null;
  expertise: string[];
  interests?: string[];
  timezone?: string;
  availabilityHours?: number;
  maxMentees?: number;
}

export async function registerMentor(input: RegisterMentorInput): Promise<Mentor> {
  const now = new Date().toISOString();
  const db = getDb();

  const mentorData: Mentor = {
    id: genId("mentor"),
    userId: input.userId ?? null,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    bio: input.bio ?? null,
    expertise: (input.expertise || []).map((s) => s.trim()).filter(Boolean),
    interests: (input.interests || []).map((s) => s.trim()).filter(Boolean),
    timezone: input.timezone || "UTC",
    availabilityHours: Math.max(1, input.availabilityHours ?? 5),
    maxMentees: Math.max(1, input.maxMentees ?? 2),
    currentMentees: 0,
    status: "active",
    rating: 0,
    reviewCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  if (db) {
    const [row] = await db
      .insert(mentorsTable)
      .values({
        id: mentorData.id,
        userId: mentorData.userId ?? undefined,
        name: mentorData.name,
        email: mentorData.email,
        bio: mentorData.bio,
        expertise: mentorData.expertise,
        interests: mentorData.interests,
        timezone: mentorData.timezone,
        availabilityHours: mentorData.availabilityHours,
        maxMentees: mentorData.maxMentees,
        currentMentees: mentorData.currentMentees,
        status: mentorData.status,
        rating: mentorData.rating,
        reviewCount: mentorData.reviewCount,
      })
      .returning();

    return {
      ...mentorData,
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  memMentors.set(mentorData.id, mentorData);
  return mentorData;
}

export async function getMentor(id: string): Promise<Mentor | null> {
  const db = getDb();
  if (db) {
    const [row] = await db.select().from(mentorsTable).where(eq(mentorsTable.id, id));
    if (!row) return null;
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      email: row.email,
      bio: row.bio,
      expertise: row.expertise,
      interests: row.interests,
      timezone: row.timezone,
      availabilityHours: row.availabilityHours,
      maxMentees: row.maxMentees,
      currentMentees: row.currentMentees,
      status: row.status as MentorStatus,
      rating: row.rating,
      reviewCount: row.reviewCount,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
  return memMentors.get(id) ?? null;
}

export async function listMentors(filters?: { status?: MentorStatus; skill?: string }): Promise<Mentor[]> {
  const db = getDb();
  let list: Mentor[] = [];

  if (db) {
    const rows = await db.select().from(mentorsTable).orderBy(desc(mentorsTable.createdAt));
    list = rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      name: r.name,
      email: r.email,
      bio: r.bio,
      expertise: r.expertise,
      interests: r.interests,
      timezone: r.timezone,
      availabilityHours: r.availabilityHours,
      maxMentees: r.maxMentees,
      currentMentees: r.currentMentees,
      status: r.status as MentorStatus,
      rating: r.rating,
      reviewCount: r.reviewCount,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  } else {
    list = Array.from(memMentors.values());
  }

  if (filters?.status) {
    list = list.filter((m) => m.status === filters.status);
  }
  if (filters?.skill) {
    const q = filters.skill.toLowerCase();
    list = list.filter((m) => m.expertise.some((s) => s.toLowerCase().includes(q)));
  }

  return list;
}

export async function updateMentor(
  id: string,
  updates: Partial<Omit<Mentor, "id" | "createdAt">>
): Promise<Mentor | null> {
  const existing = await getMentor(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const updated: Mentor = {
    ...existing,
    ...updates,
    updatedAt: now,
  };

  const db = getDb();
  if (db) {
    await db
      .update(mentorsTable)
      .set({
        name: updated.name,
        email: updated.email,
        bio: updated.bio,
        expertise: updated.expertise,
        interests: updated.interests,
        timezone: updated.timezone,
        availabilityHours: updated.availabilityHours,
        maxMentees: updated.maxMentees,
        currentMentees: updated.currentMentees,
        status: updated.status,
        rating: updated.rating,
        reviewCount: updated.reviewCount,
        updatedAt: new Date(now),
      })
      .where(eq(mentorsTable.id, id));
  } else {
    memMentors.set(id, updated);
  }

  return updated;
}

/* ── Mentee CRUD ──────────────────────────────────────────────────────── */

export interface RegisterMenteeInput {
  userId?: string | null;
  name: string;
  email: string;
  bio?: string | null;
  goals: string;
  skillLevel?: SkillLevel;
  interests?: string[];
  currentSkills?: string[];
  desiredSkills: string[];
  timezone?: string;
  availabilityHours?: number;
}

export async function registerMentee(input: RegisterMenteeInput): Promise<Mentee> {
  const now = new Date().toISOString();
  const db = getDb();

  const menteeData: Mentee = {
    id: genId("mentee"),
    userId: input.userId ?? null,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    bio: input.bio ?? null,
    goals: input.goals.trim(),
    skillLevel: input.skillLevel || "beginner",
    interests: (input.interests || []).map((s) => s.trim()).filter(Boolean),
    currentSkills: (input.currentSkills || []).map((s) => s.trim()).filter(Boolean),
    desiredSkills: (input.desiredSkills || []).map((s) => s.trim()).filter(Boolean),
    timezone: input.timezone || "UTC",
    availabilityHours: Math.max(1, input.availabilityHours ?? 5),
    status: "seeking",
    createdAt: now,
    updatedAt: now,
  };

  if (db) {
    const [row] = await db
      .insert(menteesTable)
      .values({
        id: menteeData.id,
        userId: menteeData.userId ?? undefined,
        name: menteeData.name,
        email: menteeData.email,
        bio: menteeData.bio,
        goals: menteeData.goals,
        skillLevel: menteeData.skillLevel,
        interests: menteeData.interests,
        currentSkills: menteeData.currentSkills,
        desiredSkills: menteeData.desiredSkills,
        timezone: menteeData.timezone,
        availabilityHours: menteeData.availabilityHours,
        status: menteeData.status,
      })
      .returning();

    return {
      ...menteeData,
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  memMentees.set(menteeData.id, menteeData);
  return menteeData;
}

export async function getMentee(id: string): Promise<Mentee | null> {
  const db = getDb();
  if (db) {
    const [row] = await db.select().from(menteesTable).where(eq(menteesTable.id, id));
    if (!row) return null;
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      email: row.email,
      bio: row.bio,
      goals: row.goals,
      skillLevel: row.skillLevel as SkillLevel,
      interests: row.interests,
      currentSkills: row.currentSkills,
      desiredSkills: row.desiredSkills,
      timezone: row.timezone,
      availabilityHours: row.availabilityHours,
      status: row.status as MenteeStatus,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
  return memMentees.get(id) ?? null;
}

export async function listMentees(filters?: { status?: MenteeStatus }): Promise<Mentee[]> {
  const db = getDb();
  let list: Mentee[] = [];

  if (db) {
    const rows = await db.select().from(menteesTable).orderBy(desc(menteesTable.createdAt));
    list = rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      name: r.name,
      email: r.email,
      bio: r.bio,
      goals: r.goals,
      skillLevel: r.skillLevel as SkillLevel,
      interests: r.interests,
      currentSkills: r.currentSkills,
      desiredSkills: r.desiredSkills,
      timezone: r.timezone,
      availabilityHours: r.availabilityHours,
      status: r.status as MenteeStatus,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  } else {
    list = Array.from(memMentees.values());
  }

  if (filters?.status) {
    list = list.filter((m) => m.status === filters.status);
  }

  return list;
}

/* ── Mentorship Requests & Lifecycle ─────────────────────────────────── */

export interface RequestMentorshipInput {
  mentorId: string;
  menteeId: string;
  message?: string | null;
}

export async function requestMentorship(input: RequestMentorshipInput): Promise<Mentorship> {
  const mentor = await getMentor(input.mentorId);
  if (!mentor) throw new Error("Mentor not found");
  const mentee = await getMentee(input.menteeId);
  if (!mentee) throw new Error("Mentee not found");

  if (mentor.status === "inactive" || mentor.currentMentees >= mentor.maxMentees) {
    throw new Error("Mentor has reached maximum capacity or is not accepting new mentees");
  }

  // Prevent duplicate pending/accepted requests
  const existingList = await listMentorships({ mentorId: input.mentorId, menteeId: input.menteeId });
  const activeOrPending = existingList.find((m) => m.status === "pending" || m.status === "accepted" || m.status === "active");
  if (activeOrPending) {
    throw new Error("A mentorship relationship or pending request already exists between these users");
  }

  const compatibility = computeCompatibility(mentor, mentee);
  const now = new Date().toISOString();

  const mentorship: Mentorship = {
    id: genId("rel"),
    mentorId: input.mentorId,
    menteeId: input.menteeId,
    status: "pending",
    compatibilityScore: compatibility.overallScore,
    matchDetails: compatibility,
    message: input.message ?? null,
    responseMessage: null,
    sessions: [],
    feedback: null,
    startedAt: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  const db = getDb();
  if (db) {
    const [row] = await db
      .insert(mentorshipsTable)
      .values({
        id: mentorship.id,
        mentorId: mentorship.mentorId,
        menteeId: mentorship.menteeId,
        status: mentorship.status,
        compatibilityScore: mentorship.compatibilityScore,
        matchDetails: mentorship.matchDetails,
        message: mentorship.message,
        responseMessage: mentorship.responseMessage,
        sessions: mentorship.sessions,
        feedback: mentorship.feedback,
      })
      .returning();

    return {
      ...mentorship,
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  memMentorships.set(mentorship.id, mentorship);
  return mentorship;
}

export async function getMentorship(id: string): Promise<Mentorship | null> {
  const db = getDb();
  if (db) {
    const [row] = await db.select().from(mentorshipsTable).where(eq(mentorshipsTable.id, id));
    if (!row) return null;
    return {
      id: row.id,
      mentorId: row.mentorId,
      menteeId: row.menteeId,
      status: row.status as MentorshipStatus,
      compatibilityScore: row.compatibilityScore,
      matchDetails: row.matchDetails as any,
      message: row.message,
      responseMessage: row.responseMessage,
      sessions: (row.sessions as unknown as MentorshipSession[]) || [],
      feedback: (row.feedback as unknown as MentorshipFeedback) || null,
      startedAt: row.startedAt ? row.startedAt.toISOString() : null,
      completedAt: row.completedAt ? row.completedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
  return memMentorships.get(id) ?? null;
}

export async function listMentorships(filters?: {
  mentorId?: string;
  menteeId?: string;
  status?: MentorshipStatus;
}): Promise<Mentorship[]> {
  const db = getDb();
  let list: Mentorship[] = [];

  if (db) {
    let q = db.select().from(mentorshipsTable);
    if (filters?.mentorId && filters?.menteeId) {
      q = q.where(and(eq(mentorshipsTable.mentorId, filters.mentorId), eq(mentorshipsTable.menteeId, filters.menteeId))) as any;
    } else if (filters?.mentorId) {
      q = q.where(eq(mentorshipsTable.mentorId, filters.mentorId)) as any;
    } else if (filters?.menteeId) {
      q = q.where(eq(mentorshipsTable.menteeId, filters.menteeId)) as any;
    }
    const rows = await q.orderBy(desc(mentorshipsTable.createdAt));
    list = rows.map((r) => ({
      id: r.id,
      mentorId: r.mentorId,
      menteeId: r.menteeId,
      status: r.status as MentorshipStatus,
      compatibilityScore: r.compatibilityScore,
      matchDetails: r.matchDetails as any,
      message: r.message,
      responseMessage: r.responseMessage,
      sessions: (r.sessions as unknown as MentorshipSession[]) || [],
      feedback: (r.feedback as unknown as MentorshipFeedback) || null,
      startedAt: r.startedAt ? r.startedAt.toISOString() : null,
      completedAt: r.completedAt ? r.completedAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  } else {
    list = Array.from(memMentorships.values());
    if (filters?.mentorId) list = list.filter((m) => m.mentorId === filters.mentorId);
    if (filters?.menteeId) list = list.filter((m) => m.menteeId === filters.menteeId);
  }

  if (filters?.status) {
    list = list.filter((m) => m.status === filters.status);
  }

  return list;
}

export async function respondToMentorship(params: {
  mentorshipId: string;
  action: "accept" | "decline";
  responseMessage?: string | null;
}): Promise<Mentorship> {
  const mentorship = await getMentorship(params.mentorshipId);
  if (!mentorship) throw new Error("Mentorship request not found");
  if (mentorship.status !== "pending") {
    throw new Error(`Cannot respond to mentorship in '${mentorship.status}' state`);
  }

  const mentor = await getMentor(mentorship.mentorId);
  if (!mentor) throw new Error("Mentor not found");

  const now = new Date().toISOString();

  if (params.action === "accept") {
    if (mentor.currentMentees >= mentor.maxMentees) {
      throw new Error("Mentor capacity reached");
    }

    const updatedMentorship: Mentorship = {
      ...mentorship,
      status: "accepted",
      responseMessage: params.responseMessage ?? null,
      startedAt: now,
      updatedAt: now,
    };

    // Increment mentor's current mentees
    await updateMentor(mentor.id, {
      currentMentees: mentor.currentMentees + 1,
      status: mentor.currentMentees + 1 >= mentor.maxMentees ? "busy" : "active",
    });

    // Update mentee status
    const mentee = await getMentee(mentorship.menteeId);
    if (mentee) {
      const db = getDb();
      if (db) {
        await db.update(menteesTable).set({ status: "matched", updatedAt: new Date(now) }).where(eq(menteesTable.id, mentee.id));
      } else {
        memMentees.set(mentee.id, { ...mentee, status: "matched", updatedAt: now });
      }
    }

    const db = getDb();
    if (db) {
      await db
        .update(mentorshipsTable)
        .set({
          status: "accepted",
          responseMessage: updatedMentorship.responseMessage,
          startedAt: new Date(now),
          updatedAt: new Date(now),
        })
        .where(eq(mentorshipsTable.id, mentorship.id));
    } else {
      memMentorships.set(mentorship.id, updatedMentorship);
    }

    return updatedMentorship;
  } else {
    // Decline
    const updatedMentorship: Mentorship = {
      ...mentorship,
      status: "declined",
      responseMessage: params.responseMessage ?? null,
      updatedAt: now,
    };

    const db = getDb();
    if (db) {
      await db
        .update(mentorshipsTable)
        .set({
          status: "declined",
          responseMessage: updatedMentorship.responseMessage,
          updatedAt: new Date(now),
        })
        .where(eq(mentorshipsTable.id, mentorship.id));
    } else {
      memMentorships.set(mentorship.id, updatedMentorship);
    }

    return updatedMentorship;
  }
}

/* ── Mentorship Sessions ──────────────────────────────────────────────── */

export interface ScheduleSessionInput {
  mentorshipId: string;
  title: string;
  scheduledAt: string;
  durationMinutes?: number;
  meetingUrl?: string | null;
  notes?: string | null;
}

export async function scheduleSession(input: ScheduleSessionInput): Promise<MentorshipSession> {
  const mentorship = await getMentorship(input.mentorshipId);
  if (!mentorship) throw new Error("Mentorship relationship not found");
  if (mentorship.status !== "accepted" && mentorship.status !== "active") {
    throw new Error("Sessions can only be scheduled for accepted or active mentorships");
  }

  const now = new Date().toISOString();
  const session: MentorshipSession = {
    id: genId("sess"),
    title: input.title.trim(),
    scheduledAt: new Date(input.scheduledAt).toISOString(),
    durationMinutes: Math.max(15, input.durationMinutes ?? 45),
    status: "scheduled",
    meetingUrl: input.meetingUrl ?? null,
    notes: input.notes ?? null,
    createdAt: now,
  };

  const updatedSessions = [...mentorship.sessions, session];
  const db = getDb();
  if (db) {
    await db
      .update(mentorshipsTable)
      .set({
        sessions: updatedSessions,
        updatedAt: new Date(now),
      })
      .where(eq(mentorshipsTable.id, mentorship.id));
  } else {
    memMentorships.set(mentorship.id, {
      ...mentorship,
      sessions: updatedSessions,
      updatedAt: now,
    });
  }

  return session;
}

export async function updateSessionStatus(params: {
  mentorshipId: string;
  sessionId: string;
  status: SessionStatus;
  notes?: string | null;
}): Promise<MentorshipSession> {
  const mentorship = await getMentorship(params.mentorshipId);
  if (!mentorship) throw new Error("Mentorship relationship not found");

  const idx = mentorship.sessions.findIndex((s) => s.id === params.sessionId);
  if (idx === -1) throw new Error("Session not found");

  const session = { ...mentorship.sessions[idx] };
  session.status = params.status;
  if (params.notes !== undefined) session.notes = params.notes;

  mentorship.sessions[idx] = session;
  const now = new Date().toISOString();

  const db = getDb();
  if (db) {
    await db
      .update(mentorshipsTable)
      .set({
        sessions: mentorship.sessions,
        updatedAt: new Date(now),
      })
      .where(eq(mentorshipsTable.id, mentorship.id));
  } else {
    memMentorships.set(mentorship.id, {
      ...mentorship,
      sessions: mentorship.sessions,
      updatedAt: now,
    });
  }

  return session;
}

/* ── Feedback and Rating System ───────────────────────────────────────── */

export interface SubmitFeedbackInput {
  mentorshipId: string;
  role: "mentee" | "mentor";
  rating: number; // 1 to 5
  comment?: string | null;
}

export async function submitMentorshipFeedback(input: SubmitFeedbackInput): Promise<Mentorship> {
  const mentorship = await getMentorship(input.mentorshipId);
  if (!mentorship) throw new Error("Mentorship relationship not found");
  if (mentorship.status !== "accepted" && mentorship.status !== "active" && mentorship.status !== "completed") {
    throw new Error("Feedback can only be submitted for active or completed mentorships");
  }

  if (input.rating < 1 || input.rating > 5) {
    throw new Error("Rating must be between 1 and 5");
  }

  const now = new Date().toISOString();
  const feedback: MentorshipFeedback = {
    ...(mentorship.feedback || {}),
    submittedAt: now,
  };

  if (input.role === "mentee") {
    feedback.mentorRating = input.rating;
    feedback.mentorComment = input.comment ?? null;

    // Recalculate mentor's overall rating
    const mentor = await getMentor(mentorship.mentorId);
    if (mentor) {
      // rating is scaled 0-50 (e.g. 50 represents 5.0)
      const currentScaledTotal = mentor.rating * mentor.reviewCount;
      const newScoreScaled = input.rating * 10;
      const newCount = mentor.reviewCount + 1;
      const newAvg = Math.round((currentScaledTotal + newScoreScaled) / newCount);

      await updateMentor(mentor.id, {
        rating: Math.min(50, Math.max(0, newAvg)),
        reviewCount: newCount,
      });
    }
  } else {
    feedback.menteeRating = input.rating;
    feedback.menteeComment = input.comment ?? null;
  }

  const updated: Mentorship = {
    ...mentorship,
    feedback,
    updatedAt: now,
  };

  const db = getDb();
  if (db) {
    await db
      .update(mentorshipsTable)
      .set({
        feedback: updated.feedback,
        updatedAt: new Date(now),
      })
      .where(eq(mentorshipsTable.id, mentorship.id));
  } else {
    memMentorships.set(mentorship.id, updated);
  }

  return updated;
}
