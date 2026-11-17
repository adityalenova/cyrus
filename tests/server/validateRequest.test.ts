import { describe, it, expect } from "vitest";
import { z } from "zod";
import { validateRequestBody } from "../../src/lib/server/validateRequest";

const testSchema = z.object({
  title: z.string().min(3),
  count: z.number().positive(),
});

describe("Zod Request Validator", () => {
  it("validates compliant JSON body", async () => {
    const req = new Request("http://localhost/api", {
      method: "POST",
      body: JSON.stringify({ title: "Valid Title", count: 10 }),
    });

    const result = await validateRequestBody(req, testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("Valid Title");
    }
  });

  it("returns 422 with structured issues on schema violation", async () => {
    const req = new Request("http://localhost/api", {
      method: "POST",
      body: JSON.stringify({ title: "ab", count: -1 }),
    });

    const result = await validateRequestBody(req, testSchema);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorResponse.status).toBe(422);
      expect(result.issues.length).toBeGreaterThan(0);
    }
  });
});
