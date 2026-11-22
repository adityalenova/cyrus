/* == notificationPrefs.ts - which notification goes where, kept pure =======
   Issue #196: a person chooses, per category, whether a notification reaches
   them by email, in the bell, or not at all; how often email is batched; and
   (through their timezone) when a digest lands. Everything that can be decided
   without a database or a mail server lives here, so the routes and the panel
   stay thin and the rules are unit-tested instead of clicked:

     defaults and validation   what a stored or submitted preference may be
     routeNotification         one event + one person's prefs -> where it goes
     latestSlot / digestDue    when the next digest is owed, in the person's
                               own timezone, correct under daylight saving
     digestSubject / groupBy   how a batch is presented

   No Node-only imports: the dashboard panel imports the labels from here. == */

export const CATEGORIES = ["deadlines", "new_programs", "weekly_digest", "mentions", "replies"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CHANNELS = ["email", "in_app", "off"] as const;
export type Channel = (typeof CHANNELS)[number];

export const FREQUENCIES = ["immediate", "daily", "weekly"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const CATEGORY_LABEL: Record<Category, string> = {
  deadlines: "Hackathon deadlines",
  new_programs: "New programs",
  weekly_digest: "Weekly digest",
  mentions: "Mentions",
  replies: "Replies",
};

export const CATEGORY_NOTE: Record<Category, string> = {
  deadlines: "A hackathon or program you follow is about to close.",
  new_programs: "A mentored program opens or is added to the index.",
  weekly_digest: "One roundup of what changed this week.",
  mentions: "Someone mentions you.",
  replies: "Someone replies to something you wrote.",
};

export const CHANNEL_LABEL: Record<Channel, string> = { email: "Email", in_app: "In-app", off: "Off" };

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  immediate: "Immediately",
  daily: "Daily digest",
  weekly: "Weekly digest",
};

/* Nothing is emailed until someone asks for it. */
export const DEFAULT_CATEGORIES: Record<Category, Channel> = {
  deadlines: "in_app",
  new_programs: "in_app",
  weekly_digest: "off",
  mentions: "in_app",
  replies: "in_app",
};

export type Prefs = {
  categories: Record<Category, Channel>;
  frequency: Frequency;
  /** IANA name such as "Asia/Kolkata"; digests are timed in it */
  timezone: string;
  /** local hour of day, 0-23, at which a digest is sent */
  digestHour: number;
  /** the one-click "stop all email" switch; the bell is not affected */
  unsubscribedAll: boolean;
};

export const DEFAULT_TIMEZONE = "UTC";
export const DEFAULT_DIGEST_HOUR = 8;

export const defaultPrefs = (): Prefs => ({
  categories: { ...DEFAULT_CATEGORIES },
  frequency: "daily",
  timezone: DEFAULT_TIMEZONE,
  digestHour: DEFAULT_DIGEST_HOUR,
  unsubscribedAll: false,
});

const isOne = <T extends string>(list: readonly T[], v: unknown): v is T =>
  typeof v === "string" && (list as readonly string[]).includes(v);

export const isCategory = (v: unknown): v is Category => isOne(CATEGORIES, v);
export const isChannel = (v: unknown): v is Channel => isOne(CHANNELS, v);
export const isFrequency = (v: unknown): v is Frequency => isOne(FREQUENCIES, v);
export const isHour = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 23;

export function isTimezone(v: unknown): v is string {
  if (typeof v !== "string" || !v || v.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: v });
    return true;
  } catch {
    return false;
  }
}

/** Coerce a stored row (anything the database or an older version left
 *  behind) into a valid Prefs. Unknown or invalid fields fall back to the
 *  default; nothing here throws. */
export function normalizePrefs(raw: unknown): Prefs {
  const out = defaultPrefs();
  if (!raw || typeof raw !== "object") return out;
  const r = raw as Record<string, unknown>;
  if (r.categories && typeof r.categories === "object") {
    const c = r.categories as Record<string, unknown>;
    for (const k of CATEGORIES) if (isChannel(c[k])) out.categories[k] = c[k];
  }
  if (isFrequency(r.frequency)) out.frequency = r.frequency;
  if (isTimezone(r.timezone)) out.timezone = r.timezone;
  if (isHour(r.digestHour)) out.digestHour = r.digestHour;
  if (typeof r.unsubscribedAll === "boolean") out.unsubscribedAll = r.unsubscribedAll;
  return out;
}

export type PatchResult = { ok: true; prefs: Prefs } | { ok: false; error: string };

/** Apply an untrusted request body on top of the current prefs. Only the
 *  fields that are present change, and anything present must be valid:
 *  a typo is a 400, not a silent default. */
export function applyPrefsPatch(current: Prefs, patch: unknown): PatchResult {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return { ok: false, error: "JSON object required" };
  const p = patch as Record<string, unknown>;
  const next: Prefs = { ...current, categories: { ...current.categories } };
  const known = new Set(["categories", "frequency", "timezone", "digestHour", "unsubscribedAll"]);
  for (const key of Object.keys(p)) if (!known.has(key)) return { ok: false, error: `unknown field "${key}"` };

  if ("categories" in p) {
    if (!p.categories || typeof p.categories !== "object" || Array.isArray(p.categories)) return { ok: false, error: "categories must be an object" };
    for (const [k, v] of Object.entries(p.categories as Record<string, unknown>)) {
      if (!isCategory(k)) return { ok: false, error: `unknown category "${k}"` };
      if (!isChannel(v)) return { ok: false, error: `channel for "${k}" must be email, in_app or off` };
      next.categories[k] = v;
    }
  }
  if ("frequency" in p) {
    if (!isFrequency(p.frequency)) return { ok: false, error: "frequency must be immediate, daily or weekly" };
    next.frequency = p.frequency;
  }
  if ("timezone" in p) {
    if (!isTimezone(p.timezone)) return { ok: false, error: "timezone must be an IANA name such as Asia/Kolkata" };
    next.timezone = p.timezone;
  }
  if ("digestHour" in p) {
    if (!isHour(p.digestHour)) return { ok: false, error: "digestHour must be a whole number from 0 to 23" };
    next.digestHour = p.digestHour;
  }
  if ("unsubscribedAll" in p) {
    if (typeof p.unsubscribedAll !== "boolean") return { ok: false, error: "unsubscribedAll must be true or false" };
    next.unsubscribedAll = p.unsubscribedAll;
  }
  return { ok: true, prefs: next };
}

/** The in-app feed (issue #185) names its rows by kind; these are the
 *  categories a person controls. A kind with no category (a new follower)
 *  is not one of the five and always stays in the bell. */
export function kindToCategory(kind: string): Category | null {
  if (kind === "hackathon" || kind === "deadline") return "deadlines";
  if (kind === "mention") return "mentions";
  return null;
}

export type Route = "none" | "in_app" | "email_now" | "email_digest";

/** Where one notification in `category` goes for this person.
 *  - off                         -> nowhere
 *  - in_app                      -> the bell only
 *  - email, "stop all" is on     -> nowhere (the one-click unsubscribe wins)
 *  - email, immediate            -> sent now
 *  - email, daily or weekly      -> held for the next digest */
export function routeNotification(prefs: Prefs, category: Category): Route {
  const channel = prefs.categories[category];
  if (channel === "off") return "none";
  if (channel === "in_app") return "in_app";
  if (prefs.unsubscribedAll) return "none";
  return prefs.frequency === "immediate" ? "email_now" : "email_digest";
}

/* -- timezone-aware digest timing ------------------------------------- */

const formatters = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23",
      year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric",
    });
    formatters.set(tz, f);
  }
  return f;
}

export type LocalParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

/** the wall-clock reading in `tz` at an instant */
export function localParts(at: Date, tz: string): LocalParts {
  const out: Record<string, number> = {};
  for (const p of fmt(tz).formatToParts(at)) if (p.type !== "literal") out[p.type] = Number(p.value);
  return { year: out.year, month: out.month, day: out.day, hour: out.hour, minute: out.minute, second: out.second };
}

/** milliseconds `tz` is ahead of UTC at an instant (negative to the west) */
function offsetAt(at: Date, tz: string): number {
  const l = localParts(at, tz);
  return Date.UTC(l.year, l.month - 1, l.day, l.hour, l.minute, l.second) - Math.floor(at.getTime() / 1000) * 1000;
}

/** the instant at which the wall clock in `tz` reads Y-M-D H:00. The second
 *  pass corrects the guess when a daylight-saving change falls in between. */
function wallToInstant(year: number, month: number, day: number, hour: number, tz: string): Date {
  const guess = Date.UTC(year, month - 1, day, hour);
  let t = guess - offsetAt(new Date(guess), tz);
  const again = guess - offsetAt(new Date(t), tz);
  if (again !== t) t = again;
  return new Date(t);
}

/** The most recent digest slot at or before `now`: the local `digestHour`
 *  o'clock of the latest day that qualifies (any day for daily and
 *  immediate, a Monday for weekly). Looking backwards instead of forwards
 *  means the answer does not depend on how often the cron runs: a run that is
 *  an hour late, or once a day, still finds the slot that is owed. */
export function latestSlot(prefs: Prefs, now: Date): Date {
  const today = localParts(now, prefs.timezone);
  for (let back = 0; back <= 8; back++) {
    const day = new Date(Date.UTC(today.year, today.month - 1, today.day - back));
    if (prefs.frequency === "weekly" && day.getUTCDay() !== 1) continue; // 1 = Monday
    const slot = wallToInstant(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), prefs.digestHour, prefs.timezone);
    if (slot.getTime() <= now.getTime()) return slot;
  }
  return now; // unreachable: a weekly slot always exists within eight days
}

/** A digest is due when a slot has passed since `since` - the last digest, or
 *  for someone who has never had one, the oldest item waiting. */
export function digestDue(prefs: Prefs, now: Date, since: Date): boolean {
  return latestSlot(prefs, now).getTime() > since.getTime();
}

/* -- presenting a batch -------------------------------------------------- */

export type DigestItem = { category: Category; title: string; body: string; href: string };

/** items grouped by category, in the order the panel lists them; empty
 *  categories are left out */
export function groupByCategory<T extends { category: Category }>(items: T[]): { category: Category; items: T[] }[] {
  return CATEGORIES.map((category) => ({ category, items: items.filter((i) => i.category === category) }))
    .filter((g) => g.items.length > 0);
}

export function digestSubject(count: number, frequency: Frequency): string {
  const what = frequency === "weekly" ? "week" : "day";
  return count === 1 ? `1 update on cyrus.ai this ${what}` : `${count} updates on cyrus.ai this ${what}`;
}

/** sample content for the template preview; never real user data */
export const SAMPLE_EVENTS: Record<Category, Omit<DigestItem, "category">> = {
  deadlines: { title: "Applications close in 3 days", body: "The Outreachy May round closes on Friday. Your saved program is one of them.", href: "/programs/outreachy" },
  new_programs: { title: "A new program was added", body: "Season of KDE is now tracked, with its dates, stipend and eligibility.", href: "/programs" },
  weekly_digest: { title: "This week on cyrus.ai", body: "12 new good-first-issues across the organizations you follow, and 2 programs changed dates.", href: "/issues" },
  mentions: { title: "You were mentioned", body: "A maintainer mentioned you on an issue you are working on.", href: "/dashboard/issues" },
  replies: { title: "New reply to your question", body: "Someone replied to your question about the application timeline.", href: "/dashboard" },
};

export const PREVIEW_TEMPLATES = [...CATEGORIES, "digest"] as const;
export type PreviewTemplate = (typeof PREVIEW_TEMPLATES)[number];
export const isPreviewTemplate = (v: unknown): v is PreviewTemplate => isOne(PREVIEW_TEMPLATES, v);
