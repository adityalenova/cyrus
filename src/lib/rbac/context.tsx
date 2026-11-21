/* ══ context.tsx — Client-Side RBAC React Context ═════════════════════
   Exposes:
   - roles
   - permissions
   - hasRole()
   - hasPermission()
   - convenience permission guards
   - loading, error, and refreshPermissions()
   ═════════════════════════════════════════════════════════════════════ */
"use client";

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from "react";
import { useStore } from "@/lib/store";
import type { SystemRole, SystemPermission } from "@/lib/server/rbac";

export interface UserRoleAssignment {
  role: SystemRole;
  orgId: string | null;
}

export interface RbacContextValue {
  userId: string | null;
  roles: UserRoleAssignment[];
  permissionsByOrg: Record<string, SystemPermission[]>;
  globalPermissions: SystemPermission[];
  loading: boolean;
  hasRole: (role: SystemRole, orgId?: string | null) => boolean;
  hasPermission: (permission: SystemPermission, orgId?: string | null) => boolean;
  canManageUsers: (orgId?: string | null) => boolean;
  canManageOrg: (orgId?: string | null) => boolean;
  canEditProjects: (orgId?: string | null) => boolean;
  canViewAnalytics: (orgId?: string | null) => boolean;
  canModerate: (orgId?: string | null) => boolean;
  refreshPermissions: () => Promise<void>;
}

const defaultRbacValue: RbacContextValue = {
  userId: null,
  roles: [],
  permissionsByOrg: {},
  globalPermissions: [],
  loading: false,
  hasRole: () => false,
  hasPermission: () => false,
  canManageUsers: () => false,
  canManageOrg: () => false,
  canEditProjects: () => false,
  canViewAnalytics: () => false,
  canModerate: () => false,
  refreshPermissions: async () => {},
};

const RbacContext = createContext<RbacContextValue>(defaultRbacValue);

export const useRbac = () => useContext(RbacContext);

export function RbacProvider({ children }: { children: ReactNode }) {
  const { user } = useStore();
  const [userId, setUserId] = useState<string | null>(null);
  const [roles, setRoles] = useState<UserRoleAssignment[]>([]);
  const [permissionsByOrg, setPermissionsByOrg] = useState<Record<string, SystemPermission[]>>({});
  const [globalPermissions, setGlobalPermissions] = useState<SystemPermission[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshPermissions = useCallback(async () => {
    if (!user) {
      setUserId(null);
      setRoles([]);
      setPermissionsByOrg({});
      setGlobalPermissions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/me/permissions", { credentials: "same-origin" });
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated) {
          setUserId(data.userId || null);
          setRoles(data.roles || []);
          setPermissionsByOrg(data.permissionsByOrg || {});
          setGlobalPermissions(data.globalPermissions || []);
        } else {
          setUserId(null);
          setRoles([]);
          setPermissionsByOrg({});
          setGlobalPermissions([]);
        }
      }
    } catch {
      // In offline mode or error, fail safe to least privilege
      setUserId(null);
      setRoles([]);
      setPermissionsByOrg({});
      setGlobalPermissions([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshPermissions();
  }, [refreshPermissions]);

  const isSuperAdmin = useMemo(() => {
    return (
      roles.some((r) => r.role === "super_admin" && (r.orgId === null || r.orgId === undefined)) ||
      globalPermissions.length > 0
    );
  }, [roles, globalPermissions]);

  const hasRole = useCallback(
    (role: SystemRole, orgId?: string | null): boolean => {
      if (!user) return false;
      if (isSuperAdmin) return true;

      if (orgId) {
        return roles.some((r) => r.orgId === orgId && r.role === role);
      }

      return roles.some((r) => r.role === role);
    },
    [user, isSuperAdmin, roles],
  );

  const hasPermission = useCallback(
    (permission: SystemPermission, orgId?: string | null): boolean => {
      if (!user) return false;
      if (isSuperAdmin) return true;

      if (orgId) {
        const orgPerms = permissionsByOrg[orgId];
        return Boolean(orgPerms && orgPerms.includes(permission));
      }

      return globalPermissions.includes(permission);
    },
    [user, isSuperAdmin, permissionsByOrg, globalPermissions],
  );

  const canManageUsers = useCallback((orgId?: string | null) => hasPermission("manage_users", orgId), [hasPermission]);
  const canManageOrg = useCallback((orgId?: string | null) => hasPermission("manage_org", orgId), [hasPermission]);
  const canEditProjects = useCallback((orgId?: string | null) => hasPermission("edit_projects", orgId), [hasPermission]);
  const canViewAnalytics = useCallback((orgId?: string | null) => hasPermission("view_analytics", orgId), [hasPermission]);
  const canModerate = useCallback((orgId?: string | null) => hasPermission("moderate", orgId), [hasPermission]);

  const value = useMemo<RbacContextValue>(
    () => ({
      userId,
      roles,
      permissionsByOrg,
      globalPermissions,
      loading,
      hasRole,
      hasPermission,
      canManageUsers,
      canManageOrg,
      canEditProjects,
      canViewAnalytics,
      canModerate,
      refreshPermissions,
    }),
    [
      userId,
      roles,
      permissionsByOrg,
      globalPermissions,
      loading,
      hasRole,
      hasPermission,
      canManageUsers,
      canManageOrg,
      canEditProjects,
      canViewAnalytics,
      canModerate,
      refreshPermissions,
    ],
  );

  return <RbacContext.Provider value={value}>{children}</RbacContext.Provider>;
}
