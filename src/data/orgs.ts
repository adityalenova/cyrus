import type { Org, Program } from "../lib/types";
import { REAL_ORGS } from "./realOrgs";
import { programsOf } from "./programAssoc";

export const PROGRAMS: Program[] = [
  {
    id: "gsoc", name: "Google Summer of Code", owner: "google",
    img: "/assets/prog-gsoc.jpg", url: "https://summerofcode.withgoogle.com",
    tag: "Write real code for open-source orgs, mentored full-time over the summer.",
    pay: "$1,500 – $3,300", payNote: "STIPEND",
    status: "closed", window: "Applications close April",
    orgs: "519 orgs archived", slots: "12,095 projects 2016-2026",
    phases: [
      { label: "Org applications", s: 0, e: 1.6, c: "#3b6ea5" },
      { label: "Student applications", s: 2.1, e: 3.8, c: "#a97b1f" },
      { label: "Community bonding", s: 3.8, e: 4.6, c: "#2f7d72" },
      { label: "Coding period", s: 4.6, e: 8.2, c: "#3e7d4f" },
    ],
  },
  {
    id: "outreachy", name: "Outreachy", owner: "outreachy",
    img: "/assets/prog-outreachy.jpg", url: "https://www.outreachy.org",
    tag: "Paid remote internships in open source for people from under-represented groups.",
    pay: "$8,000 USD", payNote: "PER INTERNSHIP",
    status: "upcoming", window: "Dec cohort pairing opens Nov",
    orgs: "179 communities archived", slots: "437 internships 2022-2026",
    phases: [
      { label: "Outreach period", s: 10.2, e: 11.2, c: "#3b6ea5" },
      { label: "Applications", s: 1.6, e: 3.1, c: "#a97b1f" },
      { label: "Internship (May cohort)", s: 4, e: 8, c: "#3e7d4f" },
      { label: "Internship (Dec cohort)", s: 11, e: 12, c: "#2f7d72" },
    ],
  },
  {
    id: "lfx", name: "LFX Mentorship", owner: "linuxfoundation",
    img: "/assets/prog-lfx.jpg", url: "https://mentorship.lfx.linuxfoundation.org",
    tag: "Cloud & ecosystem mentored projects across Linux Foundation host projects.",
    pay: "$1,500 – $3,000", payNote: "PER TERM",
    status: "live", window: "Term 3 running now · Sep – Nov",
    orgs: "47 host projects", slots: "1,303 projects 2019-2026",
    phases: [
      { label: "Term 1", s: 2, e: 5, c: "#3b6ea5" },
      { label: "Term 2", s: 5, e: 8, c: "#2f7d72" },
      { label: "Term 3", s: 8.3, e: 11, c: "#3e7d4f", active: true },
    ],
  },
  {
    id: "esoc", name: "Eclipse SoC", owner: "eclipse-foundation",
    img: "/assets/prog-esoc.jpg", url: "https://soc.eclipse.to",
    tag: "Summer contributions to Eclipse Foundation projects with structured mentoring.",
    pay: "€500 – €1,200", payNote: "PER PROJECT",
    status: "closed", window: "Runs May – August",
    orgs: "No published roster", slots: "Counts unpublished",
    phases: [
      { label: "Project proposals", s: 2.8, e: 4.2, c: "#3b6ea5" },
      { label: "Teams formed", s: 4.2, e: 4.9, c: "#a97b1f" },
      { label: "Coding & demos", s: 4.9, e: 7.6, c: "#3e7d4f" },
    ],
  },
  {
    id: "mlh", name: "MLH Fellowship", owner: "MLH",
    img: "/assets/prog-alt-roorkee.jpg", url: "https://fellowship.mlh.io",
    tag: "A remote, batch-based alternative to internships on real open-source teams.",
    pay: "Paid tracks", payNote: "UP TO $2K/MO",
    status: "live", window: "Fall batch in session",
    orgs: "120 upstream orgs", slots: "198 forked repositories",
    phases: [
      { label: "Spring batch", s: 2.5, e: 5, c: "#3b6ea5" },
      { label: "Summer batch", s: 5.3, e: 7.8, c: "#2f7d72" },
      { label: "Fall batch", s: 8.2, e: 10.8, c: "#3e7d4f", active: true },
    ],
  },
  {
    id: "gssoc", name: "GSSoC'26", owner: "GirlScript",
    img: "/assets/prog/gssoc.jpg", url: "https://gssoc.girlscript.tech",
    tag: "Three-month open-source contribution sprint, biggest women-led program in India.",
    pay: "Leaderboard prizes", payNote: "SWAG + CERTS",
    status: "live", window: "Contributions Aug – Nov",
    orgs: "420 project orgs", slots: "423 projects in the 2026 board",
    phases: [
      { label: "Registration", s: 6.3, e: 7.4, c: "#3b6ea5" },
      { label: "Contribution period", s: 7.4, e: 10.6, c: "#a97b1f", active: true },
      { label: "Evaluation", s: 10.6, e: 11.2, c: "#a97b1f" },
    ],
  },
  {
    id: "kde", name: "Season of KDE", owner: "kde",
    img: "/assets/prog/kde.png", url: "https://season.kde.org",
    tag: "Winter mentoring program for KDE - design, code, docs, and community work.",
    pay: "€300 – €1,000", payNote: "PRIZES",
    status: "upcoming", window: "Registrations open December",
    orgs: "42 KDE project areas", slots: "87 ideas 2017-2026",
    phases: [
      { label: "Ideas list", s: 9.4, e: 10.6, c: "#3b6ea5" },
      { label: "Registration", s: 11, e: 12, c: "#a97b1f" },
      { label: "Mentoring", s: 0, e: 2.9, c: "#3e7d4f" },
    ],
  },
  {
    id: "sob", name: "Summer of Bitcoin", owner: "summerofbitcoin",
    img: "/assets/prog/sob.png", url: "https://www.summerofbitcoin.org",
    tag: "Eight mentored weeks building real Bitcoin and Lightning tech, with a stipend.",
    pay: "~$2,500 USD", payNote: "PER PROJECT",
    status: "upcoming", window: "Applications open December",
    orgs: "32 orgs archived", slots: "66 projects in 2026",
    phases: [
      { label: "Applications", s: 11, e: 12, c: "#3b6ea5" },
      { label: "Learning period", s: 0.5, e: 2.5, c: "#a97b1f" },
      { label: "Development", s: 4.5, e: 7.5, c: "#3e7d4f" },
    ],
  },
  {
    id: "nsoc", name: "Nexus Spring of Code", owner: "Nexus-Spring-of-Code",
    img: "/assets/prog/nsoc.png", url: "https://nsoc.in",
    tag: "A 45-day spring sprint where orgs hand you live repos and you ship the issues.",
    pay: "Prizes + certs", payNote: "LEADERBOARD",
    status: "upcoming", window: "Registrations open on nsoc.in",
    orgs: "Partner repos on GitHub", slots: "Open to developers",
    phases: [
      { label: "Registrations", s: 1.5, e: 2.5, c: "#3b6ea5" },
      { label: "Project selection", s: 2.5, e: 3.2, c: "#a97b1f" },
      { label: "Contribution window", s: 3.2, e: 4.7, c: "#3e7d4f" },
      { label: "Evaluation", s: 4.7, e: 5.2, c: "#2f7d72" },
    ],
  },
  {
    id: "oct", name: "Hacktoberfest", owner: "github",
    img: "/assets/hack/covers/hacktoberfest-2026.jpg", url: "https://hacktoberfest.com",
    tag: "One month of pull requests, first-timer friendly, the on-ramp for most contributors.",
    pay: "Badge + tree", payNote: "PER PARTICIPANT",
    status: "live", window: "All of October · you are here",
    orgs: "Any GitHub project", slots: "Open to all",
    phases: [
      { label: "Prep & first-timer issues", s: 8.3, e: 9, c: "#2f7d72" },
      { label: "Hacktoberfest", s: 9, e: 10, c: "#3e7d4f", active: true },
    ],
  },
  /* ── added October 2026. Every field below is checked against the
     programme's own page; where a programme is not a contributor
     fellowship, or pays nothing, the card says so rather than implying
     a stipend. ── */
  {
    id: "24pr", name: "24 Pull Requests", owner: "24pullrequests",
    img: "/assets/prog/24pr.png", url: "https://24pullrequests.com",
    tag: "One pull request a day through December, given back to the projects you use.",
    pay: "No prize", payNote: "GIFT TO MAINTAINERS",
    status: "upcoming", window: "Runs 1 - 24 December",
    orgs: "10,080 listed orgs", slots: "306 wishlist repos",
    phases: [
      { label: "Nominations & prep", s: 10.5, e: 11, c: "#2f7d72" },
      { label: "Contribution drive", s: 11, e: 12, c: "#3e7d4f" },
    ],
  },
  {
    id: "fossee", name: "FOSSEE Summer Fellowship", owner: "fossee",
    img: "/assets/prog/fossee.png", url: "https://fossee.in/fellowship/2026",
    tag: "IIT Bombay mentored fellowship on FLOSS tooling: Scilab, Python, Oxide and more.",
    pay: "Unpaid", payNote: "NO HONORARIUM",
    status: "closed", window: "2026 cycle completed 8 June",
    orgs: "IIT Bombay tracks", slots: "Cohort size unpublished",
    phases: [
      { label: "Registration", s: 2, e: 3, c: "#3b6ea5" },
      { label: "Screening tasks", s: 3, e: 4, c: "#a97b1f" },
      { label: "Fellowship", s: 4.2, e: 7, c: "#3e7d4f" },
    ],
  },
  {
    id: "vercel-oss", name: "Vercel Open Source Program", owner: "vercel",
    img: "/assets/prog/vercel-oss.png", url: "https://vercel.com/open-source-program",
    tag: "Platform credits and hosting for maintained projects - a grant for maintainers, not contributors.",
    pay: "$3,600 credits", payNote: "PER PROJECT / QUARTER",
    status: "closed", window: "Applications reopen next quarter",
    orgs: "32 projects in the Winter 2026 cohort", slots: "Project teams",
    phases: [
      { label: "Winter cohort", s: 1.5, e: 2.6, c: "#3b6ea5" },
      { label: "Spring cohort", s: 4.6, e: 5.9, c: "#a97b1f" },
      { label: "Summer cohort", s: 7.2, e: 8.4, c: "#2f7d72" },
    ],
  },
];

/* The directory is LIVE GitHub data - regenerated by scripts/fetch-orgs.mjs
   (gh api users/{login} + top-10 repos per org). No hand-tuned stats.

   It is then narrowed to the organizations a program actually names. The
   seed list also carried the big commercial open-source accounts - Microsoft,
   Google, OpenAI, Anthropic, Vercel and the like - because their repositories
   are popular here. None of them appears in the GSoC, LFX, Outreachy or Summer
   of Bitcoin archives, and none of their tracked repos advertises one of those
   programs in its GitHub topics, so they were profile cards with no program
   behind them. cyrus.ai is a program directory, so they are not listed: 29 of
   the 393 fetched profiles drop out and the directory becomes the 364
   organizations some program's own record names. Their repositories stay in
   the catalog; orgByLogin() simply stops offering them an in-site profile page,
   and every card that links to an organization already falls back to GitHub
   when there is no profile. */

export const ORGS: Org[] = REAL_ORGS.filter((o) => programsOf(o.login).length > 0);

/** the profiles we fetched but do not list, kept for the count in copy */
export const UNASSOCIATED_ORGS: Org[] = REAL_ORGS.filter((o) => programsOf(o.login).length === 0);
