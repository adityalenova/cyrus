import { describe, it, expect } from "vitest";
import { escapeHtml, sanitizeText, sanitizeUrl } from "../../src/lib/server/sanitizeInput";

describe("Input Sanitizer", () => {
  it("escapes HTML control characters", () => {
    expect(escapeHtml("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert(&#x27;xss&#x27;)&lt;&#x2F;script&gt;"
    );
  });

  it("strips ASCII control characters", () => {
    expect(sanitizeText("clean\x00text\x08here")).toBe("cleantexthere");
  });

  it("permits only http and https URLs", () => {
    expect(sanitizeUrl("https://example.com")).toBe("https://example.com/");
    expect(sanitizeUrl("javascript:alert(1)")).toBe("");
  });
});
