import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";

const mockUser = { current: null as any };
vi.mock("@/lib/store", () => ({
  useStore: () => ({ user: mockUser.current }),
}));

import { RbacProvider, useRbac } from "../../src/lib/rbac/context";

function ConsumerComponent({ onValue }: { onValue: (val: ReturnType<typeof useRbac>) => void }) {
  const value = useRbac();
  onValue(value);
  return React.createElement("div", { "data-testid": "consumer" }, "Rendered");
}

describe("RBAC React Context", () => {
  beforeEach(() => {
    mockUser.current = null;
    vi.restoreAllMocks();
  });

  it("provides safe defaults when unauthenticated", () => {
    let captured: ReturnType<typeof useRbac> | undefined;

    renderToString(
      React.createElement(
        RbacProvider,
        null,
        React.createElement(ConsumerComponent, {
          onValue: (val) => {
            captured = val;
          },
        }),
      ),
    );

    expect(captured).toBeDefined();
    expect(captured!.roles).toEqual([]);
    expect(captured!.loading).toBe(false);
    expect(captured!.hasRole("org_admin", "org-alpha")).toBe(false);
    expect(captured!.hasRole("super_admin")).toBe(false);
    expect(captured!.hasPermission("manage_users", "org-alpha")).toBe(false);
    expect(captured!.canManageUsers("org-alpha")).toBe(false);
    expect(captured!.canManageOrg("org-alpha")).toBe(false);
    expect(captured!.canEditProjects("org-alpha")).toBe(false);
    expect(captured!.canViewAnalytics("org-alpha")).toBe(false);
    expect(captured!.canModerate("org-alpha")).toBe(false);
  });

  it("evaluates organization scoped guards with least privilege", () => {
    mockUser.current = { name: "Alice", provider: "email" };

    let captured: ReturnType<typeof useRbac> | undefined;
    renderToString(
      React.createElement(
        RbacProvider,
        null,
        React.createElement(ConsumerComponent, {
          onValue: (val) => {
            captured = val;
          },
        }),
      ),
    );

    // Initial state before fetch resolution
    expect(captured).toBeDefined();
    expect(captured!.hasRole("org_admin", "org-alpha")).toBe(false);
    expect(captured!.canManageUsers("org-alpha")).toBe(false);
  });
});
