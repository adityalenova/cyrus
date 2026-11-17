import { describe, it, expect } from "vitest";
import { encodeCursor, decodeCursor, buildPageInfo } from "../../src/lib/server/paginationHelper";

describe("Pagination Helper", () => {
  it("encodes and decodes cursors symmetrically", () => {
    const payload = { id: "item-55", createdAt: 1700000000 };
    const cursor = encodeCursor(payload);
    const decoded = decodeCursor(cursor);

    expect(decoded).toEqual(payload);
  });

  it("builds correct PageInfo for page slices", () => {
    const items = [
      { id: "1", createdAt: 100 },
      { id: "2", createdAt: 200 },
      { id: "3", createdAt: 300 },
    ];
    const pageInfo = buildPageInfo(items, 2, false);

    expect(pageInfo.hasNextPage).toBe(true);
    expect(pageInfo.hasPreviousPage).toBe(false);
    expect(pageInfo.startCursor).toBeDefined();
  });
});
