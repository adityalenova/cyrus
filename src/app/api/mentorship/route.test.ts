/* ══ src/app/api/mentorship/route.test.ts — API endpoint tests ══════════════ */

import { beforeEach, describe, expect, it } from "vitest";
import { __resetMentorshipStore } from "@/lib/server/mentorship";
import { GET as getMentors, POST as postMentor } from "./mentors/route";
import { GET as getMentees, POST as postMentee } from "./mentees/route";
import { GET as getMatches, POST as postMatches } from "./matches/route";
import { GET as getRequests, POST as postRequest } from "./requests/route";
import { PATCH as patchRequest } from "./requests/[id]/route";
import { GET as getSessions, POST as postSession, PATCH as patchSession } from "./sessions/route";
import { POST as postFeedback } from "./feedback/route";

describe("Mentorship API Endpoints", () => {
  beforeEach(() => {
    __resetMentorshipStore();
  });

  describe("Mentors API", () => {
    it("handles invalid payloads gracefully", async () => {
      const res = await postMentor(new Request("http://localhost/api/mentorship/mentors", {
        method: "POST",
        body: JSON.stringify({ name: "" }),
      }));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Name is required");
    });

    it("registers and lists mentors", async () => {
      const postRes = await postMentor(new Request("http://localhost/api/mentorship/mentors", {
        method: "POST",
        body: JSON.stringify({
          name: "Ada Lovelace",
          email: "ada@example.com",
          expertise: ["Algorithms", "Math", "Assembly"],
          timezone: "UTC",
          availabilityHours: 8,
          maxMentees: 3,
        }),
      }));

      expect(postRes.status).toBe(201);
      const postData = await postRes.json();
      expect(postData.mentor.name).toBe("Ada Lovelace");

      const getRes = await getMentors(new Request("http://localhost/api/mentorship/mentors"));
      expect(getRes.status).toBe(200);
      const getData = await getRes.json();
      expect(getData.mentors).toHaveLength(1);
    });
  });

  describe("Mentees API", () => {
    it("validates required fields", async () => {
      const res = await postMentee(new Request("http://localhost/api/mentorship/mentees", {
        method: "POST",
        body: JSON.stringify({ name: "Alan Turing", email: "alan@example.com" }),
      }));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Mentorship goals are required");
    });

    it("registers a mentee successfully", async () => {
      const res = await postMentee(new Request("http://localhost/api/mentorship/mentees", {
        method: "POST",
        body: JSON.stringify({
          name: "Grace Hopper",
          email: "grace@example.com",
          goals: "Develop compiler technologies",
          desiredSkills: ["Compilers", "C"],
        }),
      }));
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.mentee.name).toBe("Grace Hopper");

      const listRes = await getMentees(new Request("http://localhost/api/mentorship/mentees"));
      const listData = await listRes.json();
      expect(listData.mentees).toHaveLength(1);
    });
  });

  describe("Matches API", () => {
    it("calculates real-time matches for ad-hoc candidate via POST", async () => {
      // Register a mentor first
      await postMentor(new Request("http://localhost/api/mentorship/mentors", {
        method: "POST",
        body: JSON.stringify({
          name: "Linus",
          email: "linus@example.com",
          expertise: ["C", "Git", "Linux Kernel"],
          timezone: "UTC-8",
        }),
      }));

      const res = await postMatches(new Request("http://localhost/api/mentorship/matches", {
        method: "POST",
        body: JSON.stringify({
          desiredSkills: ["Git", "C"],
          timezone: "UTC-8",
        }),
      }));

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.matches).toHaveLength(1);
      expect(data.matches[0].mentor.name).toBe("Linus");
      expect(data.matches[0].score).toBeGreaterThan(70);
    });

    it("fetches matches by menteeId via GET", async () => {
      const mentorRes = await postMentor(new Request("http://localhost/api/mentorship/mentors", {
        method: "POST",
        body: JSON.stringify({
          name: "Guido",
          email: "guido@example.com",
          expertise: ["Python", "CPython"],
        }),
      }));
      const { mentor } = await mentorRes.json();

      const menteeRes = await postMentee(new Request("http://localhost/api/mentorship/mentees", {
        method: "POST",
        body: JSON.stringify({
          name: "PyLearner",
          email: "learner@example.com",
          goals: "Learn Python internals",
          desiredSkills: ["Python"],
        }),
      }));
      const { mentee } = await menteeRes.json();

      const getRes = await getMatches(new Request(`http://localhost/api/mentorship/matches?menteeId=${mentee.id}`));
      expect(getRes.status).toBe(200);
      const data = await getRes.json();
      expect(data.matches[0].mentor.id).toBe(mentor.id);
    });
  });

  describe("Mentorship Workflow: Requests, Sessions, Feedback", () => {
    it("executes full lifecycle: request -> accept -> session -> feedback", async () => {
      // 1. Setup mentor and mentee
      const mRes = await postMentor(new Request("http://localhost/api/mentorship/mentors", {
        method: "POST",
        body: JSON.stringify({
          name: "Mentor Ken",
          email: "ken@example.com",
          expertise: ["Go", "Unix"],
          timezone: "UTC",
        }),
      }));
      const { mentor } = await mRes.json();

      const eRes = await postMentee(new Request("http://localhost/api/mentorship/mentees", {
        method: "POST",
        body: JSON.stringify({
          name: "Mentee Rob",
          email: "rob@example.com",
          goals: "Learn Go systems",
          desiredSkills: ["Go"],
          timezone: "UTC",
        }),
      }));
      const { mentee } = await eRes.json();

      // 2. Request mentorship
      const reqRes = await postRequest(new Request("http://localhost/api/mentorship/requests", {
        method: "POST",
        body: JSON.stringify({
          mentorId: mentor.id,
          menteeId: mentee.id,
          message: "Would love your guidance on Go!",
        }),
      }));
      expect(reqRes.status).toBe(201);
      const { mentorship } = await reqRes.json();
      expect(mentorship.status).toBe("pending");

      // Verify list requests
      const listReq = await getRequests(new Request(`http://localhost/api/mentorship/requests?mentorId=${mentor.id}`));
      const listData = await listReq.json();
      expect(listData.requests).toHaveLength(1);

      // 3. Accept mentorship
      const acceptRes = await patchRequest(
        new Request(`http://localhost/api/mentorship/requests/${mentorship.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            action: "accept",
            responseMessage: "Glad to mentor you!",
          }),
        }),
        { params: Promise.resolve({ id: mentorship.id }) }
      );
      expect(acceptRes.status).toBe(200);
      const acceptedData = await acceptRes.json();
      expect(acceptedData.mentorship.status).toBe("accepted");

      // 4. Schedule session
      const sessRes = await postSession(new Request("http://localhost/api/mentorship/sessions", {
        method: "POST",
        body: JSON.stringify({
          mentorshipId: mentorship.id,
          title: "Introduction and Goals",
          scheduledAt: "2026-12-05T10:00:00Z",
          durationMinutes: 45,
          meetingUrl: "https://meet.google.com/xyz",
        }),
      }));
      expect(sessRes.status).toBe(201);
      const { session } = await sessRes.json();
      expect(session.status).toBe("scheduled");

      // Complete session
      const completeRes = await patchSession(new Request("http://localhost/api/mentorship/sessions", {
        method: "PATCH",
        body: JSON.stringify({
          mentorshipId: mentorship.id,
          sessionId: session.id,
          status: "completed",
          notes: "Introductions done, task assigned.",
        }),
      }));
      expect(completeRes.status).toBe(200);

      // Verify session list
      const sessListRes = await getSessions(new Request(`http://localhost/api/mentorship/sessions?mentorshipId=${mentorship.id}`));
      const sessListData = await sessListRes.json();
      expect(sessListData.sessions[0].status).toBe("completed");

      // 5. Submit feedback
      const fbRes = await postFeedback(new Request("http://localhost/api/mentorship/feedback", {
        method: "POST",
        body: JSON.stringify({
          mentorshipId: mentorship.id,
          role: "mentee",
          rating: 5,
          comment: "Best mentor experience ever!",
        }),
      }));
      expect(fbRes.status).toBe(200);
      const fbData = await fbRes.json();
      expect(fbData.mentorship.feedback.mentorRating).toBe(5);

      // Verify mentor rating updated
      const mentorCheck = await getMentors(new Request(`http://localhost/api/mentorship/mentors`));
      const mentorCheckData = await mentorCheck.json();
      const updatedKen = mentorCheckData.mentors.find((m: any) => m.id === mentor.id);
      expect(updatedKen.rating).toBe(50); // 5.0
      expect(updatedKen.reviewCount).toBe(1);
    });
  });
});
