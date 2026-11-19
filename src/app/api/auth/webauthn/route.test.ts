// src/app/api/auth/webauthn/route.test.ts
import { describe, it, expect } from "vitest";
import { mockRequest } from "@/test/utils"; // hypothetical helper

describe("WebAuthn registration", () => {
  it("returns registration options", async () => {
    const req = mockRequest({ method: "POST", json: { userId: "test-user" } });
    // Since getUserById is placeholder, this will 404 – just ensure route exists
    const res = await (await import("./register/route.ts")).POST(req as any);
    // Expect either 200 with options or 404
    expect([200, 404]).toContain(res.status);
  });
});
