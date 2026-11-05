/* ══ queries.test.ts — the API validation guards ═══════════════ */
import { describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
}));

vi.mock("../db", () => ({
  getDb: () => dbMock,
}));

import {
  queryRepos, smallJson, validAppKind, validAppStatus, validEmail,
  validId, validItemType, validSubmissionKind,
} from "./queries";

describe("saved-item guards", () => {
  it("accepts only the four item types the site has pages for", () => {
    for (const t of ["repo", "org", "program", "issue"]) expect(validItemType(t)).toBe(true);
    expect(validItemType("wiki")).toBe(false);
    expect(validItemType("hackathon")).toBe(false);
    expect(validItemType(undefined)).toBe(false);
  });
  it("bounds item ids to sane strings", () => {
    expect(validId("vercel/next.js")).toBe(true);
    expect(validId("")).toBe(false);
    expect(validId("x".repeat(201))).toBe(false);
    expect(validId(42 as unknown as string)).toBe(false);
  });
});

describe("application guards", () => {
  it("knows the pipeline kinds and every status stage", () => {
    expect(validAppKind("program")).toBe(true);
    expect(validAppKind("job")).toBe(false);
    for (const s of ["drafting", "roadmap", "drafting_done", "submitted", "interview", "accepted", "rejected"]) {
      expect(validAppStatus(s)).toBe(true);
    }
    expect(validAppStatus("maybe")).toBe(false);
  });
});

describe("submission guards", () => {
  it("accepts the four inbox kinds only", () => {
    for (const k of ["org_nomination", "data_fix", "feedback", "newsletter"]) expect(validSubmissionKind(k)).toBe(true);
    expect(validSubmissionKind("spam")).toBe(false);
  });
  it("lets small JSON through and blocks oversized or non-objects", () => {
    expect(smallJson({ a: 1 })).toBe(true);
    expect(smallJson(null)).toBe(true);
    expect(smallJson("text")).toBe(false);
    expect(smallJson({ blob: "x".repeat(9000) })).toBe(false);
  });
  it("validates emails without being clever about it", () => {
    expect(validEmail("dev@example.com")).toBe(true);
    expect(validEmail("nope")).toBe(false);
    expect(validEmail("a@b")).toBe(false);
    expect(validEmail("a b@c.de")).toBe(false);
  });
});

describe("queryRepos data access", () => {
  it("queries rows and count concurrently with matching conditions", async () => {
    const mockRows = [{ id: 1, fullName: "cyrus/repo" }];
    const dataChain = {
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockResolvedValue(mockRows),
    };
    const countChain = {
      where: vi.fn().mockReturnThis(),
      then: (resolve: (v: unknown) => unknown) => Promise.resolve([{ count: 42 }]).then(resolve),
    };

    dbMock.select
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue(dataChain) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue(countChain) });

    const result = await queryRepos({
      cat: "mcp",
      q: "test",
      domain: "coding",
      page: 2,
      perPage: 10,
    });

    expect(result).toEqual({ rows: mockRows, total: 42 });
    expect(dataChain.where).toHaveBeenCalled();
    expect(countChain.where).toHaveBeenCalled();
    expect(dataChain.limit).toHaveBeenCalledWith(10);
    expect(dataChain.offset).toHaveBeenCalledWith(10);
  });

  it("handles zero matching results with total 0", async () => {
    const dataChain = {
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockResolvedValue([]),
    };
    const countChain = {
      then: (resolve: (v: unknown) => unknown) => Promise.resolve([]).then(resolve),
    };

    dbMock.select
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue(dataChain) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue(countChain) });

    const result = await queryRepos({});
    expect(result).toEqual({ rows: [], total: 0 });
    expect(dataChain.limit).toHaveBeenCalledWith(24);
    expect(dataChain.offset).toHaveBeenCalledWith(0);
  });

  it("clamps perPage up to 60 and page down to 1", async () => {
    const dataChain = {
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockResolvedValue([]),
    };
    const countChain = {
      then: (resolve: (v: unknown) => unknown) => Promise.resolve([{ count: 100 }]).then(resolve),
    };

    dbMock.select
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue(dataChain) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue(countChain) });

    const result = await queryRepos({ page: -5, perPage: 200 });
    expect(result).toEqual({ rows: [], total: 100 });
    expect(dataChain.limit).toHaveBeenCalledWith(60);
    expect(dataChain.offset).toHaveBeenCalledWith(0);
  });
});
