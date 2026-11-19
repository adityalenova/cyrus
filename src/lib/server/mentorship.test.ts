/* ══ src/lib/server/mentorship.test.ts — tests for mentorship service ════ */

import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetMentorshipStore,
  getMentee,
  getMentor,
  getMentorship,
  listMentees,
  listMentors,
  listMentorships,
  registerMentee,
  registerMentor,
  requestMentorship,
  respondToMentorship,
  scheduleSession,
  submitMentorshipFeedback,
  updateMentor,
  updateSessionStatus,
} from "./mentorship";

describe("Mentorship Server Service", () => {
  beforeEach(() => {
    __resetMentorshipStore();
  });

  describe("Mentor Registration & Queries", () => {
    it("registers a new mentor with default values", async () => {
      const mentor = await registerMentor({
        name: "Jane Developer",
        email: "jane@test.com",
        expertise: ["TypeScript", "Next.js"],
        interests: ["Open Source"],
        timezone: "UTC-5",
        availabilityHours: 6,
        maxMentees: 3,
      });

      expect(mentor.id).toBeDefined();
      expect(mentor.name).toBe("Jane Developer");
      expect(mentor.status).toBe("active");
      expect(mentor.currentMentees).toBe(0);
      expect(mentor.rating).toBe(0);
      expect(mentor.reviewCount).toBe(0);

      const fetched = await getMentor(mentor.id);
      expect(fetched).toEqual(mentor);
    });

    it("filters mentors by skill and status", async () => {
      await registerMentor({
        name: "Alice",
        email: "alice@test.com",
        expertise: ["Rust", "Systems"],
      });
      await registerMentor({
        name: "Bob",
        email: "bob@test.com",
        expertise: ["React", "CSS"],
      });

      const rustMentors = await listMentors({ skill: "rust" });
      expect(rustMentors).toHaveLength(1);
      expect(rustMentors[0].name).toBe("Alice");

      const all = await listMentors();
      expect(all).toHaveLength(2);
    });

    it("updates mentor fields", async () => {
      const mentor = await registerMentor({
        name: "Charlie",
        email: "charlie@test.com",
        expertise: ["Python"],
      });

      const updated = await updateMentor(mentor.id, {
        bio: "Updated bio description",
        status: "busy",
      });

      expect(updated?.bio).toBe("Updated bio description");
      expect(updated?.status).toBe("busy");
    });
  });

  describe("Mentee Registration & Queries", () => {
    it("registers a mentee with goals and skills", async () => {
      const mentee = await registerMentee({
        name: "Devon",
        email: "devon@test.com",
        goals: "Learn TypeScript and open source",
        skillLevel: "beginner",
        currentSkills: ["HTML", "JavaScript"],
        desiredSkills: ["TypeScript", "React"],
        timezone: "UTC-5",
      });

      expect(mentee.id).toBeDefined();
      expect(mentee.status).toBe("seeking");
      expect(mentee.desiredSkills).toEqual(["TypeScript", "React"]);

      const fetched = await getMentee(mentee.id);
      expect(fetched?.name).toBe("Devon");

      const list = await listMentees();
      expect(list).toHaveLength(1);
    });
  });

  describe("Mentorship Request & Response Flow", () => {
    it("allows mentee to request mentorship and computes compatibility score", async () => {
      const mentor = await registerMentor({
        name: "Expert Mentor",
        email: "m@test.com",
        expertise: ["TypeScript", "React", "Postgres"],
        interests: ["Open Source"],
        timezone: "UTC-5",
        availabilityHours: 5,
        maxMentees: 2,
      });

      const mentee = await registerMentee({
        name: "Aspiring Mentee",
        email: "e@test.com",
        goals: "Master React",
        desiredSkills: ["React", "TypeScript"],
        interests: ["Open Source"],
        timezone: "UTC-5",
        availabilityHours: 5,
      });

      const req = await requestMentorship({
        mentorId: mentor.id,
        menteeId: mentee.id,
        message: "I would love your guidance on full-stack development!",
      });

      expect(req.id).toBeDefined();
      expect(req.status).toBe("pending");
      expect(req.compatibilityScore).toBeGreaterThanOrEqual(80);
      expect(req.matchDetails?.matchedSkills).toContain("React");

      // Verify listing requests
      const list = await listMentorships({ mentorId: mentor.id });
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(req.id);
    });

    it("prevents requesting when mentor is at full capacity", async () => {
      const mentor = await registerMentor({
        name: "Busy Mentor",
        email: "busy@test.com",
        expertise: ["Go"],
        maxMentees: 1,
      });
      // simulate full capacity
      await updateMentor(mentor.id, { currentMentees: 1 });

      const mentee = await registerMentee({
        name: "Student",
        email: "s@test.com",
        goals: "Learn Go",
        desiredSkills: ["Go"],
      });

      await expect(
        requestMentorship({
          mentorId: mentor.id,
          menteeId: mentee.id,
        })
      ).rejects.toThrow("Mentor has reached maximum capacity");
    });

    it("prevents duplicate requests between same mentor and mentee", async () => {
      const mentor = await registerMentor({
        name: "Mentor A",
        email: "ma@test.com",
        expertise: ["Go"],
      });
      const mentee = await registerMentee({
        name: "Mentee A",
        email: "ea@test.com",
        goals: "Learn Go",
        desiredSkills: ["Go"],
      });

      await requestMentorship({ mentorId: mentor.id, menteeId: mentee.id });
      await expect(
        requestMentorship({ mentorId: mentor.id, menteeId: mentee.id })
      ).rejects.toThrow("already exists");
    });

    it("accepts a mentorship request and increments mentor load", async () => {
      const mentor = await registerMentor({
        name: "Guide",
        email: "guide@test.com",
        expertise: ["Rust"],
        maxMentees: 2,
      });
      const mentee = await registerMentee({
        name: "Learner",
        email: "learner@test.com",
        goals: "Master Rust",
        desiredSkills: ["Rust"],
      });

      const rel = await requestMentorship({
        mentorId: mentor.id,
        menteeId: mentee.id,
      });

      const accepted = await respondToMentorship({
        mentorshipId: rel.id,
        action: "accept",
        responseMessage: "Welcome aboard! Excited to work together.",
      });

      expect(accepted.status).toBe("accepted");
      expect(accepted.startedAt).toBeDefined();

      const updatedMentor = await getMentor(mentor.id);
      expect(updatedMentor?.currentMentees).toBe(1);

      const updatedMentee = await getMentee(mentee.id);
      expect(updatedMentee?.status).toBe("matched");
    });

    it("declines a mentorship request without increasing mentor load", async () => {
      const mentor = await registerMentor({
        name: "Guide B",
        email: "guideb@test.com",
        expertise: ["Rust"],
      });
      const mentee = await registerMentee({
        name: "Learner B",
        email: "learnerb@test.com",
        goals: "Master Rust",
        desiredSkills: ["Rust"],
      });

      const rel = await requestMentorship({
        mentorId: mentor.id,
        menteeId: mentee.id,
      });

      const declined = await respondToMentorship({
        mentorshipId: rel.id,
        action: "decline",
        responseMessage: "Currently unable to take on additional mentees.",
      });

      expect(declined.status).toBe("declined");

      const updatedMentor = await getMentor(mentor.id);
      expect(updatedMentor?.currentMentees).toBe(0);
    });
  });

  describe("Session Scheduling", () => {
    it("schedules and updates a session for an accepted mentorship", async () => {
      const mentor = await registerMentor({
        name: "Coach",
        email: "coach@test.com",
        expertise: ["C++"],
      });
      const mentee = await registerMentee({
        name: "Student",
        email: "student@test.com",
        goals: "Learn C++",
        desiredSkills: ["C++"],
      });

      const rel = await requestMentorship({ mentorId: mentor.id, menteeId: mentee.id });
      await respondToMentorship({ mentorshipId: rel.id, action: "accept" });

      const session = await scheduleSession({
        mentorshipId: rel.id,
        title: "Kickoff and Roadmap Planning",
        scheduledAt: "2026-12-01T15:00:00Z",
        durationMinutes: 60,
        meetingUrl: "https://meet.google.com/abc-defg-hij",
      });

      expect(session.id).toBeDefined();
      expect(session.title).toBe("Kickoff and Roadmap Planning");
      expect(session.status).toBe("scheduled");

      const updatedSession = await updateSessionStatus({
        mentorshipId: rel.id,
        sessionId: session.id,
        status: "completed",
        notes: "Great kickoff discussion; outlined first open source issue to tackle.",
      });

      expect(updatedSession.status).toBe("completed");
      expect(updatedSession.notes).toContain("kickoff");

      const updatedRel = await getMentorship(rel.id);
      expect(updatedRel?.sessions).toHaveLength(1);
      expect(updatedRel?.sessions[0].status).toBe("completed");
    });
  });

  describe("Feedback and Rating System", () => {
    it("submits mentee rating and updates mentor average rating score", async () => {
      const mentor = await registerMentor({
        name: "Star Mentor",
        email: "star@test.com",
        expertise: ["Python", "Django"],
      });
      const mentee = await registerMentee({
        name: "Happy Mentee",
        email: "happy@test.com",
        goals: "Build Django apps",
        desiredSkills: ["Django"],
      });

      const rel = await requestMentorship({ mentorId: mentor.id, menteeId: mentee.id });
      await respondToMentorship({ mentorshipId: rel.id, action: "accept" });

      // First review: 5 stars (50 scaled)
      await submitMentorshipFeedback({
        mentorshipId: rel.id,
        role: "mentee",
        rating: 5,
        comment: "Outstanding mentorship, learned an incredible amount!",
      });

      let updatedMentor = await getMentor(mentor.id);
      expect(updatedMentor?.reviewCount).toBe(1);
      expect(updatedMentor?.rating).toBe(50); // 5.0 stars

      // Second mentee review on another mentorship: 4 stars (40 scaled) -> (50 + 40) / 2 = 45 (4.5 stars)
      const mentee2 = await registerMentee({
        name: "Mentee 2",
        email: "m2@test.com",
        goals: "Django",
        desiredSkills: ["Django"],
      });
      const rel2 = await requestMentorship({ mentorId: mentor.id, menteeId: mentee2.id });
      await respondToMentorship({ mentorshipId: rel2.id, action: "accept" });

      await submitMentorshipFeedback({
        mentorshipId: rel2.id,
        role: "mentee",
        rating: 4,
        comment: "Very helpful and responsive!",
      });

      updatedMentor = await getMentor(mentor.id);
      expect(updatedMentor?.reviewCount).toBe(2);
      expect(updatedMentor?.rating).toBe(45); // 4.5 stars average
    });
  });
});
