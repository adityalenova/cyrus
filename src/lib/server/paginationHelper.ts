export interface CursorPayload {
  id: string;
  createdAt: number;
}

export function encodeCursor(payload: CursorPayload): string {
  const json = JSON.stringify(payload);
  return Buffer.from(json, "utf-8").toString("base64url");
}

export function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const json = Buffer.from(cursor, "base64url").toString("utf-8");
    const parsed = JSON.parse(json);
    if (typeof parsed.id === "string" && typeof parsed.createdAt === "number") {
      return parsed as CursorPayload;
    }
    return null;
  } catch {
    return null;
  }
}

export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string;
  endCursor?: string;
}

export function buildPageInfo<T extends { id: string; createdAt: number }>(
  items: T[],
  limit: number,
  hasPrevious: boolean
): PageInfo {
  const hasNextPage = items.length > limit;
  const sliced = hasNextPage ? items.slice(0, limit) : items;

  return {
    hasNextPage,
    hasPreviousPage: hasPrevious,
    startCursor: sliced.length > 0 ? encodeCursor(sliced[0]) : undefined,
    endCursor: sliced.length > 0 ? encodeCursor(sliced[sliced.length - 1]) : undefined,
  };
}
