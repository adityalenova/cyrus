import { describe, it, expect } from "vitest";
import {
  createProblemDetails,
  toProblemResponse,
  ProblemFactory,
} from "../../src/lib/server/problemDetails";

describe("RFC 7807 Problem Details", () => {
  it("creates a standardized problem details object", () => {
    const problem = createProblemDetails(404, "Not Found", {
      detail: "Item 123 does not exist.",
      typeSlug: "not-found",
    });

    expect(problem.status).toBe(404);
    expect(problem.title).toBe("Not Found");
    expect(problem.detail).toBe("Item 123 does not exist.");
    expect(problem.type).toBe("https://cyrus.ai/errors/not-found");
  });

  it("converts problem details to a valid Response", async () => {
    const problem = ProblemFactory.badRequest("Invalid input", [
      { name: "email", reason: "Invalid format" },
    ]);
    const response = toProblemResponse(problem);

    expect(response.status).toBe(400);
    expect(response.headers.get("Content-Type")).toBe("application/problem+json; charset=utf-8");
    const json = await response.json();
    expect(json.invalidParams).toHaveLength(1);
    expect(json.invalidParams[0].name).toBe("email");
  });

  it("creates factory errors for standard HTTP statuses", () => {
    expect(ProblemFactory.unauthorized().status).toBe(401);
    expect(ProblemFactory.forbidden().status).toBe(403);
    expect(ProblemFactory.conflict().status).toBe(409);
    expect(ProblemFactory.unprocessableEntity("Failed").status).toBe(422);
    expect(ProblemFactory.tooManyRequests("Rate limited", 60).status).toBe(429);
    expect(ProblemFactory.internalServerError().status).toBe(500);
  });
});
