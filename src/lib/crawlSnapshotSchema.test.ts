/* ══ crawlSnapshotSchema.test.ts — schema validation and drift protection ══ */
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  CURRENT_CRAWL_SNAPSHOT_SCHEMA_VERSION,
  SUPPORTED_CRAWL_SNAPSHOT_SCHEMA_VERSIONS,
  SnapshotSchemaError,
  parseAndValidateIssueSnapshot,
  parseAndValidateJsonlSnapshot,
  validateCrawlIssueRecord,
  validateIssueMeta,
  validateIssueRow,
  validateIssueSnapshot,
} from "./crawlSnapshotSchema.mjs";

const FIXTURES_DIR = new URL("../fixtures/snapshots/", import.meta.url);
const readFixture = (name: string) => readFileSync(new URL(name, FIXTURES_DIR), "utf8");

const validRow = () => ({
  r: "owner/repo",
  n: 42,
  t: "Valid issue title",
  a: 0,
  l: ["good first issue"],
  g: "TypeScript",
  s: 1500,
  u: "2026-10-21",
  c: "2026-10-15",
  m: 2,
  b: 1 as const,
});

const validMeta = () => ({
  schemaVersion: CURRENT_CRAWL_SNAPSHOT_SCHEMA_VERSION,
  generated: "2026-10-21",
  issues: 1,
  repos: 1,
  orgs: 1,
  languages: 1,
  beginner: 1,
  unassigned: 1,
});

describe("crawlSnapshotSchema version constants", () => {
  it("declares current schema version 1", () => {
    expect(CURRENT_CRAWL_SNAPSHOT_SCHEMA_VERSION).toBe(1);
    expect(SUPPORTED_CRAWL_SNAPSHOT_SCHEMA_VERSIONS).toContain(1);
  });
});

describe("validateIssueRow", () => {
  it("accepts a completely valid row", () => {
    const row = validRow();
    expect(validateIssueRow(row)).toEqual(row);
  });

  it("allows null for language (g)", () => {
    const row = { ...validRow(), g: null };
    expect(validateIssueRow(row).g).toBeNull();
  });

  it("rejects non-object row", () => {
    expect(() => validateIssueRow(null)).toThrow(SnapshotSchemaError);
    expect(() => validateIssueRow("not-an-object")).toThrow(/must be an object/);
  });

  it("rejects invalid repository identifier (r)", () => {
    expect(() => validateIssueRow({ ...validRow(), r: "" })).toThrow(/must be a non-empty repository string/);
    expect(() => validateIssueRow({ ...validRow(), r: 123 })).toThrow(SnapshotSchemaError);
  });

  it("rejects non-positive issue numbers (n)", () => {
    expect(() => validateIssueRow({ ...validRow(), n: 0 })).toThrow(/must be a positive integer issue number/);
    expect(() => validateIssueRow({ ...validRow(), n: -5 })).toThrow(SnapshotSchemaError);
    expect(() => validateIssueRow({ ...validRow(), n: "42" as any })).toThrow(SnapshotSchemaError);
    expect(() => validateIssueRow({ ...validRow(), n: 42.5 })).toThrow(SnapshotSchemaError);
  });

  it("rejects empty or non-string titles (t)", () => {
    expect(() => validateIssueRow({ ...validRow(), t: "   " })).toThrow(/must be a non-empty string title/);
    expect(() => validateIssueRow({ ...validRow(), t: null as any })).toThrow(SnapshotSchemaError);
  });

  it("rejects invalid assignee count (a)", () => {
    expect(() => validateIssueRow({ ...validRow(), a: -1 })).toThrow(/must be a non-negative integer assignee count/);
    expect(() => validateIssueRow({ ...validRow(), a: "0" as any })).toThrow(SnapshotSchemaError);
  });

  it("rejects invalid labels (l)", () => {
    expect(() => validateIssueRow({ ...validRow(), l: "bug" as any })).toThrow(/must be an array of string labels/);
    expect(() => validateIssueRow({ ...validRow(), l: [123 as any] })).toThrow(/must be an array of string labels/);
  });

  it("rejects non-string non-null languages (g)", () => {
    expect(() => validateIssueRow({ ...validRow(), g: 123 as any })).toThrow(/must be a string language or null/);
  });

  it("rejects negative stars (s)", () => {
    expect(() => validateIssueRow({ ...validRow(), s: -10 })).toThrow(/must be a non-negative integer star count/);
  });

  it("rejects invalid date stamps (u, c)", () => {
    expect(() => validateIssueRow({ ...validRow(), u: "not-a-date" })).toThrow(/must be a date string formatted as YYYY-MM-DD/);
    expect(() => validateIssueRow({ ...validRow(), c: "invalid" })).toThrow(/must be a date string formatted as YYYY-MM-DD/);
  });

  it("rejects invalid comment count (m)", () => {
    expect(() => validateIssueRow({ ...validRow(), m: -1 })).toThrow(/must be a non-negative integer comment count/);
  });

  it("rejects beginner flag (b) that is not 0 or 1", () => {
    expect(() => validateIssueRow({ ...validRow(), b: true as any })).toThrow(/must be 0 or 1/);
    expect(() => validateIssueRow({ ...validRow(), b: 2 as any })).toThrow(/must be 0 or 1/);
    expect(() => validateIssueRow({ ...validRow(), b: "1" as any })).toThrow(/must be 0 or 1/);
  });
});

describe("validateIssueMeta", () => {
  it("accepts valid metadata with schemaVersion", () => {
    const meta = validMeta();
    const res = validateIssueMeta(meta);
    expect(res.schemaVersion).toBe(1);
    expect(res.generated).toBe("2026-10-21");
  });

  it("rejects missing schemaVersion with actionable message", () => {
    const meta = { ...validMeta(), schemaVersion: undefined };
    expect(() => validateIssueMeta(meta)).toThrowError(
      expect.objectContaining({
        code: "MISSING_SCHEMA_VERSION",
        action: expect.stringContaining("Regenerate the snapshot"),
      }),
    );
  });

  it("rejects unsupported schemaVersion with actionable message", () => {
    const meta = { ...validMeta(), schemaVersion: 2 };
    expect(() => validateIssueMeta(meta)).toThrowError(
      expect.objectContaining({
        code: "UNSUPPORTED_SCHEMA_VERSION",
        action: expect.stringContaining("Update application consumer"),
      }),
    );
  });

  it("rejects invalid date in generated", () => {
    const meta = { ...validMeta(), generated: "invalid" };
    expect(() => validateIssueMeta(meta)).toThrow(/meta\.generated must be a valid date string/);
  });

  it("rejects negative or invalid counts", () => {
    expect(() => validateIssueMeta({ ...validMeta(), issues: -1 })).toThrow(/meta\.issues must be a non-negative integer/);
    expect(() => validateIssueMeta({ ...validMeta(), repos: "1" as any })).toThrow(/meta\.repos must be a non-negative integer/);
  });
});

describe("validateIssueSnapshot", () => {
  it("validates full snapshot payload and enforces count consistency", () => {
    const payload = {
      schemaVersion: 1,
      meta: validMeta(),
      items: [validRow()],
    };
    const validated = validateIssueSnapshot(payload);
    expect(validated.schemaVersion).toBe(1);
    expect(validated.items.length).toBe(1);
  });

  it("flags drift when meta.issues does not equal items.length", () => {
    const payload = {
      schemaVersion: 1,
      meta: { ...validMeta(), issues: 99 },
      items: [validRow()],
    };
    expect(() => validateIssueSnapshot(payload)).toThrowError(
      expect.objectContaining({
        code: "COUNT_MISMATCH",
      }),
    );
  });
});

describe("parseAndValidateIssueSnapshot", () => {
  it("inflates gzipped buffer, parses JSON, and validates schema", () => {
    const payload = {
      schemaVersion: 1,
      meta: validMeta(),
      items: [validRow()],
    };
    const gz = gzipSync(Buffer.from(JSON.stringify(payload), "utf8"));
    const res = parseAndValidateIssueSnapshot(gz);
    expect(res.schemaVersion).toBe(1);
    expect(res.items.length).toBe(1);
  });

  it("rejects truncated or malformed gzip / JSON buffers", () => {
    expect(() => parseAndValidateIssueSnapshot(Buffer.from("not-json"))).toThrowError(
      expect.objectContaining({ code: "PARSE_ERROR" }),
    );
  });
});

describe("acceptance criteria fixtures", () => {
  it("Fixture 1: supported snapshot loads cleanly and passes all checks", () => {
    const json = JSON.parse(readFixture("supported-snapshot.json"));
    const res = validateIssueSnapshot(json);
    expect(res.schemaVersion).toBe(1);
    expect(res.items.length).toBe(2);
    expect(res.items[0].r).toBe("vercel/next.js");
  });

  it("Fixture 2: missing-version snapshot is rejected with actionable error", () => {
    const json = JSON.parse(readFixture("missing-version-snapshot.json"));
    expect(() => validateIssueSnapshot(json)).toThrowError(
      expect.objectContaining({
        code: "MISSING_SCHEMA_VERSION",
        action: expect.stringMatching(/Regenerate the snapshot/i),
      }),
    );
  });

  it("Fixture 3: unsupported-version snapshot is rejected with actionable error", () => {
    const json = JSON.parse(readFixture("unsupported-version-snapshot.json"));
    expect(() => validateIssueSnapshot(json)).toThrowError(
      expect.objectContaining({
        code: "UNSUPPORTED_SCHEMA_VERSION",
        action: expect.stringMatching(/Update application consumer/i),
      }),
    );
  });

  it("Fixture 4: invalid-field snapshot is rejected naming the invalid field path", () => {
    const json = JSON.parse(readFixture("invalid-field-snapshot.json"));
    expect(() => validateIssueSnapshot(json)).toThrowError(
      expect.objectContaining({
        code: "INVALID_FIELD",
        path: "items[0].n",
      }),
    );
  });
});

describe("JSONL crawl snapshot validation", () => {
  it("Fixture 5: supported crawl JSONL with header parses and validates", () => {
    const text = readFixture("supported-crawl.jsonl");
    const res = parseAndValidateJsonlSnapshot(text);
    expect(res.schemaVersion).toBe(1);
    expect(res.records.length).toBe(2);
    expect(res.records[0].repo).toBe("vercel/next.js");
  });

  it("Fixture 6: missing-version crawl JSONL is rejected with actionable error", () => {
    const text = readFixture("missing-version-crawl.jsonl");
    expect(() => parseAndValidateJsonlSnapshot(text)).toThrowError(
      expect.objectContaining({
        code: "MISSING_SCHEMA_VERSION",
      }),
    );
  });

  it("Fixture 7: invalid-field crawl JSONL is rejected naming line and field", () => {
    const text = readFixture("invalid-field-crawl.jsonl");
    expect(() => parseAndValidateJsonlSnapshot(text)).toThrowError(
      expect.objectContaining({
        code: "INVALID_FIELD",
        path: "line 1.number",
      }),
    );
  });

  it("validateCrawlIssueRecord validates required fields on raw crawl lines", () => {
    const record = { number: 10, repo: "org/repo", title: "Valid title" };
    expect(validateCrawlIssueRecord(record)).toEqual(record);

    expect(() => validateCrawlIssueRecord({ number: 0, repo: "org/repo", title: "T" })).toThrow(/positive integer/);
    expect(() => validateCrawlIssueRecord({ number: 1, repo: "", title: "T" })).toThrow(/non-empty string/);
    expect(() => validateCrawlIssueRecord({ number: 1, repo: "a/b", title: " " })).toThrow(/non-empty string/);
  });
});
