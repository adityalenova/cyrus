import { beforeEach, describe, expect, it, vi } from "vitest";

const currentPublicUser = vi.hoisted(() => vi.fn());
/* the route reads one thing: whoever this session cookie belongs to, from the
   users row when a database exists and from the signed claims when it does
   not. Both answers are already public, so nothing is stripped here. */
vi.mock("@/lib/server/auth", () => ({ currentPublicUser }));

import { GET } from "./route";

beforeEach(() => currentPublicUser.mockReset());

describe("GET /api/me", () => {
  it("answers 200 with a null user when signed out", async () => {
    currentPublicUser.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: null });
  });

  it("returns the signed-in user exactly as the session layer describes them", async () => {
    currentPublicUser.mockResolvedValue({ id: "google:123", name: "Sam", login: null, email: "sam@example.com", picture: null, provider: "google" });
    expect(await (await GET()).json()).toEqual({
      user: { id: "google:123", name: "Sam", login: null, email: "sam@example.com", picture: null, provider: "google" },
    });
  });
});
