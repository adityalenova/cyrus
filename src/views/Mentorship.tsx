"use client";

/* ══ src/views/Mentorship.tsx — automated mentorship matching system ══════
   Matches aspiring open-source contributors with mentors based on:
   - Technical skills overlap (exact and fuzzy matching)
   - Domain interests
   - Weekly availability & capacity
   - Timezone proximity
   ═════════════════════════════════════════════════════════════════════════ */

import { useState, useEffect, useMemo } from "react";
import type {
  Mentor,
  Mentorship,
  MentorMatch,
  Mentee,
} from "@/lib/mentorship/types";
import { computeCompatibility, rankMentorsForMentee } from "@/lib/mentorship/matching";

const W = "max-w-[1240px] mx-auto px-6";

const SAMPLE_MENTORS: Mentor[] = [
  {
    id: "sample-mentor-1",
    name: "Dr. Elena Rostova",
    email: "elena@cyrus.example",
    bio: "Core contributor to TypeScript tooling and high-performance WebAssembly runtimes. Former GSoC organization administrator.",
    expertise: ["TypeScript", "Rust", "WebAssembly", "Node.js", "Compilers"],
    interests: ["Open Source", "Performance", "Developer Tooling", "Web Standards"],
    timezone: "UTC+1",
    availabilityHours: 6,
    maxMentees: 3,
    currentMentees: 1,
    status: "active",
    rating: 49,
    reviewCount: 18,
    createdAt: "2026-01-10T12:00:00Z",
    updatedAt: "2026-01-10T12:00:00Z",
  },
  {
    id: "sample-mentor-2",
    name: "Marcus Vance",
    email: "marcus@cyrus.example",
    bio: "Full stack staff engineer specializing in Next.js, distributed PostgreSQL databases, and high-load web architectures.",
    expertise: ["React", "Next.js", "PostgreSQL", "TypeScript", "Tailwind CSS"],
    interests: ["Web Development", "Open Source", "Design Systems", "Cloud Architecture"],
    timezone: "UTC-5",
    availabilityHours: 5,
    maxMentees: 2,
    currentMentees: 0,
    status: "active",
    rating: 48,
    reviewCount: 14,
    createdAt: "2026-01-15T12:00:00Z",
    updatedAt: "2026-01-15T12:00:00Z",
  },
  {
    id: "sample-mentor-3",
    name: "Aisha Patel",
    email: "aisha@cyrus.example",
    bio: "Cloud native maintainer and Kubernetes SIG lead. Passionate about guiding first-time open-source contributors.",
    expertise: ["Go", "Kubernetes", "Docker", "Linux", "gRPC"],
    interests: ["DevOps", "Open Source", "Microservices", "Security"],
    timezone: "UTC+5:30",
    availabilityHours: 4,
    maxMentees: 2,
    currentMentees: 1,
    status: "active",
    rating: 47,
    reviewCount: 9,
    createdAt: "2026-02-01T12:00:00Z",
    updatedAt: "2026-02-01T12:00:00Z",
  },
  {
    id: "sample-mentor-4",
    name: "Carlos Gomez",
    email: "carlos@cyrus.example",
    bio: "Machine learning research engineer contributing to PyTorch and open weights foundational models.",
    expertise: ["Python", "PyTorch", "NumPy", "Hugging Face", "FastAPI"],
    interests: ["AI/ML", "Open Source", "Research", "Data Science"],
    timezone: "UTC-8",
    availabilityHours: 4,
    maxMentees: 2,
    currentMentees: 2,
    status: "busy",
    rating: 50,
    reviewCount: 22,
    createdAt: "2026-02-10T12:00:00Z",
    updatedAt: "2026-02-10T12:00:00Z",
  },
];

export default function MentorshipView() {
  const [tab, setTab] = useState<"find" | "mentor" | "dashboard">("find");

  // Mentee query preferences
  const [goals, setGoals] = useState("Land first open-source contributions and master modern TypeScript workflows");
  const [desiredSkills, setDesiredSkills] = useState<string[]>(["TypeScript", "React", "Next.js"]);
  const [skillInput, setSkillInput] = useState("");
  const [currentSkills, setCurrentSkills] = useState<string[]>(["JavaScript", "HTML", "CSS"]);
  const [currSkillInput, setCurrSkillInput] = useState("");
  const [interests, setInterests] = useState<string[]>(["Open Source", "Web Development"]);
  const [interestInput, setInterestInput] = useState("");
  const [availabilityHours, setAvailabilityHours] = useState(5);
  const [timezone, setTimezone] = useState("UTC-5");
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  // Mentors state
  const [mentors, setMentors] = useState<Mentor[]>(SAMPLE_MENTORS);
  const [mentorships, setMentorships] = useState<Mentorship[]>([]);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  // Request modal state
  const [requestTargetMentor, setRequestTargetMentor] = useState<Mentor | null>(null);
  const [requestMessage, setRequestMessage] = useState("");
  const [requestSending, setRequestSending] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);

  // Mentor registration form state
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regBio, setRegBio] = useState("");
  const [regExpertise, setRegExpertise] = useState("TypeScript, React, Node.js");
  const [regInterests, setRegInterests] = useState("Open Source, Web Development");
  const [regTimezone, setRegTimezone] = useState("UTC");
  const [regHours, setRegHours] = useState(5);
  const [regMaxMentees, setRegMaxMentees] = useState(2);
  const [regSubmitting, setRegSubmitting] = useState(false);
  const [regMessage, setRegMessage] = useState<string | null>(null);

  // Session scheduling state
  const [sessionTitle, setSessionTitle] = useState("");
  const [sessionDateTime, setSessionDateTime] = useState("");
  const [sessionDuration, setSessionDuration] = useState(45);
  const [sessionMeetUrl, setSessionMeetUrl] = useState("");
  const [activeMentorshipForSession, setActiveMentorshipForSession] = useState<string | null>(null);

  // Feedback modal
  const [ratingTargetMentorship, setRatingTargetMentorship] = useState<Mentorship | null>(null);
  const [selectedRating, setSelectedRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState("");

  // Load mentors and mentorships on mount
  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/api/mentorship/mentors");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.mentors) && data.mentors.length > 0) {
            // Merge with sample mentors avoiding id collisions
            const ids = new Set(data.mentors.map((m: Mentor) => m.id));
            const merged = [...data.mentors, ...SAMPLE_MENTORS.filter((s) => !ids.has(s.id))];
            setMentors(merged);
          }
        }
      } catch {
        // Fallback to sample mentors
      }

      try {
        const relRes = await fetch("/api/mentorship/requests");
        if (relRes.ok) {
          const relData = await relRes.json();
          if (Array.isArray(relData.requests)) {
            setMentorships(relData.requests);
          }
        }
      } catch {
        // Ignore fallback
      }
    }
    loadData();
  }, []);

  // Compute matches dynamically
  const candidateMentee: Mentee = useMemo(() => ({
    id: "active-mentee-profile",
    name: "You (Aspiring Contributor)",
    email: "contributor@cyrus.example",
    goals,
    skillLevel: "beginner",
    interests,
    currentSkills,
    desiredSkills,
    timezone,
    availabilityHours,
    status: "seeking",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }), [goals, interests, currentSkills, desiredSkills, timezone, availabilityHours]);

  const matches: MentorMatch[] = useMemo(() => {
    return rankMentorsForMentee(mentors, candidateMentee, {
      onlyAvailable,
    });
  }, [mentors, candidateMentee, onlyAvailable]);

  // Skill tags helpers
  const addDesiredSkill = () => {
    const s = skillInput.trim();
    if (s && !desiredSkills.includes(s)) {
      setDesiredSkills([...desiredSkills, s]);
      setSkillInput("");
    }
  };

  const removeDesiredSkill = (skill: string) => {
    setDesiredSkills(desiredSkills.filter((s) => s !== skill));
  };

  const addCurrentSkill = () => {
    const s = currSkillInput.trim();
    if (s && !currentSkills.includes(s)) {
      setCurrentSkills([...currentSkills, s]);
      setCurrSkillInput("");
    }
  };

  const removeCurrentSkill = (skill: string) => {
    setCurrentSkills(currentSkills.filter((s) => s !== skill));
  };

  const addInterest = () => {
    const i = interestInput.trim();
    if (i && !interests.includes(i)) {
      setInterests([...interests, i]);
      setInterestInput("");
    }
  };

  const removeInterest = (item: string) => {
    setInterests(interests.filter((i) => i !== item));
  };

  // Submit mentorship request
  const submitMentorshipRequest = async () => {
    if (!requestTargetMentor) return;
    setRequestSending(true);
    setRequestSuccess(false);

    try {
      const res = await fetch("/api/mentorship/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mentorId: requestTargetMentor.id,
          menteeId: candidateMentee.id,
          message: requestMessage,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMentorships((prev) => [data.mentorship, ...prev]);
        setRequestSuccess(true);
        setTimeout(() => {
          setRequestTargetMentor(null);
          setRequestMessage("");
          setRequestSuccess(false);
          setTab("dashboard");
        }, 1200);
      } else {
        const err = await res.json();
        alert(err.error || "Failed to submit request");
      }
    } catch {
      // Local fallback simulation
      const details = computeCompatibility(requestTargetMentor, candidateMentee);
      const fakeRel: Mentorship = {
        id: `rel-${Date.now()}`,
        mentorId: requestTargetMentor.id,
        menteeId: candidateMentee.id,
        status: "pending",
        compatibilityScore: details.overallScore,
        matchDetails: details,
        message: requestMessage,
        responseMessage: null,
        sessions: [],
        feedback: null,
        startedAt: null,
        completedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setMentorships((prev) => [fakeRel, ...prev]);
      setRequestSuccess(true);
      setTimeout(() => {
        setRequestTargetMentor(null);
        setRequestMessage("");
        setRequestSuccess(false);
        setTab("dashboard");
      }, 1200);
    } finally {
      setRequestSending(false);
    }
  };

  // Handle respond to request
  const handleRespond = async (mentorshipId: string, action: "accept" | "decline") => {
    try {
      const res = await fetch(`/api/mentorship/requests/${mentorshipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          responseMessage: action === "accept" ? "Request accepted. Let's build together!" : "Unable to take on new mentees at this time.",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setMentorships((prev) => prev.map((m) => (m.id === mentorshipId ? data.mentorship : m)));
      } else {
        // Fallback local state update
        setMentorships((prev) =>
          prev.map((m) =>
            m.id === mentorshipId
              ? {
                  ...m,
                  status: action === "accept" ? "accepted" : "declined",
                  startedAt: action === "accept" ? new Date().toISOString() : null,
                }
              : m
          )
        );
      }
    } catch {
      setMentorships((prev) =>
        prev.map((m) =>
          m.id === mentorshipId
            ? {
                ...m,
                status: action === "accept" ? "accepted" : "declined",
                startedAt: action === "accept" ? new Date().toISOString() : null,
              }
            : m
        )
      );
    }
  };

  // Handle schedule session
  const handleScheduleSession = async (mentorshipId: string) => {
    if (!sessionTitle || !sessionDateTime) return;
    try {
      const res = await fetch("/api/mentorship/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mentorshipId,
          title: sessionTitle,
          scheduledAt: sessionDateTime,
          durationMinutes: sessionDuration,
          meetingUrl: sessionMeetUrl || null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMentorships((prev) =>
          prev.map((m) =>
            m.id === mentorshipId ? { ...m, sessions: [...m.sessions, data.session] } : m
          )
        );
      } else {
        // Fallback
        const newSess = {
          id: `sess-${Date.now()}`,
          title: sessionTitle,
          scheduledAt: sessionDateTime,
          durationMinutes: sessionDuration,
          status: "scheduled" as const,
          meetingUrl: sessionMeetUrl || null,
          createdAt: new Date().toISOString(),
        };
        setMentorships((prev) =>
          prev.map((m) =>
            m.id === mentorshipId ? { ...m, sessions: [...m.sessions, newSess] } : m
          )
        );
      }
    } catch {
      const newSess = {
        id: `sess-${Date.now()}`,
        title: sessionTitle,
        scheduledAt: sessionDateTime,
        durationMinutes: sessionDuration,
        status: "scheduled" as const,
        meetingUrl: sessionMeetUrl || null,
        createdAt: new Date().toISOString(),
      };
      setMentorships((prev) =>
        prev.map((m) =>
          m.id === mentorshipId ? { ...m, sessions: [...m.sessions, newSess] } : m
        )
      );
    }

    setSessionTitle("");
    setSessionDateTime("");
    setSessionMeetUrl("");
    setActiveMentorshipForSession(null);
  };

  // Complete session
  const handleCompleteSession = async (mentorshipId: string, sessionId: string) => {
    try {
      await fetch("/api/mentorship/sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mentorshipId,
          sessionId,
          status: "completed",
        }),
      });
    } catch {
      // Ignore
    }

    setMentorships((prev) =>
      prev.map((m) =>
        m.id === mentorshipId
          ? {
              ...m,
              sessions: m.sessions.map((s) =>
                s.id === sessionId ? { ...s, status: "completed" as const } : s
              ),
            }
          : m
      )
    );
  };

  // Submit feedback
  const handleFeedbackSubmit = async () => {
    if (!ratingTargetMentorship) return;
    try {
      await fetch("/api/mentorship/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mentorshipId: ratingTargetMentorship.id,
          role: "mentee",
          rating: selectedRating,
          comment: feedbackComment,
        }),
      });
    } catch {
      // Ignore
    }

    setMentorships((prev) =>
      prev.map((m) =>
        m.id === ratingTargetMentorship.id
          ? {
              ...m,
              feedback: {
                mentorRating: selectedRating,
                mentorComment: feedbackComment,
                submittedAt: new Date().toISOString(),
              },
            }
          : m
      )
    );

    // Update local mentor rating
    setMentors((prev) =>
      prev.map((mentor) => {
        if (mentor.id === ratingTargetMentorship.mentorId) {
          const currentScaled = mentor.rating * mentor.reviewCount;
          const newScaled = selectedRating * 10;
          const newCount = mentor.reviewCount + 1;
          const newAvg = Math.round((currentScaled + newScaled) / newCount);
          return {
            ...mentor,
            rating: newAvg,
            reviewCount: newCount,
          };
        }
        return mentor;
      })
    );

    setFeedbackSuccess("Feedback and rating submitted successfully.");
    setTimeout(() => {
      setRatingTargetMentorship(null);
      setFeedbackComment("");
      setFeedbackSuccess(null);
    }, 1200);
  };

  // Mentor registration submit
  const handleRegisterMentor = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegSubmitting(true);
    setRegMessage(null);

    const expertiseList = regExpertise
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const interestsList = regInterests
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const res = await fetch("/api/mentorship/mentors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: regName,
          email: regEmail,
          bio: regBio,
          expertise: expertiseList,
          interests: interestsList,
          timezone: regTimezone,
          availabilityHours: regHours,
          maxMentees: regMaxMentees,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMentors((prev) => [data.mentor, ...prev]);
        setRegMessage("Mentor profile registered successfully. You are now discoverable by mentees.");
        setRegName("");
        setRegEmail("");
        setRegBio("");
      } else {
        const err = await res.json();
        setRegMessage(err.error || "Failed to register mentor.");
      }
    } catch {
      // Local fallback
      const fakeMentor: Mentor = {
        id: `mentor-${Date.now()}`,
        name: regName,
        email: regEmail,
        bio: regBio,
        expertise: expertiseList,
        interests: interestsList,
        timezone: regTimezone,
        availabilityHours: regHours,
        maxMentees: regMaxMentees,
        currentMentees: 0,
        status: "active",
        rating: 0,
        reviewCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setMentors((prev) => [fakeMentor, ...prev]);
      setRegMessage("Mentor profile created in local preview.");
      setRegName("");
      setRegEmail("");
      setRegBio("");
    } finally {
      setRegSubmitting(false);
    }
  };

  return (
    <div className="py-10">
      <div className={W}>
        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-leaf/10 text-leaf border border-leaf/20 mb-3">
            <span>Automated Matching Engine</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-ink tracking-tight">
            Open-Source Mentorship
          </h1>
          <p className="mt-2 text-cocoa text-base sm:text-lg max-w-3xl">
            Match aspiring contributors with experienced open-source maintainers based on skill overlap,
            domain interests, weekly availability, and timezone proximity.
          </p>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-line mb-8 gap-2 overflow-x-auto">
          <button
            onClick={() => setTab("find")}
            className={`px-4 py-2.5 font-medium text-sm transition-colors border-b-2 -mb-px cursor-pointer ${
              tab === "find"
                ? "border-coffee text-coffee font-semibold"
                : "border-transparent text-cocoa hover:text-ink"
            }`}
          >
            Find a Mentor ({matches.length})
          </button>
          <button
            onClick={() => setTab("mentor")}
            className={`px-4 py-2.5 font-medium text-sm transition-colors border-b-2 -mb-px cursor-pointer ${
              tab === "mentor"
                ? "border-coffee text-coffee font-semibold"
                : "border-transparent text-cocoa hover:text-ink"
            }`}
          >
            Become a Mentor
          </button>
          <button
            onClick={() => setTab("dashboard")}
            className={`px-4 py-2.5 font-medium text-sm transition-colors border-b-2 -mb-px cursor-pointer relative ${
              tab === "dashboard"
                ? "border-coffee text-coffee font-semibold"
                : "border-transparent text-cocoa hover:text-ink"
            }`}
          >
            My Mentorships & Sessions
            {mentorships.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-leaf/20 text-leaf rounded-full font-bold">
                {mentorships.length}
              </span>
            )}
          </button>
        </div>

        {/* TAB 1: Find a Mentor */}
        {tab === "find" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left sidebar: Mentee criteria */}
            <div className="lg:col-span-4 bg-card rounded-2xl border border-line p-6 space-y-6">
              <div>
                <h2 className="text-base font-bold text-ink">Your Learning Profile</h2>
                <p className="text-xs text-cocoa mt-1">
                  Adjust your criteria to recalculate real-time compatibility scores.
                </p>
              </div>

              {/* Goals */}
              <div>
                <label className="block text-xs font-semibold text-cocoa mb-1 uppercase tracking-wider">
                  Contribution Goals
                </label>
                <textarea
                  value={goals}
                  onChange={(e) => setGoals(e.target.value)}
                  rows={2}
                  className="w-full text-sm bg-sand/30 border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:ring-1 focus:ring-coffee resize-none"
                  placeholder="What do you want to build or learn?"
                />
              </div>

              {/* Desired Skills */}
              <div>
                <label className="block text-xs font-semibold text-cocoa mb-1 uppercase tracking-wider">
                  Desired Skills to Learn
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {desiredSkills.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-coffee/10 text-coffee border border-coffee/20"
                    >
                      {skill}
                      <button
                        onClick={() => removeDesiredSkill(skill)}
                        className="hover:text-red-500 font-bold ml-1 cursor-pointer"
                        title="Remove skill"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addDesiredSkill())}
                    placeholder="e.g. Rust, Go, Next.js"
                    className="flex-1 text-xs bg-sand/30 border border-line rounded-lg px-3 py-1.5 text-ink focus:outline-none"
                  />
                  <button
                    onClick={addDesiredSkill}
                    type="button"
                    className="px-3 py-1.5 bg-coffee text-foam rounded-lg text-xs font-medium hover:opacity-90 cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Current Skills */}
              <div>
                <label className="block text-xs font-semibold text-cocoa mb-1 uppercase tracking-wider">
                  Current Skills
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {currentSkills.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-sand text-ink border border-line"
                    >
                      {skill}
                      <button
                        onClick={() => removeCurrentSkill(skill)}
                        className="hover:text-red-500 font-bold ml-1 cursor-pointer"
                        title="Remove skill"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={currSkillInput}
                    onChange={(e) => setCurrSkillInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCurrentSkill())}
                    placeholder="e.g. JavaScript, Git"
                    className="flex-1 text-xs bg-sand/30 border border-line rounded-lg px-3 py-1.5 text-ink focus:outline-none"
                  />
                  <button
                    onClick={addCurrentSkill}
                    type="button"
                    className="px-3 py-1.5 bg-card border border-line text-ink rounded-lg text-xs font-medium hover:bg-sand cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Domain Interests */}
              <div>
                <label className="block text-xs font-semibold text-cocoa mb-1 uppercase tracking-wider">
                  Domain Interests
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {interests.map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-honey/15 text-honey border border-honey/30"
                    >
                      {item}
                      <button
                        onClick={() => removeInterest(item)}
                        className="hover:text-red-500 font-bold ml-1 cursor-pointer"
                        title="Remove interest"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={interestInput}
                    onChange={(e) => setInterestInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addInterest())}
                    placeholder="e.g. AI/ML, DevOps"
                    className="flex-1 text-xs bg-sand/30 border border-line rounded-lg px-3 py-1.5 text-ink focus:outline-none"
                  />
                  <button
                    onClick={addInterest}
                    type="button"
                    className="px-3 py-1.5 bg-card border border-line text-ink rounded-lg text-xs font-medium hover:bg-sand cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Timezone & Availability */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-cocoa mb-1">Timezone</label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full text-xs bg-sand/30 border border-line rounded-lg px-2.5 py-2 text-ink focus:outline-none"
                  >
                    <option value="UTC-8">UTC-8 (PST)</option>
                    <option value="UTC-5">UTC-5 (EST)</option>
                    <option value="UTC">UTC (GMT)</option>
                    <option value="UTC+1">UTC+1 (CET)</option>
                    <option value="UTC+5:30">UTC+5:30 (IST)</option>
                    <option value="UTC+8">UTC+8 (CST)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-cocoa mb-1">
                    Hours / Wk ({availabilityHours}h)
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={availabilityHours}
                    onChange={(e) => setAvailabilityHours(Number(e.target.value))}
                    className="w-full accent-coffee cursor-pointer mt-2"
                  />
                </div>
              </div>

              {/* Filter toggle */}
              <div className="pt-2 border-t border-line">
                <label className="flex items-center gap-2 text-xs text-cocoa cursor-pointer">
                  <input
                    type="checkbox"
                    checked={onlyAvailable}
                    onChange={(e) => setOnlyAvailable(e.target.checked)}
                    className="rounded accent-coffee"
                  />
                  Only show mentors with open capacity
                </label>
              </div>
            </div>

            {/* Right side: Ranked Mentors list */}
            <div className="lg:col-span-8 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold text-cocoa">
                  Ranked by Weighted Compatibility ({matches.length} mentors found)
                </div>
                <div className="text-xs text-cocoa">
                  Weights: Skills 45% · Interests 20% · Availability 20% · Timezone 15%
                </div>
              </div>

              {matches.length === 0 ? (
                <div className="bg-card rounded-2xl border border-line p-10 text-center text-cocoa">
                  <p className="font-semibold text-base text-ink">No mentors match the selected criteria.</p>
                  <p className="text-xs mt-1">Try broadening your desired skills or disabling the capacity filter.</p>
                </div>
              ) : (
                matches.map(({ mentor, score, details, available }) => {
                  const ratingDisplay = mentor.reviewCount > 0 ? (mentor.rating / 10).toFixed(1) : "New";
                  const scoreColor =
                    score >= 80
                      ? "text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                      : score >= 60
                      ? "text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                      : "text-zinc-600 bg-zinc-100 border-zinc-200 dark:bg-zinc-800/40 dark:text-zinc-400 dark:border-zinc-700";

                  return (
                    <div
                      key={mentor.id}
                      className="bg-card rounded-2xl border border-line p-5 hover:border-line/80 transition-all shadow-sm space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-3">
                            <h3 className="text-lg font-bold text-ink">{mentor.name}</h3>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${scoreColor}`}
                            >
                              {score}% Match
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                                available
                                  ? "bg-leaf/10 text-leaf border border-leaf/20"
                                  : "bg-red-50 text-red-600 border border-red-200"
                              }`}
                            >
                              {available ? "Available" : "At Capacity"}
                            </span>
                          </div>
                          {mentor.bio && (
                            <p className="text-xs text-cocoa mt-1.5 leading-relaxed max-w-xl">
                              {mentor.bio}
                            </p>
                          )}
                        </div>

                        <div className="flex sm:flex-col items-end justify-between sm:justify-start gap-2 shrink-0">
                          <div className="text-right">
                            <div className="text-xs font-bold text-ink">
                              Rating: {ratingDisplay}
                              {mentor.reviewCount > 0 && ` (${mentor.reviewCount} reviews)`}
                            </div>
                            <div className="text-[11px] text-cocoa mt-0.5">
                              {mentor.timezone} · {mentor.availabilityHours}h/wk
                            </div>
                          </div>
                          <button
                            onClick={() => setRequestTargetMentor(mentor)}
                            disabled={!available}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                              available
                                ? "bg-coffee text-foam hover:opacity-95"
                                : "bg-line/40 text-cocoa/60 cursor-not-allowed"
                            }`}
                          >
                            Request Mentorship
                          </button>
                        </div>
                      </div>

                      {/* Compatibility breakdown bars */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-line text-xs">
                        <div className="bg-sand/30 p-2 rounded-lg border border-line/60">
                          <div className="text-[10px] uppercase font-bold text-cocoa tracking-wider">
                            Skill Fit
                          </div>
                          <div className="font-bold text-ink mt-0.5">{details.skillScore}%</div>
                          <div className="text-[10px] text-cocoa mt-0.5 truncate">
                            {details.matchedSkills.length > 0
                              ? details.matchedSkills.join(", ")
                              : "No direct overlap"}
                          </div>
                        </div>

                        <div className="bg-sand/30 p-2 rounded-lg border border-line/60">
                          <div className="text-[10px] uppercase font-bold text-cocoa tracking-wider">
                            Interests
                          </div>
                          <div className="font-bold text-ink mt-0.5">{details.interestScore}%</div>
                          <div className="text-[10px] text-cocoa mt-0.5 truncate">
                            {details.matchedInterests.length > 0
                              ? details.matchedInterests.join(", ")
                              : "None in common"}
                          </div>
                        </div>

                        <div className="bg-sand/30 p-2 rounded-lg border border-line/60">
                          <div className="text-[10px] uppercase font-bold text-cocoa tracking-wider">
                            Availability
                          </div>
                          <div className="font-bold text-ink mt-0.5">{details.availabilityScore}%</div>
                          <div className="text-[10px] text-cocoa mt-0.5">
                            {details.overlapHours}h overlap · {mentor.maxMentees - mentor.currentMentees} slot(s) open
                          </div>
                        </div>

                        <div className="bg-sand/30 p-2 rounded-lg border border-line/60">
                          <div className="text-[10px] uppercase font-bold text-cocoa tracking-wider">
                            Timezone
                          </div>
                          <div className="font-bold text-ink mt-0.5">{details.timezoneScore}%</div>
                          <div className="text-[10px] text-cocoa mt-0.5">
                            {details.timezoneDiffHours}h offset difference
                          </div>
                        </div>
                      </div>

                      {/* Expertise badges */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[11px] font-semibold text-cocoa mr-1">Expertise:</span>
                        {mentor.expertise.map((skill) => {
                          const isMatched = details.matchedSkills.includes(skill);
                          return (
                            <span
                              key={skill}
                              className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                                isMatched
                                  ? "bg-leaf/15 text-leaf border-leaf/30 font-semibold"
                                  : "bg-sand/40 text-ink border-line/60"
                              }`}
                            >
                              {skill}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 2: Become a Mentor */}
        {tab === "mentor" && (
          <div className="max-w-2xl mx-auto bg-card rounded-2xl border border-line p-8 space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-ink">Register as a Mentor</h2>
              <p className="text-sm text-cocoa mt-1">
                Share your open-source journey, guide new contributors, and build the next generation of engineers.
              </p>
            </div>

            {regMessage && (
              <div className="p-4 rounded-xl bg-leaf/10 border border-leaf/20 text-leaf text-sm font-medium">
                {regMessage}
              </div>
            )}

            <form onSubmit={handleRegisterMentor} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-cocoa mb-1">Your Full Name</label>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Linus Torvalds"
                    className="w-full text-sm bg-sand/30 border border-line rounded-lg px-3 py-2 text-ink focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-cocoa mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="linus@example.com"
                    className="w-full text-sm bg-sand/30 border border-line rounded-lg px-3 py-2 text-ink focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-cocoa mb-1">Bio & Experience</label>
                <textarea
                  rows={3}
                  value={regBio}
                  onChange={(e) => setRegBio(e.target.value)}
                  placeholder="Tell mentees about your projects, background, and mentoring philosophy..."
                  className="w-full text-sm bg-sand/30 border border-line rounded-lg px-3 py-2 text-ink focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-cocoa mb-1">
                  Technical Expertise (comma-separated)
                </label>
                <input
                  type="text"
                  required
                  value={regExpertise}
                  onChange={(e) => setRegExpertise(e.target.value)}
                  placeholder="TypeScript, Rust, PostgreSQL, Next.js"
                  className="w-full text-sm bg-sand/30 border border-line rounded-lg px-3 py-2 text-ink focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-cocoa mb-1">
                  Domain Interests (comma-separated)
                </label>
                <input
                  type="text"
                  value={regInterests}
                  onChange={(e) => setRegInterests(e.target.value)}
                  placeholder="Open Source, Performance, Compilers"
                  className="w-full text-sm bg-sand/30 border border-line rounded-lg px-3 py-2 text-ink focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-cocoa mb-1">Timezone</label>
                  <select
                    value={regTimezone}
                    onChange={(e) => setRegTimezone(e.target.value)}
                    className="w-full text-sm bg-sand/30 border border-line rounded-lg px-3 py-2 text-ink focus:outline-none"
                  >
                    <option value="UTC-8">UTC-8 (PST)</option>
                    <option value="UTC-5">UTC-5 (EST)</option>
                    <option value="UTC">UTC (GMT)</option>
                    <option value="UTC+1">UTC+1 (CET)</option>
                    <option value="UTC+5:30">UTC+5:30 (IST)</option>
                    <option value="UTC+8">UTC+8 (CST)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-cocoa mb-1">Weekly Hours</label>
                  <input
                    type="number"
                    min="1"
                    max="40"
                    value={regHours}
                    onChange={(e) => setRegHours(Number(e.target.value))}
                    className="w-full text-sm bg-sand/30 border border-line rounded-lg px-3 py-2 text-ink focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-cocoa mb-1">Max Mentees</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={regMaxMentees}
                    onChange={(e) => setRegMaxMentees(Number(e.target.value))}
                    className="w-full text-sm bg-sand/30 border border-line rounded-lg px-3 py-2 text-ink focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={regSubmitting}
                className="w-full py-3 rounded-xl bg-coffee text-foam font-semibold text-sm hover:opacity-95 transition-opacity cursor-pointer disabled:opacity-50"
              >
                {regSubmitting ? "Registering..." : "Submit Mentor Profile"}
              </button>
            </form>
          </div>
        )}

        {/* TAB 3: Mentorships Dashboard */}
        {tab === "dashboard" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-ink">Your Mentorship Relationships</h2>
                <p className="text-xs text-cocoa mt-0.5">
                  Track active engagements, accept requests, schedule video sessions, and leave feedback.
                </p>
              </div>
            </div>

            {mentorships.length === 0 ? (
              <div className="bg-card rounded-2xl border border-line p-12 text-center text-cocoa">
                <p className="font-semibold text-base text-ink">No mentorship relationships yet.</p>
                <p className="text-xs mt-1">Browse the Find a Mentor tab to connect with an experienced maintainer.</p>
                <button
                  onClick={() => setTab("find")}
                  className="mt-4 px-4 py-2 bg-coffee text-foam rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Find Mentors Now
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {mentorships.map((m) => {
                  const targetMentor = mentors.find((men) => men.id === m.mentorId);
                  const isAccepted = m.status === "accepted" || m.status === "active";
                  const isPending = m.status === "pending";

                  return (
                    <div
                      key={m.id}
                      className="bg-card rounded-2xl border border-line p-6 space-y-4 shadow-sm"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-3">
                            <h3 className="text-lg font-bold text-ink">
                              Mentorship with {targetMentor ? targetMentor.name : "Assigned Mentor"}
                            </h3>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                                isAccepted
                                  ? "bg-leaf/10 text-leaf border border-leaf/20"
                                  : isPending
                                  ? "bg-honey/15 text-honey border border-honey/30"
                                  : "bg-red-50 text-red-600 border border-red-200"
                              }`}
                            >
                              {m.status}
                            </span>
                            <span className="text-xs text-cocoa">
                              {m.compatibilityScore}% compatibility
                            </span>
                          </div>
                          {m.message && (
                            <p className="text-xs text-cocoa mt-1 italic">
                              "{m.message}"
                            </p>
                          )}
                        </div>

                        {/* Actions for pending requests */}
                        {isPending && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleRespond(m.id, "accept")}
                              className="px-3 py-1.5 bg-leaf text-foam rounded-lg text-xs font-semibold hover:opacity-95 cursor-pointer"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => handleRespond(m.id, "decline")}
                              className="px-3 py-1.5 bg-card border border-line text-ink rounded-lg text-xs font-semibold hover:bg-sand cursor-pointer"
                            >
                              Decline
                            </button>
                          </div>
                        )}

                        {/* Actions for accepted */}
                        {isAccepted && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => setActiveMentorshipForSession(m.id)}
                              className="px-3 py-1.5 bg-coffee text-foam rounded-lg text-xs font-semibold hover:opacity-95 cursor-pointer"
                            >
                              Schedule Session
                            </button>
                            <button
                              onClick={() => setRatingTargetMentorship(m)}
                              className="px-3 py-1.5 bg-card border border-line text-ink rounded-lg text-xs font-semibold hover:bg-sand cursor-pointer"
                            >
                              {m.feedback?.mentorRating ? "Edit Review" : "Leave Review"}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Sessions section */}
                      {isAccepted && (
                        <div className="pt-4 border-t border-line space-y-3">
                          <h4 className="text-xs font-bold text-ink uppercase tracking-wider">
                            Scheduled Sessions ({m.sessions.length})
                          </h4>
                          {m.sessions.length === 0 ? (
                            <p className="text-xs text-cocoa">No sessions scheduled yet.</p>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {m.sessions.map((sess) => (
                                <div
                                  key={sess.id}
                                  className="bg-sand/30 border border-line/60 rounded-xl p-3 text-xs space-y-2"
                                >
                                  <div className="flex justify-between items-start">
                                    <div className="font-bold text-ink">{sess.title}</div>
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                                        sess.status === "completed"
                                          ? "bg-leaf/10 text-leaf"
                                          : "bg-coffee/10 text-coffee"
                                      }`}
                                    >
                                      {sess.status}
                                    </span>
                                  </div>
                                  <div className="text-cocoa">
                                    {new Date(sess.scheduledAt).toLocaleString()} ({sess.durationMinutes} mins)
                                  </div>
                                  <div className="flex gap-2 pt-1">
                                    {sess.meetingUrl && (
                                      <a
                                        href={sess.meetingUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-coffee font-semibold hover:underline"
                                      >
                                        Join Meeting →
                                      </a>
                                    )}
                                    {sess.status === "scheduled" && (
                                      <button
                                        onClick={() => handleCompleteSession(m.id, sess.id)}
                                        className="text-leaf font-semibold hover:underline cursor-pointer ml-auto"
                                      >
                                        Mark Completed
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Feedback banner if present */}
                      {m.feedback?.mentorRating && (
                        <div className="p-3 bg-honey/10 border border-honey/20 rounded-xl text-xs space-y-1">
                          <div className="font-bold text-ink">
                            Mentee Rating: {m.feedback.mentorRating} / 5 Stars
                          </div>
                          {m.feedback.mentorComment && (
                            <p className="text-cocoa italic">"{m.feedback.mentorComment}"</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Modal: Request Mentorship */}
        {requestTargetMentor && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card border border-line rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-xl">
              <div>
                <h3 className="text-lg font-bold text-ink">
                  Request Mentorship with {requestTargetMentor.name}
                </h3>
                <p className="text-xs text-cocoa mt-1">
                  Introduce yourself, state your goals, and ask for guidance on your open-source journey.
                </p>
              </div>

              {requestSuccess ? (
                <div className="p-4 rounded-xl bg-leaf/10 border border-leaf/20 text-leaf text-sm font-semibold text-center">
                  Request sent successfully! Redirecting to dashboard...
                </div>
              ) : (
                <>
                  <textarea
                    rows={4}
                    value={requestMessage}
                    onChange={(e) => setRequestMessage(e.target.value)}
                    placeholder="Hi! I am enthusiastic about your work in open source and would love guidance on contributing..."
                    className="w-full text-sm bg-sand/30 border border-line rounded-lg p-3 text-ink focus:outline-none resize-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setRequestTargetMentor(null)}
                      disabled={requestSending}
                      className="px-4 py-2 border border-line rounded-lg text-xs font-semibold text-ink hover:bg-sand cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={submitMentorshipRequest}
                      disabled={requestSending}
                      className="px-4 py-2 bg-coffee text-foam rounded-lg text-xs font-semibold hover:opacity-95 cursor-pointer disabled:opacity-50"
                    >
                      {requestSending ? "Sending..." : "Send Request"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Modal: Schedule Session */}
        {activeMentorshipForSession && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card border border-line rounded-2xl p-6 max-w-md w-full space-y-4 shadow-xl">
              <h3 className="text-lg font-bold text-ink">Schedule Mentorship Session</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-cocoa mb-1">Session Title</label>
                  <input
                    type="text"
                    required
                    value={sessionTitle}
                    onChange={(e) => setSessionTitle(e.target.value)}
                    placeholder="Architecture Review & PR Discussion"
                    className="w-full text-sm bg-sand/30 border border-line rounded-lg px-3 py-2 text-ink focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-cocoa mb-1">Date & Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={sessionDateTime}
                    onChange={(e) => setSessionDateTime(e.target.value)}
                    className="w-full text-sm bg-sand/30 border border-line rounded-lg px-3 py-2 text-ink focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-cocoa mb-1">Duration (min)</label>
                    <input
                      type="number"
                      min="15"
                      max="180"
                      value={sessionDuration}
                      onChange={(e) => setSessionDuration(Number(e.target.value))}
                      className="w-full text-sm bg-sand/30 border border-line rounded-lg px-3 py-2 text-ink focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-cocoa mb-1">Meeting Link (optional)</label>
                    <input
                      type="url"
                      value={sessionMeetUrl}
                      onChange={(e) => setSessionMeetUrl(e.target.value)}
                      placeholder="https://meet.google.com/..."
                      className="w-full text-sm bg-sand/30 border border-line rounded-lg px-3 py-2 text-ink focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setActiveMentorshipForSession(null)}
                  className="px-4 py-2 border border-line rounded-lg text-xs font-semibold text-ink hover:bg-sand cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleScheduleSession(activeMentorshipForSession)}
                  className="px-4 py-2 bg-coffee text-foam rounded-lg text-xs font-semibold hover:opacity-95 cursor-pointer"
                >
                  Confirm Session
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Rating and Feedback */}
        {ratingTargetMentorship && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card border border-line rounded-2xl p-6 max-w-md w-full space-y-4 shadow-xl">
              <div>
                <h3 className="text-lg font-bold text-ink">Rate Your Mentorship</h3>
                <p className="text-xs text-cocoa mt-1">
                  Your feedback helps maintain high mentoring standards and recalculates the mentor's overall rating.
                </p>
              </div>

              {feedbackSuccess ? (
                <div className="p-4 rounded-xl bg-leaf/10 border border-leaf/20 text-leaf text-sm font-semibold text-center">
                  {feedbackSuccess}
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-cocoa mb-1">Rating</label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setSelectedRating(star)}
                          className={`w-9 h-9 rounded-lg font-bold text-sm cursor-pointer transition-colors ${
                            selectedRating >= star
                              ? "bg-honey text-ink shadow-sm"
                              : "bg-sand/50 text-cocoa border border-line"
                          }`}
                        >
                          {star}★
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-cocoa mb-1">Comments & Review</label>
                    <textarea
                      rows={3}
                      value={feedbackComment}
                      onChange={(e) => setFeedbackComment(e.target.value)}
                      placeholder="Share your learning experience, code reviews, and mentorship impact..."
                      className="w-full text-sm bg-sand/30 border border-line rounded-lg p-3 text-ink focus:outline-none resize-none"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setRatingTargetMentorship(null)}
                      className="px-4 py-2 border border-line rounded-lg text-xs font-semibold text-ink hover:bg-sand cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleFeedbackSubmit}
                      className="px-4 py-2 bg-coffee text-foam rounded-lg text-xs font-semibold hover:opacity-95 cursor-pointer"
                    >
                      Submit Feedback
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
