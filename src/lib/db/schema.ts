/* ══ Drizzle schema — Neon Postgres for cyrus.ai ══════════════════════
   Two halves:
   · catalog tables (repos, orgs, hackathons, program_projects, resources)
     mirror the seed data so the site can read fresh numbers from the API;
   · account tables (users, saved_items, applications, submissions) power
     cross-device sync and the application-help features.
   The repos table already carries the four filter dimensions
   (domain / models / format / frameworks) as nullable columns; the
   classifier fills them in. ═══════════════════════════════════════════ */
import {
  boolean, date, foreignKey, index, integer, jsonb, pgTable, primaryKey, serial, text,
  timestamp, uniqueIndex, uuid,
} from "drizzle-orm/pg-core";

/* ── accounts ───────────────────────────────────────────────────────── */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull(), // "github" | "google" | "email"
    providerId: text("provider_id").notNull(),
    login: text("login"),
    name: text("name").notNull(),
    email: text("email"),
    picture: text("picture"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_provider_idx").on(t.provider, t.providerId)],
);

/** one live verification code per email address (email sign-in) */
export const emailCodes = pgTable(
  "email_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    codeHash: text("code_hash").notNull(), // sha256 of the 6-digit code
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    tries: integer("tries").notNull().default(0), // max 6 checks before burn
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("email_codes_email_idx").on(t.email)],
);

export const savedItems = pgTable(
  "saved_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    itemType: text("item_type").notNull(), // repo | org | hackathon | program | resource
    itemId: text("item_id").notNull(), // stable id used by the frontend (owner/name, slug…)
    title: text("title"),
    meta: jsonb("meta"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("saved_unique_idx").on(t.userId, t.itemType, t.itemId),
    uniqueIndex("saved_owner_id_idx").on(t.userId, t.id),
    index("saved_user_idx").on(t.userId),
  ],
);

export const bookmarkCollections = pgTable("bookmark_collections", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  shareToken: uuid("share_token"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("collection_owner_id_idx").on(t.userId, t.id),
  uniqueIndex("collection_name_idx").on(t.userId, t.name),
  uniqueIndex("collection_share_idx").on(t.shareToken),
]);

// Composite references prohibit cross-account memberships even outside the API.
export const bookmarkCollectionItems = pgTable("bookmark_collection_items", {
  userId: uuid("user_id").notNull(),
  collectionId: uuid("collection_id").notNull(),
  savedItemId: uuid("saved_item_id").notNull(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.collectionId, t.savedItemId] }),
  foreignKey({ columns: [t.userId, t.collectionId], foreignColumns: [bookmarkCollections.userId, bookmarkCollections.id] }).onDelete("cascade"),
  foreignKey({ columns: [t.userId, t.savedItemId], foreignColumns: [savedItems.userId, savedItems.id] }).onDelete("cascade"),
]);

export const applications = pgTable(
  "applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // program | hackathon
    targetId: text("target_id").notNull(), // GSoC | Outreachy | hackathon id
    targetTitle: text("target_title"),
    status: text("status").notNull().default("drafting"),
    // drafting → roadmap → drafting_done → submitted → interview → accepted | rejected
    notes: jsonb("notes"), // roadmap steps, drafts, checklist state
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("app_unique_idx").on(t.userId, t.kind, t.targetId),
    index("app_user_idx").on(t.userId),
  ],
);

export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").notNull(), // org_nomination | data_fix | feedback | newsletter
    name: text("name"),
    email: text("email"),
    payload: jsonb("payload").notNull(),
    status: text("status").notNull().default("new"), // new | seen | done | wont_fix
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("submissions_kind_idx").on(t.kind, t.status)],
);

/* ── catalog ────────────────────────────────────────────────────────── */

export const repos = pgTable(
  "repos",
  {
    id: serial("id").primaryKey(),
    fullName: text("full_name").notNull(), // owner/name
    cat: text("cat").notNull(), // skills | cursor | agentsmd | mcp | tools
    stars: integer("stars").notNull().default(0),
    forks: integer("forks").notNull().default(0),
    issues: integer("issues").notNull().default(0),
    lang: text("lang"),
    license: text("license"),
    updated: date("updated"), // last push, from GitHub
    homepage: text("homepage"),
    url: text("url").notNull(),
    description: text("description"),
    topics: text("topics").array().notNull().default([]),
    // filter dimensions — nullable until the classifier has run
    domain: text("domain").array(), // writing | ui | coding | data | devops | security | docs | research | marketing | product | media | automation
    models: text("models").array(), // claude | chatgpt | gemini | cursor | copilot | windsurf | open | any
    format: text("format"), // skill | mcp | cursor-rules | agents-md | prompt-pack | plugin | agent | cli | library
    frameworks: text("frameworks").array(), // react | next | django | flutter
    snapshot: date("snapshot").notNull(), // when the catalog was refreshed
  },
  (t) => [
    uniqueIndex("repos_name_idx").on(t.fullName),
    index("repos_cat_stars_idx").on(t.cat, t.stars),
  ],
);

export const orgs = pgTable(
  "orgs",
  {
    login: text("login").primaryKey(),
    name: text("name").notNull(),
    domain: text("domain"),
    level: text("level"), // beginner | intermediate | advanced
    tagline: text("tagline"),
    topics: text("topics").array().notNull().default([]),
    repoCount: integer("repo_count").notNull().default(0),
    stars: integer("stars").notNull().default(0),
    issues: integer("issues").notNull().default(0),
    followers: integer("followers"),
    joined: text("joined"),
    location: text("location"),
    snapshot: date("snapshot").notNull(),
  },
  (t) => [index("orgs_stars_idx").on(t.stars)],
);

export const orgRepos = pgTable(
  "org_repos",
  {
    id: serial("id").primaryKey(),
    orgLogin: text("org_login").notNull().references(() => orgs.login, { onDelete: "cascade" }),
    repo: text("repo").notNull(),
    description: text("description"),
    lang: text("lang"),
    stars: integer("stars").notNull().default(0),
    forks: integer("forks").notNull().default(0),
    issues: integer("issues").notNull().default(0),
    url: text("url").notNull(),
  },
  (t) => [index("org_repos_org_idx").on(t.orgLogin, t.stars)],
);

export const hackathons = pgTable(
  "hackathons",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    org: text("org").notNull(),
    orgLogo: text("org_logo"),
    theme: text("theme"),
    status: text("status").notNull(), // open | upcoming | rolling | recurring | closed
    deadline: date("deadline"),
    estimated: boolean("estimated").notNull().default(false),
    participants: text("participants"),
    prize: text("prize"),
    format: text("format"),
    eligibility: text("eligibility"),
    perks: text("perks"),
    tags: text("tags").array().notNull().default([]),
    color: text("color"),
    art: text("art"),
    url: text("url"),
    details: jsonb("details").notNull(), // timeline | prep | approach | ideas | stack
    snapshot: date("snapshot").notNull(),
  },
  (t) => [index("hackathons_status_idx").on(t.status, t.deadline)],
);

export const programProjects = pgTable(
  "program_projects",
  {
    id: serial("id").primaryKey(),
    program: text("program").notNull(), // GSoC | LFX | Outreachy | Season of Blogs
    uid: text("uid").notNull(), // source id (GSoC org id / LFX uuid)
    year: integer("year").notNull(),
    term: text("term"), // "Summer 2024" etc.
    title: text("title").notNull(),
    org: text("org").notNull(),
    status: text("status"),
    tech: text("tech").array().notNull().default([]),
    topics: text("topics").array().notNull().default([]),
    blurb: text("blurb"),
    mentors: text("mentors"),
    url: text("url"),
  },
  (t) => [
    uniqueIndex("program_projects_uid_idx").on(t.program, t.uid),
    index("program_projects_org_idx").on(t.org, t.year),
  ],
);

export const resources = pgTable(
  "resources",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    provider: text("provider").notNull(), // GitHub org login for the avatar
    brand: text("brand").notNull(),
    category: text("category").notNull(),
    level: text("level").notNull(),
    time: text("time"),
    url: text("url").notNull(),
    description: text("description").notNull(),
    why: text("why"),
    use: text("use"),
    tags: text("tags").array().notNull().default([]),
    free: boolean("free").notNull().default(true),
  },
);

export const catalogMeta = pgTable("catalog_meta", {
  key: text("key").primaryKey(), // snapshot | counts | source
  value: jsonb("value").notNull(),
});

/* ── mentorship ──────────────────────────────────────────────────────── */

export const mentors = pgTable(
  "mentors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    bio: text("bio"),
    expertise: text("expertise").array().notNull().default([]), // skills, stacks
    interests: text("interests").array().notNull().default([]), // domains, topics
    timezone: text("timezone").notNull().default("UTC"),
    availabilityHours: integer("availability_hours").notNull().default(5),
    maxMentees: integer("max_mentees").notNull().default(2),
    currentMentees: integer("current_mentees").notNull().default(0),
    status: text("status").notNull().default("active"), // active | busy | inactive
    rating: integer("rating").notNull().default(0), // average rating scaled (e.g. 50 = 5.0)
    reviewCount: integer("review_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("mentors_status_idx").on(t.status),
    index("mentors_timezone_idx").on(t.timezone),
  ],
);

export const mentees = pgTable(
  "mentees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    bio: text("bio"),
    goals: text("goals").notNull(),
    skillLevel: text("skill_level").notNull().default("beginner"), // beginner | intermediate | advanced
    interests: text("interests").array().notNull().default([]),
    currentSkills: text("current_skills").array().notNull().default([]),
    desiredSkills: text("desired_skills").array().notNull().default([]),
    timezone: text("timezone").notNull().default("UTC"),
    availabilityHours: integer("availability_hours").notNull().default(5),
    status: text("status").notNull().default("seeking"), // seeking | matched | inactive
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("mentees_status_idx").on(t.status),
    index("mentees_skill_level_idx").on(t.skillLevel),
  ],
);

export const mentorships = pgTable(
  "mentorships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mentorId: uuid("mentor_id").notNull().references(() => mentors.id, { onDelete: "cascade" }),
    menteeId: uuid("mentee_id").notNull().references(() => mentees.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"), // pending | accepted | declined | active | completed | cancelled
    compatibilityScore: integer("compatibility_score").notNull().default(0), // 0 to 100
    matchDetails: jsonb("match_details"),
    message: text("message"),
    responseMessage: text("response_message"),
    sessions: jsonb("sessions").notNull().default([]),
    feedback: jsonb("feedback"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("mentorships_mentor_idx").on(t.mentorId, t.status),
    index("mentorships_mentee_idx").on(t.menteeId, t.status),
  ],
);

/* ── inferred row types ─────────────────────────────────────────────── */

export type UserRow = typeof users.$inferSelect;
export type EmailCodeRow = typeof emailCodes.$inferSelect;
export type SavedItemRow = typeof savedItems.$inferSelect;
export type ApplicationRow = typeof applications.$inferSelect;
export type SubmissionRow = typeof submissions.$inferSelect;
export type RepoRow = typeof repos.$inferSelect;
export type OrgRow = typeof orgs.$inferSelect;
export type HackathonRow = typeof hackathons.$inferSelect;
export type ProgramProjectRow = typeof programProjects.$inferSelect;
export type ResourceRow = typeof resources.$inferSelect;
export type MentorRow = typeof mentors.$inferSelect;
export type MenteeRow = typeof mentees.$inferSelect;
export type MentorshipRow = typeof mentorships.$inferSelect;
