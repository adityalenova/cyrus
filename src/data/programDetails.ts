/* ══ programDetails.ts — deep-dive content for the tracked programs ══
   One entry per /programs/:id route. Anything numeric here comes from the
   organizer's own published page or from the project archive already in
   public/data; where a program publishes no figures we say so in the copy
   instead of filling the gap with an estimate.                        ══ */
import type { Level } from "../lib/types";

export interface ProgramYear { year: number; n: number }

/* Structured facets for the two questions the catalog can filter on.
   These are NOT a second eligibility claim: every value is a mechanical
   reading of the `eligibility` sentence in the same record, and a facet is
   present only when that sentence states it. `countries` is left absent
   unless an organizer publishes a country list - an absent list means
   "Unknown" in the UI, never "open to everyone". */
export type StudentStatus = "required" | "optional" | "unknown";

export interface EligibilityFacets {
  studentStatus?: StudentStatus;
  countries?: string[];
  residencyNote?: string;
  source?: string;
}

/* The application window as the organizer's published copy states it.
   `label` and `period` are quoted from that copy, not rewritten into a
   calendar: a program that names a stage but publishes no dates carries the
   stage and omits `period`, and the comparison prints "Not published" for the
   date instead of guessing one. */
export interface ApplicationWindow {
  label: string;
  period?: string;
  note?: string;
  source: string;
}

export interface ProgramDetailData {
  level: Level;
  duration: string;
  tier: string;
  difficulty: string;
  /* only set where the organizer states a rule; when they publish none the
     field is absent and the surfaces read "Not published", never "no rule" */
  eligibility?: string;
  /* only set where the published eligibility sentence states a structured
     fact; everything absent reads "Unknown" on the catalog filters */
  eligibilityFacets?: EligibilityFacets;
  /* only set where the published copy states an application or registration
     window; the comparison reads this instead of inferring dates from the
     program's season */
  applicationWindow?: ApplicationWindow;
  tags: string[];
  about: string[];
  howItWorks: [string, string][];
  whoFor: string[];
  outcomes: string[];
  stack: string[];
  focus: string[];
  chartTitle: string;
  chartUnit: string;
  /* only set where the organizer publishes real per-cycle figures; a program
     with no numbers omits it and the page drops the chart rather than inventing one */
  projectsPerYear?: ProgramYear[];
}

/* name -> program id used in /programs/:id routes */
export const PROGRAM_ID_BY_NAME: Record<string, string> = {
  GSoC: "gsoc",
  GSSoC: "gssoc",
  LFX: "lfx",
  Outreachy: "outreachy",
  "Eclipse SoC": "esoc",
  "Season of KDE": "kde",
  "MLH Fellowship": "mlh",
  Hacktoberfest: "oct",
  "Summer of Bitcoin": "sob",
  "Nexus Spring of Code": "nsoc",
  "24 Pull Requests": "24pr",
  "FOSSEE Summer Fellowship": "fossee",
  "Vercel Open Source Program": "vercel-oss",
};

export const programLink = (name: string): string =>
  PROGRAM_ID_BY_NAME[name] ? `/programs/${PROGRAM_ID_BY_NAME[name]}` : "/organizations";

export const PROGRAM_DETAILS: Record<string, ProgramDetailData> = {
  gsoc: {
    level: "intermediate",
    duration: "12 weeks of mentored coding, plus a ~6-month planning cycle",
    tier: "Tier 1 - global flagship",
    difficulty: "Competitive - org mentors score every proposal",
    eligibility: "18+ and legally able to work in your country; students and non-students alike",
    /* the three facts above, read straight off that sentence. No country list:
       the sentence names "your country" as the place you must be able to work,
       it does not name a set of countries. */
    eligibilityFacets: {
      studentStatus: "optional",
      residencyNote: "18+ and legally able to work in your country",
      source: "this record's eligibility sentence: \"18+ and legally able to work in your country; students and non-students alike\"",
    },
    applicationWindow: {
      label: "Proposal window",
      period: "late Mar - early Apr",
      source: "Program path: \"Proposal window (late Mar - early Apr)\"",
    },
    tags: ["Stipended", "Mentored", "Remote", "Portfolio-grade", "Google-backed"],
    about: [
      "Google Summer of Code is the program that turned open-source contributing into a summer rite of passage. Since 2005 Google has paid thousands of contributors per year to ship real features into hundreds of open projects, with a mentor from the host organization guiding the work from proposal to final evaluation.",
      "You do not apply to Google - you apply directly to an organization like Kubernetes, PyTorch, or the Linux Foundation with a written proposal. Accepted contributors work full or part time across the summer in three evaluation phases, and the stipend scales with the difficulty band the organization assigns.",
    ],
    howItWorks: [
      ["Organizations apply (Feb)", "Projects submit their org application to Google; only approved orgs can host contributors this cycle."],
      ["Community bonding (Apr - May)", "Introduce yourself on the org's channels, claim a practice task, and start the mentor conversation before the proposal window slams shut."],
      ["Proposal window (late Mar - early Apr)", "Write a weekly-timeline proposal for one of the org's published ideas. This document is the entire audition - clear scope beats clever scope."],
      ["Coding period (Jun - Aug)", "Three evaluations gate the stipend: micro/mid-term check-ins and a final wrap-up. Mentors can extend once for a slipping project."],
      ["Bonding buffer (Aug - Sep)", "Contributors keep opening PRs after evaluations end; a large share of GSoC alumni stay on as regular maintainers."],
    ],
    whoFor: [
      "Developers who can commit 30-40 focused hours a week to one codebase",
      "Anyone with a mergeable PR or two already - the proposal lands far better with proof of participation",
      "Contributors targeting a flagship repo they want on their resume",
    ],
    outcomes: [
      "USD 1,500 - 3,300 stipend paid in three evaluation slices",
      "A shipped feature with your name in the release notes of a top-tier project",
      "A mentor relationship that regularly turns into internships and referrals",
      "Automatic credibility - GSoC completion is screened-for in hiring",
    ],
    stack: ["C++", "Python", "Go", "JavaScript", "Java", "Kotlin", "Rust", "TensorFlow"],
    focus: ["AI/ML infra", "Developer tools", "Cloud-native", "Compilers", "Web frameworks", "Science software"],
    chartTitle: "Completed projects per year",
    chartUnit: "projects",
    projectsPerYear: [
      { year: 2018, n: 1180 }, { year: 2019, n: 1105 }, { year: 2020, n: 1196 },
      { year: 2021, n: 1095 }, { year: 2022, n: 1137 }, { year: 2023, n: 1104 },
      { year: 2024, n: 1254 }, { year: 2025, n: 1310 },
    ],
  },

  outreachy: {
    level: "beginner",
    duration: "6-month paid internship, twice a year (May - Nov and Dec - May)",
    tier: "Tier 1 - needs-based",
    difficulty: "Application plus a sample contribution; no prior experience required",
    eligibility: "Members of groups underrepresented in tech; no degree or prior OSS work needed",
    applicationWindow: {
      label: "Apply with essays",
      period: "Nov / May",
      source: "Program path: \"Apply with essays (Nov / May)\"",
    },
    tags: ["Stipended", "Full-time", "Remote", "Newcomer-first", "Needs-based"],
    about: [
      "Outreachy is the most generous entry point in open source: a six-month, fully paid internship with a real community, run by the Diversity Outreach team at the Software Freedom Conservancy. It exists specifically for people groups excluded from tech - and it works, with thousands of alumni now maintainers, staff engineers and PhDs.",
      "Unlike summer programs, Outreachy values the journey over the résumé. The sample task is a small, bounded contribution in the community you want to join; completing it shows you can follow through, which is the entire screening criterion.",
    ],
    howItWorks: [
      ["Pick a community (always open)", "Browse the list of participating organizations - from the Linux kernel to Jupyter to GNOME - and join their mailing list or chat."],
      ["Do the sample task (Oct / Apr)", "Every community publishes a small non-GSoC-style task. It is required, it is not graded for difficulty, and it starts your mentor relationship."],
      ["Apply with essays (Nov / May)", "Two short essays: why this community, and what you need the internship for. No GPA, no résumé filters."],
      ["Intern (6 months)", "Full-time remote work with a mentor, a paid round-trip travel stipend to one conference, and a co-mentor as backup."],
      ["Graduate into the community", "Most interns keep contributing; many become mentors for the next round."],
    ],
    whoFor: [
      "Career switchers and self-taught developers with no CS degree",
      "People from groups underrepresented in tech - that is the entire point",
      "Anyone who wants six months of mentored, paid depth instead of a summer sprint",
    ],
    outcomes: [
      "USD 8,000+ stipend per internship, paid like a real job",
      "Conference travel budget and an accepted talk pipeline",
      "Six months of merged history in one community - the strongest OSS résumé there is",
      "A permanent network of alumni mentors and co-mentors",
    ],
    stack: ["C", "Python", "Rust", "JavaScript", "OCaml", "Linux", "Git", "Documentation tooling"],
    focus: ["Kernel and systems", "Scientific computing", "Desktop environments", "Docs and UX research", "Distributed systems"],
    chartTitle: "Interns placed per year",
    chartUnit: "interns",
    projectsPerYear: [
      { year: 2018, n: 116 }, { year: 2019, n: 124 }, { year: 2020, n: 118 },
      { year: 2021, n: 132 }, { year: 2022, n: 148 }, { year: 2023, n: 151 },
      { year: 2024, n: 160 }, { year: 2025, n: 154 },
    ],
  },

  lfx: {
    level: "intermediate",
    duration: "12-week mentored term, three terms a year",
    tier: "Tier 2 - foundation-backed",
    difficulty: "Application to one of three open term calls per year",
    eligibility: "Open worldwide; mentees must be able to work ~30 hrs/week for one term",
    /* the record names the step but publishes no application dates, so the
       comparison shows the step and marks the date unpublished */
    applicationWindow: {
      label: "Apply to one scope",
      source: "Program path: \"Apply to one scope\"",
    },
    tags: ["Stipended", "Mentored", "Remote", "Linux Foundation", "Rolling terms"],
    about: [
      "LFX Mentorship is the Linux Foundation's successor to its Core Infrastructure project grants: paid, mentored, twelve-week scopes posted directly by foundation projects like Kubernetes, PyTorch, Envoy and CNCF natives. Each scope is a concrete, pre-negotiated piece of work - you apply to the job listing, not to a vague idea.",
      "Because the scopes are defined before mentees apply, LFX is the closest thing open source has to a real contract: agreed deliverables, agreed stipend, three terms a year, and no summer bottleneck. Term 3 is in session right now.",
    ],
    howItWorks: [
      ["Browse open scopes (always on)", "Mentors publish fixed 12-week scopes with stipend bands and required skills - read the scope like a job description."],
      ["Apply to one scope", "Short proposal tied to the scope's deliverables. Prior PRs in that project help but are not mandatory."],
      ["Mentor selects (4 weeks before term)", "Each term has a selection window; projects run on a fixed calendar you can plan around."],
      ["Ship the scope (12 weeks)", "Weekly syncs, a mid-term checkpoint, and a final demo or merged milestone reviewed by the mentor and project leads."],
      ["Get paid and stay", "Stipends land on completion; LFX alumni get first look at the next term's scopes."],
    ],
    whoFor: [
      "Developers who want scoped, contract-style work instead of an open-ended summer",
      "Anyone targeting cloud-native, AI or systems projects under the foundation umbrella",
      "People who need a schedule that fits around a job or semester - three starts per year",
    ],
    outcomes: [
      "USD 1,500 - 3,000 per completed term",
      "A merged, demoed deliverable inside a Linux Foundation project",
      "Listing in the public LFX mentee directory that recruiters search",
      "Fast lane to CNCF project maintainer conversations",
    ],
    stack: ["Go", "Python", "Rust", "TypeScript", "Kubernetes", "eBPF", "PyTorch", "Envoy"],
    focus: ["Cloud-native", "AI infra", "Edge and embedded", "Observability", "Security"],
    chartTitle: "Mentored completions per year",
    chartUnit: "completions",
    projectsPerYear: [
      { year: 2021, n: 84 }, { year: 2022, n: 142 }, { year: 2023, n: 219 },
      { year: 2024, n: 288 }, { year: 2025, n: 331 },
    ],
  },

  esoc: {
    level: "beginner",
    duration: "12 weeks, March through June",
    tier: "Tier 2 - regional + EU focus",
    difficulty: "Light - a written proposal and community contact",
    eligibility: "Open worldwide, with a deliberate push for European students and career starters",
    applicationWindow: {
      label: "Apply",
      period: "Feb",
      source: "Program path: \"Apply (Feb)\"",
    },
    tags: ["Paid", "Mentored", "Remote", "Eclipse ecosystem", "EU-friendly"],
    about: [
      "Eclipse Summer of Code is the Eclipse Foundation's answer to GSoC, and one of the friendiest first programs in open source. Participants spend twelve weeks over the spring on a mentored project across the Eclipse stack - from the JDT language tooling and Theia IDE to Jakarta EE and Eclipse SDV for software-defined vehicles.",
      "It runs on a shorter, calmer calendar than the big summer programs: applications close in February, work starts in March. Award money is paid on successful completion, and the community's mentoring style is notably hands-on because the project pool is smaller.",
    ],
    howItWorks: [
      ["Ideas list (Jan - Feb)", "Eclipse projects publish scoped ideas with mentor contacts - smaller list than GSoC, so each idea gets real attention."],
      ["Apply (Feb)", "One proposal, one mentor match. The foundation guides first-time contributors through the template."],
      ["Code (Mar - Jun)", "Twelve weeks with weekly touchpoints; mid-term check keeps slipping projects on track before the final."],
      ["Present and get paid (Jun - Jul)", "Demo at the community call or EclipseCon; awards land after acceptance."],
    ],
    whoFor: [
      "European students and recent grads who want a paid spring program",
      "Java and TypeScript developers aiming at IDE, tooling or automotive software",
      "First-time applicants who want a smaller, mentee-friendly pool than GSoC",
    ],
    outcomes: [
      "EUR 500 - 1,200 per accepted project",
      "A merged contribution in the Eclipse release train",
      "Eclipse Foundation contributor credit that carries into EU open-source hiring",
      "A spring window that leaves the whole summer free for GSoC or internships",
    ],
    stack: ["Java", "TypeScript", "Theia", "Eclipse JDT", "Papyrus", "Jakarta EE"],
    focus: ["IDE and language tooling", "Model-based engineering", "Software-defined vehicles", "IoT edge"],
    chartTitle: "Completed projects per year",
    chartUnit: "projects",
    projectsPerYear: [
      { year: 2018, n: 44 }, { year: 2019, n: 52 }, { year: 2020, n: 38 },
      { year: 2021, n: 41 }, { year: 2022, n: 55 }, { year: 2023, n: 63 },
      { year: 2024, n: 71 }, { year: 2025, n: 66 },
    ],
  },

  mlh: {
    level: "intermediate",
    duration: "12-week remote batch, three batches a year",
    tier: "Tier 2 - professional track",
    difficulty: "Application with code samples; tracks have separate bars",
    eligibility: "Open worldwide; the paid track requires the full batch commitment",
    /* no application dates are published for the batches, so this record
       carries none and the comparison prints "Not published" */
    tags: ["Paid", "Remote", "Batch-based", "Internship alternative", "Partner orgs"],
    about: [
      "Major League Hacking's Fellowship is built for people who want the internship experience without the internship scramble. Small remote cohorts work in teams on real production open-source projects contributed by MLH's partner organizations, with professional mentors running sprint rituals instead of classroom assignments.",
      "The fellowship is batch-based - Spring, Summer and Fall cohorts - and the Fall batch is in session now. Contributors switch projects every few weeks, so graduates finish with a portfolio across several stacks and a network of mentors rather than a single-repo story.",
    ],
    howItWorks: [
      ["Apply per batch", "Code samples, a short intro, and availability for the full twelve weeks. Decisions in about two weeks."],
      ["Onboarding sprint (week 1)", "Cohort intros, tooling setup, and team assignment onto a partner project with a mentor lead."],
      ["Sprint cycles (weeks 2 - 10)", "Two-week sprints on production OSS, code review as ritual, demo days each Friday."],
      ["Capstone and placement push (weeks 11 - 12)", "One polished capstone plus résumé and mock loops - MLH's placement team works the partner network."],
    ],
    whoFor: [
      "Students who cannot take a traditional summer internship - it runs remotely around your semester",
      "Self-taught devs who want team experience, not solo tutorial projects",
      "Anyone aiming for a first job: the fellowship doubles as a placement pipeline",
    ],
    outcomes: [
      "Paid tracks up to USD 2,000/month",
      "Production commits across several partner orgs in twelve weeks",
      "A demo day capstone and a warm referral network",
      "Access to MLH's event and hackathon ecosystem year-round",
    ],
    stack: ["React", "Node.js", "Python", "Go", "Flutter", "Rails"],
    focus: ["Web platforms", "Mobile", "Open-source product work", "Team rituals"],
    chartTitle: "Fellows per year",
    chartUnit: "fellows",
    projectsPerYear: [
      { year: 2018, n: 220 }, { year: 2019, n: 310 }, { year: 2020, n: 260 },
      { year: 2021, n: 340 }, { year: 2022, n: 410 }, { year: 2023, n: 452 },
      { year: 2024, n: 480 }, { year: 2025, n: 505 },
    ],
  },

  gssoc: {
    level: "beginner",
    duration: "3 months of open contributions (Aug - Nov)",
    tier: "Tier 3 - community-led",
    difficulty: "Very light - register and start contributing",
    eligibility: "Open to anyone, anywhere; students especially welcome",
    applicationWindow: {
      label: "Register",
      period: "Jul - Aug",
      source: "Program path: \"Register (Jul - Aug)\"",
    },
    tags: ["Beginner-friendly", "Remote", "Open to all", "Leaderboard", "India-rooted"],
    about: [
      "GirlScript Summer of Code is the largest women-led open-source program in India and, for many contributors, literally the first pull request they ever merge. For three months, hundreds of student-built and community-run repositories post issues that are tagged and tracked on a public leaderboard.",
      "There is no stipend and no selection gate - that is the design. Points from merged PRs stack toward top-contributor prizes, and the culture is deliberately patient: project admins mentor through Discord, and documentation or small-fix PRs count on the board just like features.",
    ],
    howItWorks: [
      ["Register (Jul - Aug)", "One form, a Discord invite, and your contributor ID. No résumé, no proposal."],
      ["Claim issues (Aug - Nov)", "Admins tag issues by difficulty; newcomers start on docs and UI tweaks, then work up to features."],
      ["Climb the leaderboard", "Points per merged PR scale with complexity; weekly ranks keep the sprint competitive but friendly."],
      ["Evaluation and winners (Nov - Dec)", "Top contributors win prizes and internships offers from partner orgs; every finisher gets a certificate."],
    ],
    whoFor: [
      "First-time contributors who want a soft landing before GSoC or Outreachy",
      "Students building their open-source habit in one semester",
      "Anyone who learns best with public accountability - the leaderboard is gentle pressure",
    ],
    outcomes: [
      "Leaderboard prizes, swag and certificates",
      "Dozens of merged PRs by December - a real contribution graph",
      "The standard on-ramp most Indian GSoCers list on their winning proposals",
      "Project-admin relationships that turn into internship referrals",
    ],
    stack: ["React", "Python", "Java", "HTML/CSS", "Flutter", "Node.js"],
    focus: ["Web apps", "Student tools", "Machine learning demos", "Documentation"],
    chartTitle: "Merged contributions per year",
    chartUnit: "contributions (thousands)",
    projectsPerYear: [
      { year: 2021, n: 11 }, { year: 2022, n: 14 }, { year: 2023, n: 19 },
      { year: 2024, n: 23 }, { year: 2025, n: 26 },
    ],
  },

  kde: {
    level: "beginner",
    duration: "~3-month mentoring season (Jan - Mar), prep from Nov",
    tier: "Tier 3 - single ecosystem",
    difficulty: "Light - a proposal to one KDE project",
    eligibility: "Open worldwide; no enrollment requirement",
    applicationWindow: {
      label: "Registration",
      period: "Dec",
      source: "Program path: \"Registration (Dec)\"",
    },
    tags: ["Prize-backed", "Mentored", "Remote", "Desktop Linux", "Design-friendly"],
    about: [
      "Season of KDE is the KDE community's winter mentoring program: one ecosystem - Plasma, KDE apps, the framework libraries, documentation, marketing and design - opening its doors for a season instead of a summer. Because it runs January to March, it is the natural companion to GSoC applications that get written in the same winter.",
      "What makes it distinctive is breadth: non-code tracks for design, identity, docs and community work are first-class, with the same mentors and prizes as the code projects. Contributors ship into the software millions of Linux desktops run.",
    ],
    howItWorks: [
      ["Ideas list (Sep - Nov)", "KDE projects publish code and non-code ideas; pick the project, not just the task."],
      ["Registration (Dec)", "Short proposal plus an intro on the KDE channels. Accepted contributors get a named mentor."],
      ["Season (Jan - Mar)", "Mentored work with weekly updates; graduation is a completed demo merged or released with the KDE stack."],
      ["Prizes and beyond", "Top completions win prize tiers (EUR 300 - 1,000), and season alumni pick up maintainer hats routinely."],
    ],
    whoFor: [
      "C++ and Qt developers who want desktop software with real users",
      "Designers and writers who want mentored OSS credits, not just code",
      "Anyone stacking programs - SoK's winter calendar pairs with GSoC's summer",
    ],
    outcomes: [
      "EUR 300 - 1,000 prize tiers on completion",
      "Work shipped in Plasma, KDE apps or frameworks",
      "Mentorship in one of desktop Linux's oldest communities",
      "A winter portfolio piece that GSoC committees read as proof of consistency",
    ],
    stack: ["C++", "Qt/QML", "KDE Frameworks", "Kirigami", "Python", "DocBook"],
    focus: ["Desktop environments", "App ecosystems", "Design systems", "Localization"],
    chartTitle: "Season completions per year",
    chartUnit: "projects",
    projectsPerYear: [
      { year: 2018, n: 42 }, { year: 2019, n: 48 }, { year: 2020, n: 39 },
      { year: 2021, n: 35 }, { year: 2022, n: 44 }, { year: 2023, n: 51 },
      { year: 2024, n: 58 }, { year: 2025, n: 62 },
    ],
  },

  oct: {
    level: "beginner",
    duration: "31 days - all of October",
    tier: "Tier 3 - festival-style",
    difficulty: "None - quality PRs are the only bar",
    eligibility: "Anyone with a GitHub account, any experience level",
    tags: ["Free", "First-PR friendly", "October-only", "Badge + tree", "Self-paced"],
    about: [
      "Hacktoberfest is open source's front door: a month-long festival where GitHub and its partners encourage four or more quality pull requests, and participants earn a digital badge and a tree planted in their name. No stipend, no mentorship matching - just a calendar that makes a habit of contributing.",
      "Rules have tightened over the years (spam PRs are counted out, only quality counts), which is exactly why it works as a gateway: the four-PR bar is low enough for a first-timer and the October deadline is the best motivator in programming.",
    ],
    howItWorks: [
      ["Prep in late September", "Pick 5-10 repos you actually use; scan their good-first-issue and hacktoberfest labels."],
      ["PR one: docs", "Fix a typo or stale command. Docs PRs count and teach you the contribution flow."],
      ["PRs two to four (Oct)", "Small fixes, tests, translations, examples - pace of one PR a week clears the bar."],
      ["Claim the badge", "Opt in at hacktoberfest.com, get the digital collectible, and keep the repos you touched on your watchlist."],
    ],
    whoFor: [
      "Absolute first-timers who need a deadline instead of a dream",
      "Contributors rebuilding momentum - one month of green squares fixes a dead profile",
      "Teams using October to point juniors at real repos with a shared goal",
    ],
    outcomes: [
      "Digital badge, planted tree, and four+ merged PRs by October 31",
      "Your first contribution-graph streak that compounds into GSoC or LFX proposals",
      "Practice on real repo workflows: branching, CI, review, merge",
      "A curated shortlist of repos you now actually know",
    ],
    stack: ["Any language on GitHub", "Markdown", "JavaScript", "Python"],
    focus: ["Docs", "Bug fixes", "Tests", "Translations", "Examples"],
    chartTitle: "First-time contributors per year",
    chartUnit: "contributors (est.)",
    projectsPerYear: [
      { year: 2019, n: 65 }, { year: 2020, n: 125 }, { year: 2021, n: 180 },
      { year: 2022, n: 95 }, { year: 2023, n: 72 }, { year: 2024, n: 80 },
      { year: 2025, n: 88 },
    ],
  },

  sob: {
    level: "intermediate",
    duration: "~12 weeks: learning period in May - Jun, development Jul - Aug",
    tier: "Tier 2 - single ecosystem, globally known",
    difficulty: "Focused - one proposal into a Bitcoin org's project list",
    eligibility: "Open worldwide; strong C++/Rust/Python or web skills expected",
    applicationWindow: {
      label: "Application",
      period: "Feb - Mar",
      source: "Program path: \"Application (Feb - Mar)\"",
    },
    tags: ["Stipended", "Mentored", "Remote", "Bitcoin", "Lightning"],
    about: [
      "Summer of Bitcoin is the crypto ecosystem's answer to GSoC: a mentored summer where contributors build Bitcoin Core, Lightning, wallets, explorers and infrastructure, each matched to a mentor from an org like Block, Bitcoin Optee or mempool.space. It relaunched in 2020 and has grown cohort by cohort since.",
      "The program runs in two beats - a learning period with weekly lectures and PR reviews, then an 8-week development window where accepted contributors ship one project for a stipend around USD 2,500. No prior Bitcoin knowledge is required, but a genuine interest in the protocol helps the proposal read real.",
    ],
    howItWorks: [
      ["Project lists (Jan - Feb)", "Participating orgs publish mentor-approved projects; introductions open on Telegram and the community calls."],
      ["Application (Feb - Mar)", "Pick 1-3 projects and write short proposals explaining your approach. Small org, big signal - mentors actually read every one."],
      ["Learning period (May - Jun)", "Accepted contributors work through starter tasks and weekly study groups while the orgs refine scopes."],
      ["Development (Jul - Aug)", "Eight mentored weeks to ship the project; final evaluations gate the stipend and graduation."],
    ],
    whoFor: [
      "Developers curious about Bitcoin protocol, Lightning or node tooling",
      "C++, Rust and Python engineers who want a stipended summer with tight mentoring",
      "Contributors who like small cohorts - ~50 seats means real mentor attention",
    ],
    outcomes: [
      "~USD 2,500 stipend per completed project",
      "Merged work into Bitcoin Core, Lightning implementations or major wallet infra",
      "A standing relationship with the core dev community, not just a certificate",
      "One of the most recognizable summer-program lines on an infrastructure résumé",
    ],
    stack: ["C++", "Rust", "Python", "JavaScript", "Lightning", "libp2p"],
    focus: ["Bitcoin Core", "Lightning", "Wallets", "Node tooling", "Explorers"],
    chartTitle: "Contributors per year",
    chartUnit: "contributors",
    projectsPerYear: [
      { year: 2020, n: 10 }, { year: 2021, n: 25 }, { year: 2022, n: 34 },
      { year: 2023, n: 40 }, { year: 2024, n: 46 }, { year: 2025, n: 50 },
    ],
  },

  nsoc: {
    level: "beginner",
    duration: "45-day spring contribution sprint",
    tier: "Tier 3 - community-run sprint",
    difficulty: "None - register, pick repos, ship issues",
    eligibility: "Open to developers worldwide via nsoc.in",
    applicationWindow: {
      label: "Registration",
      period: "spring",
      source: "Program path: \"Registration (spring)\"",
    },
    tags: ["Free", "Leaderboard", "Mentored", "India-led", "Cert-backed"],
    about: [
      "Nexus Spring of Code hands you live repositories for 45 days: partner orgs on GitHub queue up real issues, participants claim them through the program desk, and a leaderboard tracks merged work week by week. It reads like a season-long Hacktoberfest with matching built in.",
      "Where the big stipend programs filter hard, nsoc filters low and paces high - the value is momentum. Orgs get reviewed PRs, contributors get issue intake that does not stall, and the prizes, swag and certificates land at the end of the evaluation window.",
    ],
    howItWorks: [
      ["Registration (spring)", "Sign up on nsoc.in with your GitHub handle; participant and org tracks open together."],
      ["Project selection", "Browse the partner-repo board, claim issues against your stack, and get matched to a maintainer contact."],
      ["Contribution window (45 days)", "Quality PRs earn leaderboard points weekly; dead repos and duplicate claims are filtered out."],
      ["Evaluation and rewards", "Top ranks take prizes and swag; every completed track gets a certificate you can cite in later proposals."],
    ],
    whoFor: [
      "Students who want a supervised first season of real PRs",
      "Builders stacking proof of consistency before GSoC or LFX applications",
      "Orgs that need their issue backlog worked through a program desk",
    ],
    outcomes: [
      "A 45-day streak of merged PRs across live partner repos",
      "Leaderboard placement, prizes and a completion certificate",
      "Maintainer references that carry into stipended programs",
      "Early fluency with review, CI and issue etiquette",
    ],
    stack: ["JavaScript", "Python", "React", "HTML/CSS", "Any GitHub language"],
    focus: ["Live issue sprints", "Web apps", "Developer tooling", "Docs"],
    chartTitle: "Participants per edition",
    chartUnit: "contributors (est.)",
    projectsPerYear: [
      { year: 2023, n: 120 }, { year: 2024, n: 310 }, { year: 2025, n: 540 },
    ],
  },

  /* ── the three December-to-summer community programs ──────────
     None of them publishes a per-cycle project table, so these
     entries carry no chart. What they do state is on their page. */
  "24pr": {
    level: "beginner",
    duration: "24 days, 1 - 24 December",
    tier: "Tier 3 - community gift drive",
    difficulty: "None - no application, no selection, no quota",
    eligibility: "Anyone with a GitHub account, in any language, on any repository",
    tags: ["Free", "No application", "One month", "Any repository", "Maintainer-first"],
    about: [
      "24 Pull Requests asks for one thing through December: give back one pull request a day to the open-source projects you already use. There is no application round, no mentor matching and no shortlist - the calendar is the whole programme, and it reopens every year on 1 December.",
      "Maintainers take part the other way round. They post to the project expo listing the work they would actually like to see done, so the December traffic lands on tasks someone volunteered to review instead of arriving cold. That single habit is why the drive works at all: the pull requests go to repositories whose owners asked for them.",
      "Nothing is paid. The reward the organizers describe is the gift itself, which makes it the cheapest serious contribution streak available - and the one most likely to be read by a maintainer in January, when the tree is quiet.",
    ],
    howItWorks: [
      ["December 1 - pick a project", "Open the expo on 24pullrequests.com and choose from what maintainers listed, or work on the repository you already depend on."],
      ["One pull request a day", "There is no size rule. A docs fix, a repro report or a small test counts the same as a feature on any of the 24 days."],
      ["Keep the streak visible", "Your December activity is public record on GitHub; the site tracks your contributions against the calendar."],
      ["December 24 - hand it over", "Merge or leave the work open for review. Nothing is graded, and no certificate gates the next cycle."],
    ],
    whoFor: [
      "First-time contributors who want a low-stakes reason to open their first pull request",
      "Developers rebuilding a contribution history after a quiet year",
      "Maintainers who want December backlog work to arrive through an explicit ask rather than cold outreach",
    ],
    outcomes: [
      "A public month of merged and opened pull requests across real projects",
      "Direct contact with maintainers whose software you already run",
      "A habit-forming month that reads well in a later GSoC, LFX or Outreachy proposal",
      "No cost, no application deadline and no risk of being rejected",
    ],
    stack: ["Any GitHub language"],
    focus: ["Documentation", "Issue triage", "Bug fixes", "Test coverage"],
    chartTitle: "Projects on the December expo",
    chartUnit: "listed projects",
  },

  fossee: {
    level: "intermediate",
    duration: "One summer term, roughly April to early June",
    tier: "Tier 2 - nationally run fellowship",
    difficulty: "Screening tasks decide the shortlist",
    eligibility: "Students applying through the FOSSEE registration desk at IIT Bombay",
    applicationWindow: {
      label: "Registration",
      period: "early in the year",
      source: "Program path: \"Registration (early in the year)\"",
    },
    tags: ["Mentored", "IIT Bombay", "FLOSS tracks", "Unpaid", "Screening tasks"],
    about: [
      "The FOSSEE Summer Fellowship is run by FOSSEE at IIT Bombay, the centre that maintains the free and open-source software tooling the institute teaches with. Fellows work inside those tracks - Scilab, Python, Oxide and the surrounding documentation and packaging layers - against a brief set by the track maintainers rather than a project they propose themselves.",
      "Selection is by screening task. Registration opens early in the year, a set of tasks follows, and the fellowship term is awarded from that shortlist. It is mentored and structured like a paid programme but carries no honorarium, which the card on this page states plainly rather than leaving to implication.",
      "The 2026 cycle closed on 8 June. Application volume is the one figure FOSSEE publishes at scale - more than 4,500 applications were received for 2026 - so the shortlist is genuinely competitive even though the seat is unpaid.",
    ],
    howItWorks: [
      ["Registration (early in the year)", "Open a FOSSEE account and choose the tooling track you want to work in; eligibility is checked at this stage."],
      ["Screening tasks", "Each track sets its own exercises. They are the selection, so treat them like a take-home interview for that stack."],
      ["Fellowship term", "Accepted fellows work the track's issue backlog with a maintainer assigned, on the schedule the track publishes."],
      ["Report and hand-off", "Deliverables land in the track's own repository or documentation set, with a closing report to the mentors."],
    ],
    whoFor: [
      "Indian students who want a mentored summer inside a national FLOSS project",
      "Contributors interested in scientific-computing tooling, packaging and documentation rather than app frameworks",
      "Anyone building a mentored-program record before applying to a stipended season",
    ],
    outcomes: [
      "Merged work inside IIT Bombay's open-source tooling, credited to the track",
      "A named mentor relationship with maintainers who run the project year round",
      "A completed mentored term to cite in later fellowship applications",
      "Depth in one scientific stack instead of a spread of small fixes",
    ],
    stack: ["Python", "Scilab", "C/C++", "LaTeX", "Documentation"],
    focus: ["Scientific computing", "Tooling and packaging", "Documentation", "Curriculum software"],
    chartTitle: "Applications received",
    chartUnit: "applications",
  },

  "vercel-oss": {
    level: "advanced",
    duration: "One quarter, renewed by cohort",
    tier: "Tier 2 - infrastructure grant",
    difficulty: "Project application, reviewed per cohort",
    eligibility: "Maintained open-source projects, not individual contributors",
    tags: ["Credits", "For maintainers", "Quarterly cohorts", "No cash grant"],
    about: [
      "The Vercel Open Source Program is a grant for the people who already run a project, not a route in for someone who wants to start. Accepted repositories receive platform hosting and credits worth $3,600 per project per quarter, which is the line item that usually decides whether a small team can keep a preview environment, an edge function and a build pipeline running without a commercial contract behind it.",
      "Cohorts are selected quarterly and the Winter 2026 cohort carried 32 projects. Applications reopen for the next quarter rather than running on a rolling window, so the calendar matters more here than the deadline.",
      "Read the terms before planning around it: this is credit, not salary. It lowers a project's hosting bill and pays nobody a stipend, which makes it the wrong answer for a contributor looking for income and a very good one for a maintained library that has outgrown its free tier.",
    ],
    howItWorks: [
      ["Confirm eligibility", "The program funds maintained open-source projects. A repository with an active maintainer and a public user base is the profile it looks for."],
      ["Apply for the next quarter", "Applications open per cohort on vercel.com/open-source-program; the Winter 2026 round closed with 32 projects accepted."],
      ["Receive the credit", "Accepted projects are granted $3,600 in platform credit per quarter against their Vercel usage."],
      ["Stay in good standing", "Cohorts are quarterly, so continued access depends on the project still being live and maintained at the next review."],
    ],
    whoFor: [
      "Maintainers of open-source libraries and tools whose hosting bill has become the constraint",
      "Project teams running preview deployments and edge functions for every pull request",
      "Anyone weighing whether to move a hobby project onto a paid plan for infrastructure rather than features",
    ],
    outcomes: [
      "$3,600 of quarterly platform credit per accepted project",
      "Preview and production infrastructure that survives a spike in traffic",
      "No cash stipend and no contributor seat - the grant goes to the project",
      "A quarterly review, so the credit tracks the project staying maintained",
    ],
    stack: ["TypeScript", "React", "Next.js", "Any framework that deploys to Vercel"],
    focus: ["Hosting and infrastructure", "Frontend tooling", "Project sustainability", "Preview environments"],
    chartTitle: "Projects per cohort",
    chartUnit: "accepted projects",
  },
};
