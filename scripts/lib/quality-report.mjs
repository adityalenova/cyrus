/* ══ scripts/lib/quality-report.mjs — what a refresh changed, and whether to ship it ══
   A catalog refresh touches every page that counts something. The rows come
   from thirteen different programs' own endpoints, and one bad day upstream -
   a page that returned half the archive, a rename, a schema change - reads
   exactly like a quiet day with fewer projects. Until now the only signal was
   the number in the console line.

   This module answers three questions before the site is rewritten:

     what moved?     rows added, removed, unchanged, and the fields that changed
     what is wrong?  rows that break the column contract, by program and row id
     may we ship it? the same numbers against limits a maintainer can set

   Two outputs, same data: JSON for a machine to gate on, Markdown for a person
   to review in a pull request or a run log.

   Secrets never enter either. A row is identified by its program and its own
   id, field values appear only as short previews, and any field whose name
   looks like a credential is previewed as [redacted] even though the shape of
   this data has no place for one. Request headers, tokens and response bodies
   are not read by anything in here.

     import { buildReport, evaluateThresholds, renderMarkdown } from "./lib/quality-report.mjs";
   ═══════════════════════════════════════════════════════════════════════════ */

/** how many entries of each list a report carries before it says "and N more" */
export const LIST_CAP = 25;
/** characters of a field value shown in a diff */
export const PREVIEW_CAP = 80;
/** how many changed columns of one row a report prints before pointing at the JSON */
export const FIELD_CAP = 8;

/**
 * @typedef {Object} FieldChange one column of one row, as two previews
 * @property {string} field
 * @property {string} from
 * @property {string} to
 */

/**
 * a list a report shows a page of at a time: `shown` is what a reviewer reads,
 * `all` is what the JSON artifact carries, including the entries `omitted`
 * @typedef {{ shown: Array<any>, all: Array<any>, total: number, omitted: number }} Page
 */

/**
 * @typedef {Object} ChangedRow
 * @property {string} id
 * @property {Array<FieldChange>} fields
 * @property {Array<FieldChange>} fieldsAll
 * @property {number} fieldsOmitted
 */

/**
 * @typedef {Object} DatasetDiff
 * @property {number} before
 * @property {number} after
 * @property {Page} added
 * @property {Page} removed
 * @property {{ shown: Array<ChangedRow>, all: Array<ChangedRow>, total: number, omitted: number }} changed
 * @property {number} unchanged
 * @property {number} addedCount
 * @property {number} removedCount
 * @property {number} changedCount
 * @property {number|null} removedPct
 * @property {number|null} changedPct
 * @property {number|null} grewPct
 */

/**
 * @typedef {Object} InvalidRow one row that broke the column contract
 * @property {string} id
 * @property {string} program
 * @property {string} problem
 * @property {string} value
 */

/** a field name that must never be shown, whatever the data turned out to hold */
const SECRET_FIELD = /(token|secret|password|passwd|credential|api[_-]?key|authorization|cookie|session)/i;

/** what one row is keyed by: the program's own id, else its title
    (snapshots from before the current column contract spell those `title`/`org`,
    and a renamed column must not read as the whole program having changed) */
const rowKey = (r) => {
  const id = String(r?.u ?? r?.slug ?? "").trim();
  if (id) return id;
  const title = String(r?.t ?? r?.title ?? "").trim();
  return title || String(r?.url ?? "").trim();
};

/** where a dataset keeps its rows: `list` is the contract the builders ship
    under, an array-valued `projects` is what older snapshots on disk hold */
const rowsOf = (dataset, key = "list") => {
  if (!dataset || typeof dataset !== "object") return undefined;
  if (Array.isArray(dataset[key])) return dataset[key];
  if (Array.isArray(dataset.list)) return dataset.list;
  if (Array.isArray(dataset.projects)) return dataset.projects;
  return undefined;
};

/** how many rows a dataset says it holds, in whichever field states it */
const statedOf = (dataset) => {
  const n = dataset?.projects ?? dataset?.rows;
  return typeof n === "number" ? n : null;
};

/* Key a list by row identity, keeping every row: two projects can carry the
   same title, and a second one saying it is numbered rather than dropped.
   Collapsing them would hide a loss, which is the one thing this report
   exists to catch. */
function indexRows(list) {
  const map = new Map();
  for (const r of list) {
    const base = rowKey(r);
    let key = base;
    for (let n = 2; map.has(key); n++) key = `${base}#${n}`;
    map.set(key, r);
  }
  return map;
}

const preview = (value) => {
  if (value === null || value === undefined) return "null";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  const flat = String(text).replace(/\s+/g, " ").trim();
  return flat.length > PREVIEW_CAP ? `${flat.slice(0, PREVIEW_CAP - 1)}\u2026` : flat;
};

/** the same value, kept short and never carrying a credential */
export function safePreview(field, value) {
  return SECRET_FIELD.test(String(field)) ? "[redacted]" : preview(value);
}

/**
 * The limits the gate uses. Every number is a percentage of what was there
 * before, so a small program's ordinary churn cannot trip a global threshold
 * and a large one's collapse cannot hide behind a global average.
 *
 *   maxRemovedPct      one dataset losing this share of its rows is a failure
 *   maxTotalDropPct    the whole archive dropping this share is a failure
 *   maxGainedPct       an implausible same-day inflation is worth a look
 *   maxEmptyDatasets   datasets that went from rows to nothing
 *   maxInvalidRecords  malformed rows tolerated at all
 *   maxChangedPct      a dataset whose rows all changed is a schema change, not news
 */
export const DEFAULT_THRESHOLDS = {
  maxRemovedPct: 10,
  maxTotalDropPct: 10,
  maxGainedPct: 50,
  maxEmptyDatasets: 0,
  maxInvalidRecords: 0,
  maxChangedPct: 60,
};

const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null);

/**
 * Compare one dataset's rows.
 *
 * Each list arrives twice: `shown` holds what a reviewer reads on screen,
 * `all` holds every entry so the JSON artifact can carry the promise the
 * Markdown makes when it says "and N more, all in the JSON report".
 *
 * @param {Array<object>|undefined} before the rows the site serves now
 * @param {Array<object>|undefined} after the rows this refresh built
 * @returns {DatasetDiff}
 */
export function diffRows(before, after) {
  const prevRows = Array.isArray(before) ? before : [];
  const nextRows = Array.isArray(after) ? after : [];
  const prev = indexRows(prevRows), next = indexRows(nextRows);

  const added = [], removed = [], changed = [];
  for (const [key, row] of next) if (!prev.has(key)) added.push(changedLabel(key, row));
  for (const [key, row] of prev) if (!next.has(key)) removed.push(changedLabel(key, row));
  let unchanged = 0;
  for (const [key, row] of next) {
    if (!prev.has(key)) continue;
    const fields = changedFields(prev.get(key), row);
    if (fields.length) {
      changed.push({ id: key, fields: fields.slice(0, FIELD_CAP), fieldsAll: fields, fieldsOmitted: Math.max(0, fields.length - FIELD_CAP) });
    } else unchanged += 1;
  }

  const cut = (list, n) => ({ shown: list.slice(0, n), all: list, total: list.length, omitted: Math.max(0, list.length - n) });
  return {
    before: prevRows.length,
    after: nextRows.length,
    added: cut(added, LIST_CAP),
    removed: cut(removed, LIST_CAP),
    changed: cut(changed, LIST_CAP),
    unchanged,
    addedCount: added.length,
    removedCount: removed.length,
    changedCount: changed.length,
    removedPct: pct(removed.length, prevRows.length),
    changedPct: pct(changed.length, prevRows.length),
    grewPct: pct(nextRows.length - prevRows.length, prevRows.length),
  };
}

/** the label a report shows for one row: its id and, where it has one, its title */
function changedLabel(key, row) {
  const title = String(row?.t ?? row?.title ?? "").trim();
  if (!title) return key || "(no id)";
  /* a row keyed by its own title - or the second row saying the same title -
     is not two pieces of information */
  if (key === title || key.startsWith(`${title}#`)) return safePreview("t", key);
  return `${key || "(no id)"}: ${safePreview("t", title)}`;
}

const sameValue = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * The columns of one row that the refresh changed, with short previews.
 *
 * Every key either version carries is compared, not just the columns the
 * archive is known to have: a field appearing for the first time is upstream
 * changing its schema, which is exactly what a reviewer should see. Values go
 * through safePreview, so a credential-shaped field name is reported as a
 * change without reporting its value.
 *
 * @returns {Array<FieldChange>}
 */
export function changedFields(prev, next) {
  const keys = [...new Set([...Object.keys(prev ?? {}), ...Object.keys(next ?? {})])].sort();
  const out = [];
  for (const f of keys) {
    const a = prev?.[f], b = next?.[f];
    if (a === undefined && b === undefined) continue;
    if (sameValue(a, b)) continue;
    out.push({ field: f, from: safePreview(f, a), to: safePreview(f, b) });
  }
  return out;
}

/**
 * Rows that break the column contract the shards ship under
 * (y,u,t,o,s,tt,tp,b,m,url,program plus stars/lang/license).
 *
 * @param {Array<object>|undefined} rows
 * @param {{program: string, years?: {min?: number, max?: number}}} source
 * @returns {Array<InvalidRow>}
 */
export function findInvalidRows(rows, source) {
  const list = Array.isArray(rows) ? rows : [];
  const min = source.years?.min ?? 1998;
  const max = source.years?.max ?? new Date().getFullYear() + 1;
  const seen = new Map();
  const problems = [];
  for (const r of list) {
    const id = rowKey(r) || "(no id)";
    /* only a row that carries its own id can repeat one: two projects with the
       same title are two projects, not a duplicate key */
    const own = String(r?.u ?? "").trim();
    if (own) seen.set(own, (seen.get(own) ?? 0) + 1);
    /* the field name is passed separately so a value that looks like a
       credential is redacted by name, whatever the problem text happens to say */
    const note = (field, problem, value) => problems.push({
      id, program: source.program, problem,
      value: value === undefined ? "" : safePreview(field, value),
    });
    if (!String(r?.t ?? r?.title ?? "").trim()) note("t", "a row with no title is not a row", r?.u);
    /* an absent value is unknown, not wrong: this archive spells unknown as an
       empty string in one shape and a null in another, and neither is a defect */
    if (r?.y != null && (!Number.isInteger(r.y) || r.y < min || r.y > max)) note("y", `year outside ${min}\u2013${max}`, r.y);
    if (r?.url != null && r.url !== "" && !/^https?:\/\//i.test(String(r.url))) note("url", "url is not a link", r.url);
    for (const tag of ["tt", "tp"]) {
      if (r?.[tag] == null) continue;
      if (!Array.isArray(r[tag])) note(tag, `${tag} is not a list`, r[tag]);
      else if (r[tag].some((x) => typeof x !== "string" || !x.trim())) note(tag, `${tag} holds an empty or non-string entry`, r[tag]);
    }
    if (!String(r?.o ?? r?.org ?? "").trim() && String(r?.t ?? r?.title ?? "").trim()) note("o", "a titled row with no organization", r?.t);
  }
  for (const [id, n] of seen) if (n > 1) problems.push({ id, program: source.program, problem: `row id used ${n} times in one shard`, value: "" });
  return problems;
}

/**
 * The report for a whole refresh.
 *
 * A dataset is one shard file as it stands: `before` is what the site serves,
 * `after` is what this run built, and rows are found under `list` or, in the
 * snapshots that predate that contract, under an array-valued `projects` - so
 * a renamed column reads as changed rows, never as an empty program.
 *
 * @param {{name: string, stamp: string, datasets: Array<{id: string, source: string,
 *           before: object|null, after: object|null, listKey?: string, years?: object}>,
 *         thresholds?: object, thresholdSource?: string, override?: {reason: string, by: string}|null}} opts
 */
export function buildReport({ name, stamp, datasets, thresholds = DEFAULT_THRESHOLDS,
  thresholdSource = "defaults", override = null }) {
  const used = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const rows = [];
  const invalid = [];
  let beforeTotal = 0, afterTotal = 0, invalidCount = 0;

  for (const d of datasets) {
    const before = rowsOf(d.before, d.listKey);
    const after = rowsOf(d.after, d.listKey);
    const diff = diffRows(before, after);
    const own = findInvalidRows(after, { program: d.id, years: d.years });
    invalidCount += own.length;
    invalid.push(...own);
    beforeTotal += diff.before;
    afterTotal += diff.after;
    rows.push({
      id: d.id,
      source: d.source ?? "",
      ...diff,
      invalidCount: own.length,
      invalid: own.slice(0, LIST_CAP),
      invalidAll: own,
      invalidOmitted: Math.max(0, own.length - LIST_CAP),
      /* the shard says how many rows it holds; a shard that disagrees with
         itself is a broken build whatever the diff looks like. a shard that
         states no number at all is unknown, not wrong. */
      stated: statedOf(d.after),
      statedMatches: statedOf(d.after) === null ? null : statedOf(d.after) === diff.after,
    });
  }

  const checks = evaluateThresholds({ rows, beforeTotal, afterTotal, invalidCount }, used);
  const failed = checks.filter((c) => !c.ok);
  const status = failed.length === 0 ? "pass" : override ? "overridden" : "fail";

  return {
    name,
    stamp,
    status,
    thresholds: used,
    thresholdSource,
    totals: {
      datasets: rows.length,
      before: beforeTotal,
      after: afterTotal,
      added: rows.reduce((n, r) => n + r.addedCount, 0),
      removed: rows.reduce((n, r) => n + r.removedCount, 0),
      changed: rows.reduce((n, r) => n + r.changedCount, 0),
      unchanged: rows.reduce((n, r) => n + r.unchanged, 0),
      invalid: invalidCount,
    },
    totalDeltaPct: pct(afterTotal - beforeTotal, beforeTotal),
    rows,
    checks,
    failed: failed.map((c) => c.name),
    override,
    /* what a maintainer has to do to publish anyway, spelled out rather than assumed */
    nextStep: status === "pass"
      ? "publish the refresh"
      : status === "overridden"
        ? `publish with the override recorded: ${override.reason}`
        : `review ${failed.map((c) => c.name).join(", ")}; publish only with CYRUS_QUALITY_OVERRIDE=\"<why this is expected>\"`,
  };
}

/**
 * @returns {Array<{name: string, limit: number|string, actual: number|null, ok: boolean, says: string}>}
 */
export function evaluateThresholds({ rows, beforeTotal, afterTotal, invalidCount }, t = DEFAULT_THRESHOLDS) {
  const empties = rows.filter((r) => r.before > 0 && r.after === 0);
  const worstRemoved = rows.reduce((m, r) => Math.max(m, r.removedPct ?? 0), 0);
  const worstChanged = rows.reduce((m, r) => Math.max(m, r.changedPct ?? 0), 0);
  const drop = beforeTotal > 0 ? Math.max(0, -1 * Math.round(((afterTotal - beforeTotal) / beforeTotal) * 1000) / 10) : 0;
  const gain = beforeTotal > 0 ? Math.max(0, Math.round(((afterTotal - beforeTotal) / beforeTotal) * 1000) / 10) : 0;
  const selfReport = rows.filter((r) => r.statedMatches === false);
  return [
    { name: "maxRemovedPct", limit: t.maxRemovedPct, actual: worstRemoved,
      says: empties.length || worstRemoved > t.maxRemovedPct
        ? `the worst dataset lost ${worstRemoved}% of its rows${empties.length ? `; ${empties.map((r) => r.id).join(", ")} went to nothing` : ""}`
        : `no dataset lost more than ${worstRemoved}% of its rows`,
      ok: worstRemoved <= t.maxRemovedPct },
    { name: "maxTotalDropPct", limit: t.maxTotalDropPct, actual: drop,
      says: drop > t.maxTotalDropPct ? `the archive shrank ${drop}%` : `the archive shrank at most ${drop}%`,
      ok: drop <= t.maxTotalDropPct },
    { name: "maxGainedPct", limit: t.maxGainedPct, actual: gain,
      says: gain > t.maxGainedPct ? `the archive grew ${gain}% in one refresh` : `the archive grew at most ${gain}%`,
      ok: gain <= t.maxGainedPct },
    { name: "maxEmptyDatasets", limit: t.maxEmptyDatasets, actual: empties.length,
      says: empties.length ? `${empties.map((r) => r.id).join(", ")} came back with no rows` : "every dataset has rows",
      ok: empties.length <= t.maxEmptyDatasets },
    { name: "maxInvalidRecords", limit: t.maxInvalidRecords, actual: invalidCount,
      says: invalidCount ? `${invalidCount} malformed row(s) across ${rows.filter((r) => r.invalidCount).map((r) => r.id).join(", ")}` : "every row satisfies the column contract",
      ok: invalidCount <= t.maxInvalidRecords },
    { name: "maxChangedPct", limit: t.maxChangedPct, actual: worstChanged,
      says: worstChanged > t.maxChangedPct ? `a dataset had ${worstChanged}% of its rows rewritten` : `no dataset rewrote more than ${worstChanged}% of its rows`,
      ok: worstChanged <= t.maxChangedPct },
    { name: "statedRowCounts", limit: "must equal the rows on disk", actual: selfReport.length,
      says: selfReport.length
        ? `${selfReport.map((r) => `${r.id} states ${r.stated} but holds ${r.after}`).join(", ")}`
        : "every shard's own row count matches its rows",
      ok: selfReport.length === 0 },
  ];
}

/** the review document: the same numbers as the JSON, in a shape to read */
export function renderMarkdown(report) {
  const L = [];
  const flag = report.status === "pass" ? "pass" : report.status === "overridden" ? "overridden, publishing anyway" : "FAIL, publication blocked";
  L.push(`# ${report.name} data-quality report \u2014 ${report.stamp}`);
  L.push("");
  L.push(`Status: **${flag}**`);
  L.push("");
  L.push(`| dataset | rows before | rows after | added | removed | changed | invalid |`);
  L.push(`| --- | --: | --: | --: | --: | --: | --: |`);
  for (const r of report.rows) {
    L.push(`| ${r.id} | ${r.before} | ${r.after} | ${r.added.total} | ${r.removed.total} | ${r.changedCount} | ${r.invalidCount} |`);
  }
  const t = report.totals;
  L.push(`| **all ${t.datasets}** | **${t.before}** | **${t.after}** | ${t.added} | ${t.removed} | ${t.changed} | ${t.invalid} |`);
  L.push("");
  L.push(`Net change ${t.after - t.before >= 0 ? "+" : ""}${t.after - t.before} rows (${report.totalDeltaPct ?? 0}%).`);
  L.push("");
  L.push("## Thresholds");
  L.push("");
  L.push(`| check | limit | actual | |`);
  L.push(`| --- | --: | --: | :-: |`);
  for (const c of report.checks) L.push(`| ${c.name} | ${c.limit} | ${c.actual} | ${c.ok ? "ok" : "**over**"} |`);
  L.push("");
  L.push(`Thresholds in force came from ${report.thresholdSource}.`);
  L.push("");

  /* the sentence a maintainer reads before the numbers: which limit broke and
     what the data actually did, so nobody has to reverse-engineer a threshold */
  const over = report.checks.filter((c) => !c.ok);
  if (over.length) {
    L.push("## Findings");
    L.push("");
    for (const c of over) L.push(`- **${c.name}** reached ${c.actual}, limit ${c.limit}: ${c.says}`);
    L.push("");
  }

  const sections = [
    ["Rows removed", (r) => r.removed, (e) => `- ${e}`],
    ["Rows added", (r) => r.added, (e) => `- ${e}`],
  ];
  for (const [title, pick, line] of sections) {
    const body = report.rows
      .filter((r) => pick(r).total > 0)
      .map((r) => [`### ${r.id}`, ...pick(r).shown.map(line), ...noteOmitted(pick(r).omitted)]);
    if (body.length) {
      L.push(`## ${title}`);
      L.push("");
      for (const block of body) L.push(...block);
      L.push("");
    }
  }

  const changedRows = report.rows.filter((r) => r.changedCount > 0);
  if (changedRows.length) {
    L.push("## Field changes");
    L.push("");
    L.push("Values are shown as short previews. A column whose name looks like a credential is printed as `[redacted]` instead of its value.");
    L.push("");
    for (const r of changedRows) {
      L.push(`### ${r.id} (${r.changedCount} row${r.changedCount === 1 ? "" : "s"})`);
      for (const c of r.changed.shown) {
        const text = c.fields.map((f) => `${f.field}: ${f.from} -> ${f.to}`).join("; ");
        const more = c.fieldsOmitted ? ` (+${c.fieldsOmitted} more column${c.fieldsOmitted === 1 ? "" : "s"})` : "";
        L.push(`- \`${c.id}\`: ${text}${more}`);
      }
      L.push(...noteOmitted(r.changed.omitted));
    }
    L.push("");
  }

  const invalidRows = report.rows.filter((r) => r.invalidCount > 0);
  if (invalidRows.length) {
    L.push("## Invalid records");
    L.push("");
    for (const r of invalidRows) {
      L.push(`### ${r.id} \u2014 ${r.invalidCount} problem${r.invalidCount === 1 ? "" : "s"} (source: ${r.source || "unknown"})`);
      for (const p of r.invalid) L.push(`- \`${p.id}\`: ${p.problem}${p.value ? ` \u2014 ${p.value}` : ""}`);
      L.push(...noteOmitted(r.invalidOmitted));
    }
    L.push("");
  }

  if (report.override) {
    L.push("## Override");
    L.push("");
    L.push(`Published despite ${report.failed.join(", ")} exceeding their limits.`);
    L.push(`Reason given: ${report.override.reason}${report.override.by ? ` (by ${report.override.by})` : ""}`);
    L.push("");
  }
  L.push(`Next step: ${report.nextStep}.`);
  L.push("");
  return L.join("\n");
}

const noteOmitted = (n) => (n > 0 ? [`- \u2026 and ${n} more, all in the JSON report`] : []);

/**
 * Thresholds from the places a maintainer may set them: a JSON file, then the
 * environment, so a scheduled job can raise one limit for one run without a
 * commit. Anything unrecognised is reported rather than quietly ignored.
 *
 * @param {{file?: string|null, env?: Record<string, string|undefined>, read?: (p: string) => string}} opts
 */
export function resolveThresholds({ file = null, env = process.env, read = null } = {}) {
  const out = { thresholds: { ...DEFAULT_THRESHOLDS }, from: ["defaults"], notes: [] };
  const numeric = (obj, where) => {
    for (const [k, v] of Object.entries(obj ?? {})) {
      if (!(k in DEFAULT_THRESHOLDS)) { out.notes.push(`ignored ${k}: not a threshold`); continue; }
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) { out.notes.push(`ignored ${k}=\"${v}\": not a number at or above zero`); continue; }
      out.thresholds[k] = n;
    }
    out.from.push(where);
  };
  if (file && read) {
    try {
      numeric(JSON.parse(read(file)), file);
    } catch (e) {
      out.notes.push(`--thresholds ${file} could not be read: ${e?.message ?? e}`);
    }
  }
  const inline = env.CYRUS_QUALITY_THRESHOLDS;
  if (inline) {
    try {
      numeric(JSON.parse(inline), "CYRUS_QUALITY_THRESHOLDS");
    } catch (e) {
      out.notes.push(`CYRUS_QUALITY_THRESHOLDS is not JSON: ${e?.message ?? e}`);
    }
  }
  for (const key of Object.keys(DEFAULT_THRESHOLDS)) {
    const raw = env[`CYRUS_QUALITY_${key.toUpperCase()}`];
    if (raw === undefined) continue;
    numeric({ [key]: raw }, `env ${key}`);
  }
  return out;
}

/**
 * The override, when a maintainer chose to publish over a failed threshold.
 *
 * @param {Record<string, string|undefined>} [env]
 */
export function resolveOverride(env = process.env) {
  const reason = (env.CYRUS_QUALITY_OVERRIDE ?? "").trim();
  if (!reason) return null;
  return { reason, by: (env.CYRUS_QUALITY_OVERRIDE_BY ?? "").trim() || "the environment of this run" };
}

/** one paragraph for stdout, whether or not anybody reads the Markdown */
export function formatConsole(report) {
  const t = report.totals;
  const lines = [
    `data quality ${report.name} @ ${report.stamp}: ${t.after} rows across ${t.datasets} dataset(s) ` +
    `(${t.added} added, ${t.removed} removed, ${t.changed} changed, ${t.invalid} invalid) - ${report.status.toUpperCase()}`,
  ];
  for (const c of report.checks) {
    if (!c.ok) lines.push(`  over limit: ${c.name} ${c.actual} > ${c.limit} - ${c.says}`);
  }
  const invalidCheck = report.checks.find((c) => c.name === "maxInvalidRecords");
  if (t.invalid > 0 && invalidCheck?.ok) lines.push(`  within limit: ${t.invalid} malformed row(s), each listed in the report`);
  lines.push(`  ${report.nextStep}`);
  return lines.join("\n");
}
