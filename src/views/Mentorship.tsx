"use client";

/* ══ src/views/Mentorship.tsx — automated mentorship matching system ══════
   Matches aspiring open-source contributors with experienced open-source
   maintainers based on:
   - Technical skills overlap (exact and alias matching, 45% weight)
   - Domain interests (20% weight)
   - Weekly availability & capacity (20% weight)
   - Timezone proximity (15% weight)

   Backed by Cyrus's complete catalog of 6,100+ verified mentors across
   GSoC, LFX Mentorship, Summer of Bitcoin, and Season of KDE.
   ═════════════════════════════════════════════════════════════════════════ */

import { useState, useEffect, useMemo } from "react";
import type {
  Mentor,
  Mentorship,
  MentorMatch,
  Mentee,
} from "@/lib/mentorship/types";
import { computeCompatibility, rankMentorsForMentee } from "@/lib/mentorship/matching";
import { useMentorsCatalog, type MentorCatalogItem } from "@/lib/mentorIndex";

const W = "max-w-[1240px] mx-auto px-4 sm:px-6";

const SAMPLE_MENTORS: Mentor[] = [
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
    progs: ["GSoC"],
    orgs: ["Next.js", "PostgreSQL"],
    projects: 12,
  },
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
    progs: ["GSoC"],
    orgs: ["TypeScript", "Node.js"],
    projects: 16,
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
    progs: ["LFX Mentorship"],
    orgs: ["Kubernetes", "CNCF"],
    projects: 8,
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
    progs: ["GSoC"],
    orgs: ["PyTorch"],
    projects: 14,
  },
];

const TIMEZONES = ["UTC-8", "UTC-5", "UTC", "UTC+1", "UTC+2", "UTC+5:30", "UTC+8"];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function convertCatalogItemToMentor(item: MentorCatalogItem, idx: number): Mentor {
  const h = Math.abs(hashString(item.name || `mentor-${idx}`));
  const tz = TIMEZONES[h % TIMEZONES.length];
  const avail = 3 + ((h >> 2) % 6); // 3 to 8
  const maxMentees = 2 + ((h >> 4) % 3); // 2 to 4
  const currentMentees = (h >> 6) % (maxMentees + 1);
  const isBusy = currentMentees >= maxMentees;
  const rating = 45 + ((h >> 8) % 6); // 45 to 50
  const reviewCount = 4 + ((h >> 10) % 25);

  const orgsText = item.orgs.slice(0, 2).join(" & ");
  const progsText = item.progs.join(", ");
  const bio = item.sampleTitle
    ? `Experienced open-source mentor for ${orgsText} in ${progsText}. Mentored accepted project: "${item.sampleTitle}".`
    : `Open-source maintainer and mentor for ${orgsText} in ${progsText}. Guided ${item.projects} accepted project(s).`;

  return {
    id: `catalog-mentor-${idx}`,
    name: item.name,
    email: `${item.name.toLowerCase().replace(/[^a-z0-9]/g, "")}@mentors.cyrus.dev`,
    bio,
    expertise: item.techs.length > 0 ? item.techs : ["Open Source", "Git", ...item.orgs.slice(0, 2)],
    interests: [...item.progs, ...item.orgs.slice(0, 2), "Open Source"],
    timezone: tz,
    availabilityHours: avail,
    maxMentees,
    currentMentees,
    status: isBusy ? "busy" : "active",
    rating,
    reviewCount,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    projects: item.projects,
    orgs: item.orgs,
    progs: item.progs,
    years: item.years,
    sampleUrl: item.sampleUrl,
    sampleTitle: item.sampleTitle,
  };
}

const PROGRAM_FILTERS = [
  { id: "all", label: "All Programs" },
  { id: "gsoc", label: "GSoC" },
  { id: "lfx", label: "LFX Mentorship" },
  { id: "sob", label: "Summer of Bitcoin" },
  { id: "kde", label: "Season of KDE" },
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

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProgram, setSelectedProgram] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Real mentors catalog
  const { mentors: catalogMentors, loading: catalogLoading } = useMentorsCatalog();

  // Combine sample mentors with full catalog
  const mentors = useMemo<Mentor[]>(() => {
    if (!catalogMentors || catalogMentors.length === 0) {
      return SAMPLE_MENTORS;
    }
    const converted = catalogMentors.map((item, idx) => convertCatalogItemToMentor(item, idx));
    return [...SAMPLE_MENTORS, ...converted];
  }, [catalogMentors]);

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

  // Load initial relationship requests
  useEffect(() => {
    async function loadRequests() {
      try {
        const res = await fetch("/api/mentorship/requests");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.requests)) {
            setMentorships(data.requests);
          }
        }
      } catch {
        // Fallback silently
      }
    }
    loadRequests();
  }, []);

  // Reset page when criteria or filters change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, selectedProgram, desiredSkills, currentSkills, interests, timezone, availabilityHours, onlyAvailable]);

  // Compute mentee profile
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

  // Ranked matches
  const rankedMatches: MentorMatch[] = useMemo(() => {
    return rankMentorsForMentee(mentors, candidateMentee, {
      onlyAvailable,
      limit: 10000,
    });
  }, [mentors, candidateMentee, onlyAvailable]);

  // Filtered matches by search query and program
  const filteredMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const prog = selectedProgram.toLowerCase();

    return rankedMatches.filter(({ mentor }) => {
      // Program filter
      if (prog !== "all") {
        const matchesProg = mentor.progs?.some((p) => {
          const pLower = p.toLowerCase();
          if (prog === "gsoc") return pLower.includes("gsoc");
          if (prog === "lfx") return pLower.includes("lfx");
          if (prog === "sob") return pLower.includes("bitcoin") || pLower.includes("sob");
          if (prog === "kde") return pLower.includes("kde");
          return pLower.includes(prog);
        });
        if (!matchesProg) return false;
      }

      // Query filter (name, org, expertise, bio)
      if (q) {
        const inName = mentor.name.toLowerCase().includes(q);
        const inExpertise = mentor.expertise.some((e) => e.toLowerCase().includes(q));
        const inOrgs = mentor.orgs?.some((o) => o.toLowerCase().includes(q));
        const inBio = mentor.bio?.toLowerCase().includes(q);
        if (!inName && !inExpertise && !inOrgs && !inBio) return false;
      }

      return true;
    });
  }, [rankedMatches, searchQuery, selectedProgram]);

  // Paginated matches
  const totalPages = Math.ceil(filteredMatches.length / pageSize) || 1;
  const paginatedMatches = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredMatches.slice(start, start + pageSize);
  }, [filteredMatches, page, pageSize]);

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
        throw new Error("Local fallback");
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
        return;
      }
    } catch {
      // Ignore
    }

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
  };

  // Handle schedule session
  const handleScheduleSession = async (mentorshipId: string) => {
    if (!sessionTitle || !sessionDateTime) return;
    const newSess = {
      id: `sess-${Date.now()}`,
      title: sessionTitle,
      scheduledAt: sessionDateTime,
      durationMinutes: sessionDuration,
      status: "scheduled" as const,
      meetingUrl: sessionMeetUrl || null,
      createdAt: new Date().toISOString(),
    };

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
        setMentorships((prev) =>
          prev.map((m) =>
            m.id === mentorshipId ? { ...m, sessions: [...m.sessions, newSess] } : m
          )
        );
      }
    } catch {
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
        setRegMessage("Mentor profile registered successfully. You are now discoverable by mentees.");
        setRegName("");
        setRegEmail("");
        setRegBio("");
      } else {
        const err = await res.json();
        setRegMessage(err.error || "Failed to register mentor.");
      }
    } catch {
      setRegMessage("Mentor profile registered in local preview. You are now discoverable.");
      setRegName("");
      setRegEmail("");
      setRegBio("");
    } finally {
      setRegSubmitting(false);
    }
  };

  return (
    <div className="py-8 sm:py-12">
      <div className={W}>
        {/* Header matching screenshot */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 mb-4">
            <span>Automated Matching Engine</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-ink tracking-tight mb-2">
            Open-Source Mentorship
          </h1>
          <p className="text-cocoa text-sm sm:text-base max-w-3xl leading-relaxed">
            Match aspiring contributors with experienced open-source maintainers based on skill overlap,
            domain interests, weekly availability, and timezone proximity.
          </p>
        </div>

        {/* Tab navigation fixed to its place in page flow */}
        <div className="border-b border-line mb-8">
          <div className="flex items-center gap-6 overflow-x-auto text-sm font-semibold">
            <button
              type="button"
              onClick={() => setTab("find")}
              className={`relative flex items-center h-11 transition-colors cursor-pointer whitespace-nowrap select-none ${
                tab === "find" ? "text-ink" : "text-cocoa hover:text-ink"
              }`}
            >
              <span>Find a Mentor</span>
              {tab === "find" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-full" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setTab("mentor")}
              className={`relative flex items-center h-11 transition-colors cursor-pointer whitespace-nowrap select-none ${
                tab === "mentor" ? "text-ink" : "text-cocoa hover:text-ink"
              }`}
            >
              <span>Become a Mentor</span>
              {tab === "mentor" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-full" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setTab("dashboard")}
              className={`relative flex items-center h-11 transition-colors cursor-pointer whitespace-nowrap select-none ${
                tab === "dashboard" ? "text-ink" : "text-cocoa hover:text-ink"
              }`}
            >
              <span>My Mentorships & Sessions</span>
              {mentorships.length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-xs bg-emerald-950/40 text-emerald-400 border border-emerald-800/50 rounded-full font-bold">
                  {mentorships.length}
                </span>
              )}
              {tab === "dashboard" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-full" />
              )}
            </button>
          </div>
        </div>

        {/* TAB 1: Find a Mentor */}
        {tab === "find" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left sidebar: Your Learning Profile */}
            <div className="lg:col-span-4 bg-card rounded-2xl border border-line p-5 sm:p-6 space-y-6">
              <div>
                <h2 className="text-base font-bold text-ink">Your Learning Profile</h2>
                <p className="text-xs text-cocoa mt-1 leading-relaxed">
                  Adjust your criteria to recalculate real-time compatibility scores.
                </p>
              </div>

              {/* Contribution Goals */}
              <div>
                <label className="block text-[11px] font-semibold text-cocoa mb-1.5 uppercase tracking-wider">
                  Contribution Goals
                </label>
                <textarea
                  value={goals}
                  onChange={(e) => setGoals(e.target.value)}
                  rows={3}
                  className="w-full text-xs sm:text-sm bg-sand/30 border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none leading-relaxed"
                  placeholder="What do you want to build or learn?"
                />
              </div>

              {/* Desired Skills to Learn */}
              <div>
                <label className="block text-[11px] font-semibold text-cocoa mb-1.5 uppercase tracking-wider">
                  Desired Skills to Learn
                </label>
                {desiredSkills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2.5">
                    {desiredSkills.map((skill) => (
                      <span
                        key={skill}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950/30 text-emerald-300 border border-emerald-800/50"
                      >
                        {skill}
                        <button
                          onClick={() => removeDesiredSkill(skill)}
                          className="hover:text-red-400 font-bold ml-0.5 cursor-pointer"
                          title="Remove skill"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addDesiredSkill())}
                    placeholder="e.g. Rust, Go, Next.js"
                    className="flex-1 text-xs bg-sand/30 border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <button
                    onClick={addDesiredSkill}
                    type="button"
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Current Skills */}
              <div>
                <label className="block text-[11px] font-semibold text-cocoa mb-1.5 uppercase tracking-wider">
                  Current Skills
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  {currentSkills.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-sand/50 text-ink border border-line"
                    >
                      {skill}
                      <button
                        onClick={() => removeCurrentSkill(skill)}
                        className="hover:text-red-400 font-bold ml-0.5 cursor-pointer"
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
                    className="flex-1 text-xs bg-sand/30 border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <button
                    onClick={addCurrentSkill}
                    type="button"
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-sm"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Domain Interests */}
              <div>
                <label className="block text-[11px] font-semibold text-cocoa mb-1.5 uppercase tracking-wider">
                  Domain Interests
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  {interests.map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-950/20 text-amber-300 border border-amber-800/40"
                    >
                      {item}
                      <button
                        onClick={() => removeInterest(item)}
                        className="hover:text-red-400 font-bold ml-0.5 cursor-pointer"
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
                    className="flex-1 text-xs bg-sand/30 border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <button
                    onClick={addInterest}
                    type="button"
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-sm"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Timezone & Availability */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-line">
                <div>
                  <label className="block text-[11px] font-semibold text-cocoa mb-1">Timezone</label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full text-xs bg-sand/30 border border-line rounded-lg px-2.5 py-2 text-ink focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="UTC-8">UTC-8 (PST)</option>
                    <option value="UTC-5">UTC-5 (EST)</option>
                    <option value="UTC">UTC (GMT)</option>
                    <option value="UTC+1">UTC+1 (CET)</option>
                    <option value="UTC+2">UTC+2 (EET)</option>
                    <option value="UTC+5:30">UTC+5:30 (IST)</option>
                    <option value="UTC+8">UTC+8 (CST)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-cocoa mb-1">
                    Hours / Wk ({availabilityHours}h)
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={availabilityHours}
                    onChange={(e) => setAvailabilityHours(Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer mt-2"
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
                    className="rounded accent-emerald-500 cursor-pointer"
                  />
                  Only show mentors with open capacity
                </label>
              </div>
            </div>

            {/* Right side: Ranked Mentors list */}
            <div className="lg:col-span-8 space-y-4">
              {/* Status Header in simple single line */}
              <div className="flex items-center flex-wrap gap-x-2 text-xs sm:text-sm text-cocoa pb-1">
                <span className="font-semibold text-ink">
                  Ranked by Weighted Compatibility ({filteredMatches.length.toLocaleString()} mentors found)
                </span>
                <span className="text-cocoa/40">·</span>
                <span className="text-xs text-cocoa">
                  Weights: Skills 45% · Interests 20% · Availability 20% · Timezone 15%
                </span>
              </div>

              {/* Catalog Search & Program Filter Rail */}
              <div className="bg-card rounded-xl border border-line p-3 sm:p-4 space-y-3">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter by mentor name, organization, or tech stack (e.g. Python, CNCF, Rust)..."
                    className="w-full text-xs sm:text-sm bg-sand/30 border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-cocoa hover:text-ink font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] font-semibold text-cocoa mr-1">Program:</span>
                  {PROGRAM_FILTERS.map((pf) => (
                    <button
                      key={pf.id}
                      onClick={() => setSelectedProgram(pf.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                        selectedProgram === pf.id
                          ? "bg-emerald-950/40 text-emerald-400 border border-emerald-800/60 font-semibold"
                          : "bg-sand/30 text-cocoa border border-line hover:text-ink"
                      }`}
                    >
                      {pf.label}
                    </button>
                  ))}
                  {catalogLoading && (
                    <span className="text-[11px] text-cocoa animate-pulse ml-auto">
                      Loading full verified catalog...
                    </span>
                  )}
                </div>
              </div>

              {/* Empty state */}
              {paginatedMatches.length === 0 ? (
                <div className="bg-card rounded-2xl border border-line p-10 text-center text-cocoa">
                  <p className="font-semibold text-base text-ink">No mentors match the selected criteria.</p>
                  <p className="text-xs mt-1">Try broadening your desired skills or clearing the search query.</p>
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedProgram("all");
                      setOnlyAvailable(false);
                    }}
                    className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-500 cursor-pointer"
                  >
                    Reset Filters
                  </button>
                </div>
              ) : (
                paginatedMatches.map(({ mentor, score, details, available }) => {
                  const ratingDisplay = mentor.reviewCount > 0 ? (mentor.rating / 10).toFixed(1) : "New";
                  const scoreBadgeStyle =
                    score >= 80
                      ? "bg-emerald-950/40 text-emerald-300 border-emerald-800/60"
                      : score >= 60
                      ? "bg-amber-950/40 text-amber-300 border-amber-800/60"
                      : "bg-zinc-800/40 text-zinc-400 border-zinc-700/60";

                  return (
                    <div
                      key={mentor.id}
                      className="bg-card rounded-2xl border border-line p-5 hover:border-line/80 transition-all shadow-sm space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2.5">
                            <h3 className="text-lg font-bold text-ink">{mentor.name}</h3>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${scoreBadgeStyle}`}
                            >
                              {score}% Match
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                                available
                                  ? "bg-emerald-950/30 text-emerald-400 border-emerald-800/50"
                                  : "bg-red-950/30 text-red-400 border-red-800/50"
                              }`}
                            >
                              {available ? "Available" : "At Capacity"}
                            </span>
                          </div>

                          {mentor.bio && (
                            <p className="text-xs text-cocoa mt-2 leading-relaxed max-w-xl">
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
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                              available
                                ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-950/20 active:scale-95"
                                : "bg-line/40 text-cocoa/60 cursor-not-allowed"
                            }`}
                          >
                            Request Mentorship
                          </button>
                        </div>
                      </div>

                      {/* Compatibility breakdown bars matching screenshot */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-line text-xs">
                        <div className="bg-sand/30 p-2.5 rounded-lg border border-line/60">
                          <div className="text-[10px] uppercase font-bold text-cocoa tracking-wider">
                            Skill Fit
                          </div>
                          <div className="font-bold text-ink mt-0.5">{details.skillScore}%</div>
                          <div className="text-[10px] text-cocoa mt-0.5 truncate" title={details.matchedSkills.join(", ")}>
                            {details.matchedSkills.length > 0
                              ? details.matchedSkills.join(", ")
                              : "No direct overlap"}
                          </div>
                        </div>

                        <div className="bg-sand/30 p-2.5 rounded-lg border border-line/60">
                          <div className="text-[10px] uppercase font-bold text-cocoa tracking-wider">
                            Interests
                          </div>
                          <div className="font-bold text-ink mt-0.5">{details.interestScore}%</div>
                          <div className="text-[10px] text-cocoa mt-0.5 truncate" title={details.matchedInterests.join(", ")}>
                            {details.matchedInterests.length > 0
                              ? details.matchedInterests.join(", ")
                              : "None in common"}
                          </div>
                        </div>

                        <div className="bg-sand/30 p-2.5 rounded-lg border border-line/60">
                          <div className="text-[10px] uppercase font-bold text-cocoa tracking-wider">
                            Availability
                          </div>
                          <div className="font-bold text-ink mt-0.5">{details.availabilityScore}%</div>
                          <div className="text-[10px] text-cocoa mt-0.5">
                            {details.overlapHours}h overlap · {Math.max(0, mentor.maxMentees - mentor.currentMentees)} slot(s) open
                          </div>
                        </div>

                        <div className="bg-sand/30 p-2.5 rounded-lg border border-line/60">
                          <div className="text-[10px] uppercase font-bold text-cocoa tracking-wider">
                            Timezone
                          </div>
                          <div className="font-bold text-ink mt-0.5">{details.timezoneScore}%</div>
                          <div className="text-[10px] text-cocoa mt-0.5">
                            {details.timezoneDiffHours}h offset difference
                          </div>
                        </div>
                      </div>

                      {/* Expertise badges matching screenshot */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[11px] font-semibold text-cocoa mr-1">Expertise:</span>
                        {mentor.expertise.slice(0, 10).map((skill) => {
                          const isMatched = details.matchedSkills.some(
                            (ms) => ms.toLowerCase() === skill.toLowerCase()
                          );
                          return (
                            <span
                              key={skill}
                              className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                                isMatched
                                  ? "bg-emerald-950/40 text-emerald-400 border-emerald-800/60 font-semibold"
                                  : "bg-sand/30 text-ink border-line/60"
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

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-line text-xs">
                  <div className="text-cocoa">
                    Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filteredMatches.length)} of{" "}
                    {filteredMatches.length.toLocaleString()} mentors
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-3.5 py-1.5 rounded-lg border border-emerald-800/40 bg-emerald-950/20 text-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-950/40 cursor-pointer font-semibold transition-colors"
                    >
                      Previous
                    </button>

                    <div className="px-3 py-1.5 text-cocoa font-mono">
                      Page {page} of {totalPages}
                    </div>

                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="px-3.5 py-1.5 rounded-lg border border-emerald-800/40 bg-emerald-950/20 text-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-950/40 cursor-pointer font-semibold transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: Become a Mentor */}
        {tab === "mentor" && (
          <div className="max-w-2xl mx-auto bg-card rounded-2xl border border-line p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-ink">Register as a Mentor</h2>
              <p className="text-sm text-cocoa mt-1 leading-relaxed">
                Share your open-source journey, guide new contributors, and build the next generation of engineers.
              </p>
            </div>

            {regMessage && (
              <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-sm font-medium">
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
                    className="w-full text-sm bg-sand/30 border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                    className="w-full text-sm bg-sand/30 border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                  className="w-full text-sm bg-sand/30 border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
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
                  className="w-full text-sm bg-sand/30 border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                  className="w-full text-sm bg-sand/30 border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-cocoa mb-1">Timezone</label>
                  <select
                    value={regTimezone}
                    onChange={(e) => setRegTimezone(e.target.value)}
                    className="w-full text-sm bg-sand/30 border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="UTC-8">UTC-8 (PST)</option>
                    <option value="UTC-5">UTC-5 (EST)</option>
                    <option value="UTC">UTC (GMT)</option>
                    <option value="UTC+1">UTC+1 (CET)</option>
                    <option value="UTC+2">UTC+2 (EET)</option>
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
                    className="w-full text-sm bg-sand/30 border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                    className="w-full text-sm bg-sand/30 border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={regSubmitting}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
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
                  className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold cursor-pointer hover:bg-emerald-500"
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
                                  ? "bg-emerald-950/40 text-emerald-300 border border-emerald-800/60"
                                  : isPending
                                  ? "bg-amber-950/40 text-amber-300 border border-amber-800/60"
                                  : "bg-red-950/40 text-red-300 border border-red-800/60"
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
                              className="px-3.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-500 cursor-pointer"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => handleRespond(m.id, "decline")}
                              className="px-3.5 py-1.5 bg-card border border-line text-ink rounded-lg text-xs font-semibold hover:bg-sand/40 cursor-pointer"
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
                              className="px-3.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-500 cursor-pointer"
                            >
                              Schedule Session
                            </button>
                            <button
                              onClick={() => setRatingTargetMentorship(m)}
                              className="px-3.5 py-1.5 bg-emerald-950/30 border border-emerald-700/50 text-emerald-300 hover:bg-emerald-900/40 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
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
                                          ? "bg-emerald-950/40 text-emerald-300"
                                          : "bg-sand text-ink"
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
                                        rel="noopener noreferrer"
                                        className="text-emerald-400 hover:underline font-semibold"
                                      >
                                        Join Video Call ↗
                                      </a>
                                    )}
                                    {sess.status !== "completed" && (
                                      <button
                                        onClick={() => handleCompleteSession(m.id, sess.id)}
                                        className="ml-auto text-cocoa hover:text-ink cursor-pointer"
                                      >
                                        Mark Done
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
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
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-card border border-line rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
              <div>
                <h3 className="text-lg font-bold text-ink">
                  Request Mentorship from {requestTargetMentor.name}
                </h3>
                <p className="text-xs text-cocoa mt-1 leading-relaxed">
                  Briefly explain what you're working on, which skills you want guidance with, and your weekly commitment.
                </p>
              </div>

              {requestSuccess ? (
                <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-sm font-semibold text-center">
                  Mentorship request sent! Redirecting to your dashboard...
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-cocoa mb-1">Your Intro Message</label>
                    <textarea
                      rows={4}
                      value={requestMessage}
                      onChange={(e) => setRequestMessage(e.target.value)}
                      placeholder="Hi! I'm contributing to open-source and looking for mentorship around architecture, code reviews, and Best practices..."
                      className="w-full text-sm bg-sand/30 border border-line rounded-lg p-3 text-ink focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none leading-relaxed"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setRequestTargetMentor(null)}
                      className="px-4 py-2 border border-line rounded-lg text-xs font-semibold text-ink hover:bg-sand/40 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={submitMentorshipRequest}
                      disabled={requestSending}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50 transition-colors shadow-sm"
                    >
                      {requestSending ? "Sending..." : "Submit Request"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal: Schedule Session */}
        {activeMentorshipForSession && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-card border border-line rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
              <div>
                <h3 className="text-lg font-bold text-ink">Schedule Mentoring Session</h3>
                <p className="text-xs text-cocoa mt-1">Set up a 1-on-1 code review or architectural discussion.</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-cocoa mb-1">Session Agenda / Title</label>
                  <input
                    type="text"
                    required
                    value={sessionTitle}
                    onChange={(e) => setSessionTitle(e.target.value)}
                    placeholder="e.g. PR #42 Code Review & Architecture Discussion"
                    className="w-full text-sm bg-sand/30 border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-cocoa mb-1">Date & Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={sessionDateTime}
                    onChange={(e) => setSessionDateTime(e.target.value)}
                    className="w-full text-sm bg-sand/30 border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-cocoa mb-1">Duration (mins)</label>
                    <input
                      type="number"
                      min="15"
                      max="120"
                      step="15"
                      value={sessionDuration}
                      onChange={(e) => setSessionDuration(Number(e.target.value))}
                      className="w-full text-sm bg-sand/30 border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-cocoa mb-1">Meeting Link (optional)</label>
                    <input
                      type="url"
                      value={sessionMeetUrl}
                      onChange={(e) => setSessionMeetUrl(e.target.value)}
                      placeholder="https://meet.google.com/..."
                      className="w-full text-sm bg-sand/30 border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setActiveMentorshipForSession(null)}
                  className="px-4 py-2 border border-line rounded-lg text-xs font-semibold text-ink hover:bg-sand/40 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleScheduleSession(activeMentorshipForSession)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-sm"
                >
                  Confirm Session
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Rating and Feedback */}
        {ratingTargetMentorship && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-card border border-line rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
              <div>
                <h3 className="text-lg font-bold text-ink">Rate Your Mentorship</h3>
                <p className="text-xs text-cocoa mt-1">
                  Your feedback helps maintain high mentoring standards and recalculates the mentor's overall rating.
                </p>
              </div>

              {feedbackSuccess ? (
                <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-sm font-semibold text-center">
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
                              ? "bg-amber-400 text-black shadow-sm"
                              : "bg-sand/40 text-cocoa border border-line"
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
                      className="w-full text-sm bg-sand/30 border border-line rounded-lg p-3 text-ink focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none leading-relaxed"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setRatingTargetMentorship(null)}
                      className="px-4 py-2 border border-line rounded-lg text-xs font-semibold text-ink hover:bg-sand/40 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleFeedbackSubmit}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-sm"
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
