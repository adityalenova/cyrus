/* ══ queries.test.ts — the API validation guards ═══════════════ */
import { describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
  update: vi.fn(),
}));

vi.mock("../db", () => ({
  getDb: () => dbMock,
}));

import {
  queryRepos, renameSaved, smallJson, validAppKind, validAppStatus, validEmail,
  validId, validItemType, validSubmissionKind,
} from "./queries";

describe("saved-item guards", () => {
  it("accepts the item types the site has pages for, searches included", () => {
    for (const t of ["repo", "org", "program", "issue", "search"]) expect(validItemType(t)).toBe(true);
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

/* db.update(savedItems).set({ title }).where(pred).returning() */
describe("renameSaved", () => {
  const row = { itemId: "sq-1", itemType: "search", title: "Rust, good first" };
  const wire = (rows: unknown[]) => {
    const returning = vi.fn().mockResolvedValue(rows);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    dbMock.update.mockReturnValue({ set });
    return { set, where, returning };
  };

  /* the condition is a tree of Param nodes; digging out their values is the
     only way to prove the user id really landed in the SQL predicate */
  const paramValues = (node: unknown, out: unknown[] = []): unknown[] => {
    if (!node || typeof node !== "object") return out;
    const n = node as { value?: unknown; queryChunks?: unknown[] };
    if ("value" in n) out.push(n.value);
    for (const c of n.queryChunks ?? []) paramValues(c, out);
    return out;
  };

  it("updates the title only, with the session's user in the predicate", async () => {
    const { set, where, returning } = wire([row]);
    expect(await renameSaved("u1", "search", "sq-1", "Rust, good first")).toEqual(row);
    expect(set).toHaveBeenCalledWith({ title: "Rust, good first" });
    expect(paramValues(where.mock.calls[0][0])).toEqual(expect.arrayContaining(["u1", "search", "sq-1"]));
    expect(returning).toHaveBeenCalled();
  });

  it("returns null when nothing matched, so another account's row is simply not renamed", async () => {
    const { where } = wire([]);
    expect(await renameSaved("u1", "search", "sq-other", "Taken over")).toBeNull();
    /* the search id alone is never enough: without u1 in the WHERE clause
       this UPDATE would rename whichever row happens to carry that id */
    expect(paramValues(where.mock.calls[0][0])).toContain("u1");
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
