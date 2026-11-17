export type Role = "ADMIN" | "MAINTAINER" | "CONTRIBUTOR" | "VIEWER";

export type Permission =
  | "catalog:read"
  | "catalog:write"
  | "submissions:review"
  | "submissions:create"
  | "issues:manage"
  | "users:manage"
  | "settings:admin";

const ROLE_PERMISSIONS: Record<Role, Set<Permission>> = {
  ADMIN: new Set([
    "catalog:read",
    "catalog:write",
    "submissions:review",
    "submissions:create",
    "issues:manage",
    "users:manage",
    "settings:admin",
  ]),
  MAINTAINER: new Set([
    "catalog:read",
    "catalog:write",
    "submissions:review",
    "submissions:create",
    "issues:manage",
  ]),
  CONTRIBUTOR: new Set([
    "catalog:read",
    "submissions:create",
  ]),
  VIEWER: new Set([
    "catalog:read",
  ]),
};

export function hasPermission(role: Role, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  return permissions ? permissions.has(permission) : false;
}

export class ForbiddenError extends Error {
  constructor(public readonly permission: Permission, public readonly role: Role) {
    super(`Role "${role}" does not have required permission "${permission}"`);
    this.name = "ForbiddenError";
  }
}

export function assertPermission(role: Role, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new ForbiddenError(permission, role);
  }
}
