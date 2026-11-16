/* ══ crawlSnapshotSchema.mjs — versioned schema for crawl snapshots ════
   Producers validate required fields and types before writing output.
   Consumers reject unsupported versions with an actionable error.
   Both scripts and Next.js import this directly.
   ═══════════════════════════════════════════════════════════════════════ */
import { gunzipSync } from "node:zlib";

export const CURRENT_CRAWL_SNAPSHOT_SCHEMA_VERSION = 1;
export const SUPPORTED_CRAWL_SNAPSHOT_SCHEMA_VERSIONS = Object.freeze([1]);

/**
 * Actionable error thrown when a snapshot breaks contract, has a missing/unsupported
 * schema version, or holds malformed fields.
 */
export class SnapshotSchemaError extends Error {
  /**
   * @param {string} message
   * @param {{
   *   code?: string,
   *   path?: string | null,
   *   expected?: any,
   *   actual?: any,
   *   action?: string
   * }} [options]
   */
  constructor(message, options = {}) {
    super(message);
    this.name = "SnapshotSchemaError";
    this.code = options.code || "SCHEMA_VALIDATION_ERROR";
    this.path = options.path ?? null;
    this.expected = options.expected !== undefined ? options.expected : null;
    this.actual = options.actual !== undefined ? options.actual : null;
    this.action = options.action || "Re-run the generator script or update consumer to match snapshot version.";
  }
}

const isNonEmptyString = (v) => typeof v === "string" && v.trim().length > 0;
const isPositiveInteger = (v) => typeof v === "number" && Number.isInteger(v) && v > 0;
const isNonNegativeInteger = (v) => typeof v === "number" && Number.isInteger(v) && v >= 0;
const isDateString = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v);
const isBinaryFlag = (v) => v === 0 || v === 1;

/**
 * Validate a single IssueRow in the issue index snapshot.
 *
 * @param {any} row
 * @param {number} [index]
 * @returns {import("./server/issueIndex").IssueRow}
 */
export function validateIssueRow(row, index = -1) {
  const prefix = index >= 0 ? `items[${index}]` : "item";
  if (!row || typeof row !== "object") {
    throw new SnapshotSchemaError(`${prefix} must be an object`, {
      code: "INVALID_ROW",
      path: prefix,
      expected: "object",
      actual: typeof row,
      action: "Check the crawler or index builder row emission logic.",
    });
  }

  if (!isNonEmptyString(row.r)) {
    throw new SnapshotSchemaError(
      `${prefix}.r must be a non-empty repository string ("owner/name")`,
      {
        code: "INVALID_FIELD",
        path: `${prefix}.r`,
        expected: "string (owner/name)",
        actual: row.r,
        action: "Ensure upstream repository identification produces a valid non-empty 'owner/repo' string.",
      },
    );
  }

  if (!isPositiveInteger(row.n)) {
    throw new SnapshotSchemaError(
      `${prefix}.n must be a positive integer issue number`,
      {
        code: "INVALID_FIELD",
        path: `${prefix}.n`,
        expected: "positive integer",
        actual: row.n,
        action: "Verify issue numbers are numeric and greater than 0.",
      },
    );
  }

  if (typeof row.t !== "string" || row.t.trim().length === 0) {
    throw new SnapshotSchemaError(
      `${prefix}.t must be a non-empty string title`,
      {
        code: "INVALID_FIELD",
        path: `${prefix}.t`,
        expected: "non-empty string",
        actual: row.t,
        action: "Filter out or supply a fallback title before index generation.",
      },
    );
  }

  if (!isNonNegativeInteger(row.a)) {
    throw new SnapshotSchemaError(
      `${prefix}.a must be a non-negative integer assignee count`,
      {
        code: "INVALID_FIELD",
        path: `${prefix}.a`,
        expected: "non-negative integer",
        actual: row.a,
        action: "Map missing assignees to 0 rather than omitting the field.",
      },
    );
  }

  if (!Array.isArray(row.l) || !row.l.every((x) => typeof x === "string")) {
    throw new SnapshotSchemaError(
      `${prefix}.l must be an array of string labels`,
      {
        code: "INVALID_FIELD",
        path: `${prefix}.l`,
        expected: "string[]",
        actual: row.l,
        action: "Ensure labels are serialized as an array of strings.",
      },
    );
  }

  if (row.g !== null && typeof row.g !== "string") {
    throw new SnapshotSchemaError(
      `${prefix}.g must be a string language or null`,
      {
        code: "INVALID_FIELD",
        path: `${prefix}.g`,
        expected: "string | null",
        actual: typeof row.g,
        action: "Convert unknown or missing languages to null.",
      },
    );
  }

  if (!isNonNegativeInteger(row.s)) {
    throw new SnapshotSchemaError(
      `${prefix}.s must be a non-negative integer star count`,
      {
        code: "INVALID_FIELD",
        path: `${prefix}.s`,
        expected: "non-negative integer",
        actual: row.s,
        action: "Default star counts to 0 when absent upstream.",
      },
    );
  }

  if (!isDateString(row.u)) {
    throw new SnapshotSchemaError(
      `${prefix}.u must be a date string formatted as YYYY-MM-DD`,
      {
        code: "INVALID_FIELD",
        path: `${prefix}.u`,
        expected: "YYYY-MM-DD date string",
        actual: row.u,
        action: "Format updated_at timestamp to YYYY-MM-DD day precision.",
      },
    );
  }

  if (!isDateString(row.c)) {
    throw new SnapshotSchemaError(
      `${prefix}.c must be a date string formatted as YYYY-MM-DD`,
      {
        code: "INVALID_FIELD",
        path: `${prefix}.c`,
        expected: "YYYY-MM-DD date string",
        actual: row.c,
        action: "Format created_at timestamp to YYYY-MM-DD day precision.",
      },
    );
  }

  if (!isNonNegativeInteger(row.m)) {
    throw new SnapshotSchemaError(
      `${prefix}.m must be a non-negative integer comment count`,
      {
        code: "INVALID_FIELD",
        path: `${prefix}.m`,
        expected: "non-negative integer",
        actual: row.m,
        action: "Default comment count to 0.",
      },
    );
  }

  if (!isBinaryFlag(row.b)) {
    throw new SnapshotSchemaError(
      `${prefix}.b must be 0 or 1 (beginner friendly flag)`,
      {
        code: "INVALID_FIELD",
        path: `${prefix}.b`,
        expected: "0 | 1",
        actual: row.b,
        action: "Map beginner label match to 1 and non-match to 0.",
      },
    );
  }

  return row;
}

/**
 * Validate metadata block of the issue index snapshot.
 *
 * @param {any} meta
 * @param {number} [rootVersion]
 * @returns {any}
 */
export function validateIssueMeta(meta, rootVersion) {
  if (!meta || typeof meta !== "object") {
    throw new SnapshotSchemaError("Snapshot meta must be an object", {
      code: "INVALID_PAYLOAD",
      path: "meta",
      expected: "object",
      actual: typeof meta,
      action: "Ensure the snapshot output wraps metadata in a 'meta' object.",
    });
  }

  const version = meta.schemaVersion ?? rootVersion;
  if (version === undefined || version === null) {
    throw new SnapshotSchemaError(
      `Snapshot is missing required schemaVersion (supported: ${SUPPORTED_CRAWL_SNAPSHOT_SCHEMA_VERSIONS.join(", ")}).`,
      {
        code: "MISSING_SCHEMA_VERSION",
        path: "meta.schemaVersion",
        expected: CURRENT_CRAWL_SNAPSHOT_SCHEMA_VERSION,
        actual: version,
        action: "Regenerate the snapshot with 'npm run issues' so it includes the schema version declaration.",
      },
    );
  }

  if (
    typeof version !== "number" ||
    !Number.isInteger(version) ||
    !SUPPORTED_CRAWL_SNAPSHOT_SCHEMA_VERSIONS.includes(version)
  ) {
    throw new SnapshotSchemaError(
      `Unsupported snapshot schema version ${version} (supported: ${SUPPORTED_CRAWL_SNAPSHOT_SCHEMA_VERSIONS.join(", ")}).`,
      {
        code: "UNSUPPORTED_SCHEMA_VERSION",
        path: "meta.schemaVersion",
        expected: CURRENT_CRAWL_SNAPSHOT_SCHEMA_VERSION,
        actual: version,
        action: `Update application consumer or regenerate data to match supported schema version ${SUPPORTED_CRAWL_SNAPSHOT_SCHEMA_VERSIONS.join(", ")}.`,
      },
    );
  }

  if (!isDateString(meta.generated)) {
    throw new SnapshotSchemaError("meta.generated must be a valid date string (YYYY-MM-DD)", {
      code: "INVALID_FIELD",
      path: "meta.generated",
      expected: "YYYY-MM-DD",
      actual: meta.generated,
      action: "Include an ISO day-precision date in meta.generated.",
    });
  }

  for (const countField of ["issues", "repos", "orgs", "languages", "beginner", "unassigned"]) {
    if (!isNonNegativeInteger(meta[countField])) {
      throw new SnapshotSchemaError(`meta.${countField} must be a non-negative integer`, {
        code: "INVALID_FIELD",
        path: `meta.${countField}`,
        expected: "non-negative integer",
        actual: meta[countField],
        action: `Ensure meta.${countField} is computed and emitted as a valid non-negative integer.`,
      });
    }
  }

  return {
    ...meta,
    schemaVersion: version,
  };
}

/**
 * Validate an entire issue index snapshot payload (meta + items).
 *
 * @param {any} payload
 * @returns {{ schemaVersion: number, meta: any, items: any[] }}
 */
export function validateIssueSnapshot(payload) {
  if (!payload || typeof payload !== "object") {
    throw new SnapshotSchemaError("Snapshot payload must be a JSON object", {
      code: "INVALID_PAYLOAD",
      path: "payload",
      expected: "object",
      actual: typeof payload,
      action: "Ensure JSON unmarshals into an object containing 'meta' and 'items'.",
    });
  }

  const rootVersion = payload.schemaVersion;
  const meta = validateIssueMeta(payload.meta, rootVersion);

  if (!Array.isArray(payload.items)) {
    throw new SnapshotSchemaError("Snapshot items must be an array of issue rows", {
      code: "INVALID_PAYLOAD",
      path: "items",
      expected: "array",
      actual: typeof payload.items,
      action: "Ensure payload.items is serialized as an array.",
    });
  }

  if (meta.issues !== payload.items.length) {
    throw new SnapshotSchemaError(
      `Snapshot count drift: meta.issues (${meta.issues}) does not match items.length (${payload.items.length})`,
      {
        code: "COUNT_MISMATCH",
        path: "meta.issues",
        expected: payload.items.length,
        actual: meta.issues,
        action: "Ensure meta.issues accurately counts the exported items array before saving.",
      },
    );
  }

  for (let i = 0; i < payload.items.length; i++) {
    validateIssueRow(payload.items[i], i);
  }

  return {
    schemaVersion: meta.schemaVersion,
    meta,
    items: payload.items,
  };
}

/**
 * Validate a raw issue record from crawl JSONL.
 *
 * @param {any} record
 * @param {number} [lineIndex]
 * @returns {any}
 */
export function validateCrawlIssueRecord(record, lineIndex = -1) {
  const prefix = lineIndex >= 0 ? `line ${lineIndex}` : "crawlRecord";
  if (!record || typeof record !== "object") {
    throw new SnapshotSchemaError(`${prefix} must be a JSON object`, {
      code: "INVALID_CRAWL_RECORD",
      path: prefix,
    });
  }

  if (!isPositiveInteger(record.number)) {
    throw new SnapshotSchemaError(`${prefix}.number must be a positive integer`, {
      code: "INVALID_FIELD",
      path: `${prefix}.number`,
      expected: "positive integer",
      actual: record.number,
      action: "Validate issue number from GitHub API response before appending to crawl output.",
    });
  }

  if (!isNonEmptyString(record.repo)) {
    throw new SnapshotSchemaError(`${prefix}.repo must be a non-empty string`, {
      code: "INVALID_FIELD",
      path: `${prefix}.repo`,
      expected: "string (owner/repo)",
      actual: record.repo,
      action: "Include the full repository name (owner/repo) on every crawled issue row.",
    });
  }

  if (typeof record.title !== "string" || record.title.trim().length === 0) {
    throw new SnapshotSchemaError(`${prefix}.title must be a non-empty string`, {
      code: "INVALID_FIELD",
      path: `${prefix}.title`,
      expected: "non-empty string",
      actual: record.title,
      action: "Omit or filter issues with empty titles upstream.",
    });
  }

  return record;
}

/**
 * Parse and validate a JSONL snapshot string.
 *
 * A JSONL snapshot may declare schema version either via a leading metadata header object:
 *   {"schemaVersion": 1, "type": "header", ...}
 * or via an explicit `schemaVersion` on each row.
 *
 * @param {string} text
 * @param {{ allowEmpty?: boolean }} [options]
 * @returns {{ schemaVersion: number, records: any[] }}
 */
export function parseAndValidateJsonlSnapshot(text, options = {}) {
  const lines = String(text)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (!lines.length) {
    if (options.allowEmpty) return { schemaVersion: CURRENT_CRAWL_SNAPSHOT_SCHEMA_VERSION, records: [] };
    throw new SnapshotSchemaError("JSONL snapshot is empty", {
      code: "EMPTY_SNAPSHOT",
      action: "Ensure crawl process emits at least one record or header before validation.",
    });
  }

  let first;
  try {
    first = JSON.parse(lines[0]);
  } catch (err) {
    throw new SnapshotSchemaError(`JSONL line 0 failed to parse: ${err.message}`, {
      code: "PARSE_ERROR",
      path: "line 0",
    });
  }

  let schemaVersion = first.schemaVersion;
  let startIndex = 0;

  if (first.type === "header" || first.schemaVersion !== undefined) {
    startIndex = 1;
  }

  if (schemaVersion === undefined || schemaVersion === null) {
    throw new SnapshotSchemaError(
      `JSONL snapshot is missing required schemaVersion (supported: ${SUPPORTED_CRAWL_SNAPSHOT_SCHEMA_VERSIONS.join(", ")}).`,
      {
        code: "MISSING_SCHEMA_VERSION",
        path: "line 0",
        expected: CURRENT_CRAWL_SNAPSHOT_SCHEMA_VERSION,
        actual: schemaVersion,
        action: "Add a header line declaring schemaVersion or include schemaVersion in records.",
      },
    );
  }

  if (!SUPPORTED_CRAWL_SNAPSHOT_SCHEMA_VERSIONS.includes(schemaVersion)) {
    throw new SnapshotSchemaError(
      `Unsupported JSONL snapshot schema version ${schemaVersion} (supported: ${SUPPORTED_CRAWL_SNAPSHOT_SCHEMA_VERSIONS.join(", ")}).`,
      {
        code: "UNSUPPORTED_SCHEMA_VERSION",
        path: "line 0",
        expected: CURRENT_CRAWL_SNAPSHOT_SCHEMA_VERSION,
        actual: schemaVersion,
        action: `Update consumer to support JSONL schema version ${schemaVersion}.`,
      },
    );
  }

  const records = [];
  for (let i = startIndex; i < lines.length; i++) {
    let rec;
    try {
      rec = JSON.parse(lines[i]);
    } catch (err) {
      throw new SnapshotSchemaError(`JSONL line ${i} failed to parse: ${err.message}`, {
        code: "PARSE_ERROR",
        path: `line ${i}`,
      });
    }
    validateCrawlIssueRecord(rec, i);
    records.push(rec);
  }

  return { schemaVersion, records };
}

/**
 * Inflate (if gzipped), parse, and validate an issue snapshot buffer or string.
 *
 * @param {Buffer | Uint8Array | string | object} raw
 * @returns {{ schemaVersion: number, meta: any, items: any[] }}
 */
export function parseAndValidateIssueSnapshot(raw) {
  if (typeof raw === "object" && raw !== null && !(raw instanceof Uint8Array)) {
    return validateIssueSnapshot(raw);
  }

  let text;
  if (typeof raw === "string") {
    text = raw;
  } else {
    const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
    const isGzip = buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b;
    text = isGzip ? gunzipSync(buf).toString("utf8") : buf.toString("utf8");
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new SnapshotSchemaError(`Malformed snapshot JSON: ${err.message}`, {
      code: "PARSE_ERROR",
      action: "Check if snapshot file is corrupted or truncated.",
    });
  }

  return validateIssueSnapshot(parsed);
}
