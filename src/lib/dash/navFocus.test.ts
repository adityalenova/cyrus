import { describe, expect, it } from "vitest";
import { pickHeading, shouldMoveFocus } from "./navFocus";

describe("shouldMoveFocus", () => {
  it("does not steal focus on first paint", () => {
    expect(shouldMoveFocus(null, "/dashboard/issues")).toBe(false);
  });
  it("does not move when the section is unchanged", () => {
    expect(shouldMoveFocus("/dashboard/issues", "/dashboard/issues")).toBe(false);
  });
  it("moves when the section changes, including back and forward", () => {
    expect(shouldMoveFocus("/dashboard/issues", "/dashboard/repos")).toBe(true);
    expect(shouldMoveFocus("/dashboard/repos", "/dashboard/issues")).toBe(true);
  });
});

describe("pickHeading", () => {
  it("returns null without a root or heading", () => {
    expect(pickHeading(null)).toBeNull();
    expect(pickHeading({ querySelector: () => null } as unknown as ParentNode)).toBeNull();
  });
  it("returns the first h1 under the root", () => {
    const h1 = { tagName: "H1" } as unknown as HTMLElement;
    const root = { querySelector: (s: string) => (s === "h1" ? h1 : null) } as unknown as ParentNode;
    expect(pickHeading(root)).toBe(h1);
  });
});
