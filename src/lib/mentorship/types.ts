/* ══ src/lib/mentorship/types.ts — domain types for automated mentorship ══ */

export type MentorStatus = "active" | "busy" | "inactive";
export type MenteeStatus = "seeking" | "matched" | "inactive";
export type SkillLevel = "beginner" | "intermediate" | "advanced";
export type MentorshipStatus = "pending" | "accepted" | "declined" | "active" | "completed" | "cancelled";
export type SessionStatus = "scheduled" | "completed" | "cancelled";

export interface Mentor {
  id: string;
  userId?: string | null;
  name: string;
  email: string;
  bio?: string | null;
  expertise: string[];
  interests: string[];
  timezone: string;
  availabilityHours: number;
  maxMentees: number;
  currentMentees: number;
  status: MentorStatus;
  rating: number; // 0 to 50 (e.g. 45 represents 4.5)
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Mentee {
  id: string;
  userId?: string | null;
  name: string;
  email: string;
  bio?: string | null;
  goals: string;
  skillLevel: SkillLevel;
  interests: string[];
  currentSkills: string[];
  desiredSkills: string[];
  timezone: string;
  availabilityHours: number;
  status: MenteeStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CompatibilityDetails {
  overallScore: number; // 0 to 100
  skillScore: number; // 0 to 100
  matchedSkills: string[];
  interestScore: number; // 0 to 100
  matchedInterests: string[];
  availabilityScore: number; // 0 to 100
  timezoneScore: number; // 0 to 100
  timezoneDiffHours: number;
  overlapHours: number;
}

export interface MentorMatch {
  mentor: Mentor;
  score: number; // 0 to 100
  details: CompatibilityDetails;
  available: boolean;
}

export interface MenteeMatch {
  mentee: Mentee;
  score: number; // 0 to 100
  details: CompatibilityDetails;
}

export interface MentorshipSession {
  id: string;
  title: string;
  scheduledAt: string; // ISO date-time string
  durationMinutes: number;
  status: SessionStatus;
  meetingUrl?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface MentorshipFeedback {
  mentorRating?: number | null; // 1 to 5
  mentorComment?: string | null;
  menteeRating?: number | null; // 1 to 5
  menteeComment?: string | null;
  submittedAt?: string | null;
}

export interface Mentorship {
  id: string;
  mentorId: string;
  menteeId: string;
  status: MentorshipStatus;
  compatibilityScore: number;
  matchDetails?: CompatibilityDetails | null;
  message?: string | null;
  responseMessage?: string | null;
  sessions: MentorshipSession[];
  feedback?: MentorshipFeedback | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}
