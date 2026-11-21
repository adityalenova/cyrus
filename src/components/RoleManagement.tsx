/* ══ RoleManagement.tsx — Admin-Facing Role & Member Management ═══════════
   - Displays organization members and assigned roles
   - Allows assigning, changing, and revoking roles
   - Invitation dispatch and pending invitation revocation
   - Audit trail viewing for permission operations
   - Strictly enforces privilege checks and organization boundaries
   - Adheres to cyrus.ai warm coffee design system (no emoji, SVG icons)
   ═════════════════════════════════════════════════════════════════════ */
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRbac } from "@/lib/rbac/context";
import { useStore } from "@/lib/store";
import { btn } from "@/components/ui";
import type { SystemRole } from "@/lib/server/rbac";

const SW = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const Ic = ({ d, size = 16, className }: { d: string; size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
    <path d={d} {...SW} />
  </svg>
);

const IC_SHIELD = "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z";
const IC_USER_PLUS = "M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M8.5 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM20 8v6M23 11h-6";
const IC_TRASH = "M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2";
const IC_CLOCK = "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2";
const IC_CHECK = "M20 6L9 17l-5-5";
const IC_ALERT = "M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z";

interface Member {
  id: string;
  userId: string;
  role: SystemRole;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string | null;
    login: string | null;
    picture: string | null;
  };
}

interface Invitation {
  id: string;
  orgId: string;
  email: string;
  role: SystemRole;
  expiresAt: string;
  createdAt: string;
}

interface AuditLog {
  id: string;
  actorId: string | null;
  targetUserId: string | null;
  previousRole: string | null;
  newRole: string | null;
  action: string;
  createdAt: string;
}

const ROLE_LABELS: Record<SystemRole, string> = {
  super_admin: "Super Admin",
  org_admin: "Org Admin",
  maintainer: "Maintainer",
  contributor: "Contributor",
  viewer: "Viewer",
};

const ROLE_BADGES: Record<SystemRole, string> = {
  super_admin: "bg-ember/15 text-ember border-ember/30",
  org_admin: "bg-honey/15 text-honey border-honey/30",
  maintainer: "bg-leaf/15 text-leaf border-leaf/30",
  contributor: "bg-denim/15 text-denim border-denim/30",
  viewer: "bg-steam/20 text-dim border-line",
};

export default function RoleManagement({ orgLogin }: { orgLogin: string }) {
  const { user } = useStore();
  const { userId, canManageUsers, canManageOrg, hasRole, refreshPermissions } = useRbac();

  const [tab, setTab] = useState<"members" | "invites" | "audit">("members");
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Invitation Form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<SystemRole>("contributor");
  const [inviting, setInviting] = useState(false);

  const isSuper = hasRole("super_admin");
  const isOrgAdmin = hasRole("org_admin", orgLogin) || isSuper;
  const isAuthorized = canManageUsers(orgLogin) || canManageOrg(orgLogin) || isSuper;

  const loadData = useCallback(async () => {
    if (!isAuthorized) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const [membersRes, invitesRes, auditRes] = await Promise.all([
        fetch(`/api/organizations/${encodeURIComponent(orgLogin)}/members`, { credentials: "same-origin" }),
        fetch(`/api/organizations/${encodeURIComponent(orgLogin)}/invitations`, { credentials: "same-origin" }),
        fetch(`/api/organizations/${encodeURIComponent(orgLogin)}/audit-logs`, { credentials: "same-origin" }),
      ]);

      if (membersRes.ok) {
        const data = await membersRes.json();
        setMembers(data.members || []);
      }
      if (invitesRes.ok) {
        const data = await invitesRes.json();
        setInvitations(data.invitations || []);
      }
      if (auditRes.ok) {
        const data = await auditRes.json();
        setAuditLogs(data.logs || []);
      }
    } catch {
      setErrorMsg("Failed to load organization role data.");
    } finally {
      setLoading(false);
    }
  }, [isAuthorized, orgLogin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAssignRole = async (targetUserId: string, newRole: SystemRole) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(orgLogin)}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ targetUserId, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Failed to update role");
        return;
      }
      setSuccessMsg(`Role updated to ${ROLE_LABELS[newRole]} successfully.`);
      await loadData();
      await refreshPermissions();
    } catch {
      setErrorMsg("Error executing role update.");
    }
  };

  const handleRevokeRole = async (targetUserId: string) => {
    if (!confirm("Are you sure you want to revoke this user's role from the organization?")) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(orgLogin)}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ targetUserId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Failed to revoke role");
        return;
      }
      setSuccessMsg("Member role revoked successfully.");
      await loadData();
      await refreshPermissions();
    } catch {
      setErrorMsg("Error revoking role.");
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(orgLogin)}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Failed to create invitation");
        return;
      }
      setSuccessMsg(`Invitation sent to ${inviteEmail} with role ${ROLE_LABELS[inviteRole]}.`);
      setInviteEmail("");
      await loadData();
    } catch {
      setErrorMsg("Error sending invitation.");
    } finally {
      setInviting(false);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(orgLogin)}/invitations/${inviteId}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Failed to revoke invitation");
        return;
      }
      setSuccessMsg("Invitation cancelled.");
      await loadData();
    } catch {
      setErrorMsg("Error revoking invitation.");
    }
  };

  if (!user) {
    return (
      <div className="bg-paper border border-line rounded-[18px] p-6 text-center">
        <Ic d={IC_SHIELD} size={28} className="mx-auto text-dim mb-2" />
        <h3 className="card-title text-[16px] mb-1">Access Restricted</h3>
        <p className="card-desc text-[13px] text-dim">
          Please sign in to view and manage roles for {orgLogin}.
        </p>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="bg-paper border border-line rounded-[18px] p-6 text-center">
        <Ic d={IC_SHIELD} size={28} className="mx-auto text-dim mb-2" />
        <h3 className="card-title text-[16px] mb-1">Role Management Restricted</h3>
        <p className="card-desc text-[13px] text-dim">
          You need organization administrator privileges to manage members and roles in {orgLogin}.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-paper border border-line rounded-[18px] overflow-hidden shadow-subtle">
      {/* Header bar */}
      <div className="px-6 py-5 border-b border-line flex flex-wrap items-center justify-between gap-4 bg-cream/40">
        <div>
          <div className="flex items-center gap-2">
            <Ic d={IC_SHIELD} size={18} className="text-honey" />
            <h3 className="font-display text-[18px] font-bold tracking-[-.02em] text-ink">
              Team & Role Management
            </h3>
          </div>
          <p className="text-[12.5px] text-dim mt-0.5">
            Manage organization members, assign roles, dispatch invitations, and inspect audit records.
          </p>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center gap-1.5 p-1 bg-paper border border-line rounded-xl">
          <button
            type="button"
            onClick={() => setTab("members")}
            className={`px-3 py-1.5 text-[12px] font-medium rounded-lg transition-colors ${
              tab === "members" ? "bg-coffee text-foam" : "text-dim hover:text-ink"
            }`}
          >
            Members ({members.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("invites")}
            className={`px-3 py-1.5 text-[12px] font-medium rounded-lg transition-colors ${
              tab === "invites" ? "bg-coffee text-foam" : "text-dim hover:text-ink"
            }`}
          >
            Invites ({invitations.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("audit")}
            className={`px-3 py-1.5 text-[12px] font-medium rounded-lg transition-colors ${
              tab === "audit" ? "bg-coffee text-foam" : "text-dim hover:text-ink"
            }`}
          >
            Audit Logs
          </button>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="mx-6 mt-4 p-3 bg-brick/10 border border-brick/30 rounded-xl flex items-center gap-2.5 text-brick text-[13px]">
          <Ic d={IC_ALERT} size={16} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="mx-6 mt-4 p-3 bg-leaf/10 border border-leaf/30 rounded-xl flex items-center gap-2.5 text-leaf text-[13px]">
          <Ic d={IC_CHECK} size={16} className="shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Tab 1: Members */}
      {tab === "members" && (
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <span className="font-mono text-[11px] uppercase tracking-[.1em] text-dim">
              Current Members ({members.length})
            </span>
          </div>

          {loading ? (
            <div className="py-8 text-center text-dim text-[13px]">Loading organization members…</div>
          ) : members.length === 0 ? (
            <div className="py-8 text-center text-dim text-[13px]">
              No role assignments recorded yet for this organization.
            </div>
          ) : (
            <div className="divide-y divide-line border border-line rounded-xl overflow-hidden bg-cream/20">
              {members.map((m) => {
                const isSelf = (Boolean(userId) && userId === m.userId) || (Boolean(user?.email) && user?.email === m.user.email);
                return (
                  <div key={m.id} className="p-4 flex flex-wrap items-center justify-between gap-4 hover:bg-cream/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-steam/30 border border-line overflow-hidden grid place-items-center font-display font-bold text-[14px] text-ink">
                        {m.user.picture ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.user.picture} alt={m.user.name} className="w-full h-full object-cover" />
                        ) : (
                          m.user.name.slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[13.5px] text-ink">{m.user.name}</span>
                          {isSelf && (
                            <span className="px-1.5 py-0.5 text-[10px] font-mono uppercase bg-steam/40 rounded text-dim">
                              You
                            </span>
                          )}
                        </div>
                        <span className="text-[12px] text-dim block">{m.user.email || m.user.login || "Member"}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-1 text-[11.5px] font-medium border rounded-full ${ROLE_BADGES[m.role]}`}>
                        {ROLE_LABELS[m.role]}
                      </span>

                      {/* Role selection dropdown (disabled for self to prevent self-escalation) */}
                      {isOrgAdmin && !isSelf && (
                        <select
                          value={m.role}
                          onChange={(e) => handleAssignRole(m.userId, e.target.value as SystemRole)}
                          className="px-2 py-1 text-[12px] border border-line rounded-lg bg-paper text-ink cursor-pointer focus:outline-none focus:border-honey"
                        >
                          <option value="org_admin">Org Admin</option>
                          <option value="maintainer">Maintainer</option>
                          <option value="contributor">Contributor</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      )}

                      {/* Revoke button */}
                      {isOrgAdmin && !isSelf && (
                        <button
                          type="button"
                          onClick={() => handleRevokeRole(m.userId)}
                          title="Revoke member role"
                          className="p-1.5 text-dim hover:text-brick hover:bg-brick/10 rounded-lg transition-colors"
                        >
                          <Ic d={IC_TRASH} size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Invitations */}
      {tab === "invites" && (
        <div className="p-6">
          {/* Invite Form */}
          <form onSubmit={handleSendInvite} className="mb-6 p-4 border border-line rounded-xl bg-cream/30">
            <h4 className="font-display text-[14px] font-bold text-ink mb-2 flex items-center gap-2">
              <Ic d={IC_USER_PLUS} size={15} className="text-honey" />
              Invite New Member
            </h4>
            <div className="flex flex-wrap gap-3 items-center">
              <input
                type="email"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                className="flex-1 min-w-[220px] px-3 py-2 text-[13px] border border-line rounded-lg bg-paper text-ink placeholder:text-dim/60 focus:outline-none focus:border-honey"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as SystemRole)}
                className="px-3 py-2 text-[13px] border border-line rounded-lg bg-paper text-ink cursor-pointer focus:outline-none focus:border-honey"
              >
                <option value="org_admin">Org Admin</option>
                <option value="maintainer">Maintainer</option>
                <option value="contributor">Contributor</option>
                <option value="viewer">Viewer</option>
              </select>
              <button
                type="submit"
                disabled={inviting}
                className={btn("primary", "sm")}
              >
                {inviting ? "Sending…" : "Send Invite"}
              </button>
            </div>
          </form>

          {/* Pending Invitations list */}
          <span className="font-mono text-[11px] uppercase tracking-[.1em] text-dim block mb-3">
            Pending Invitations ({invitations.length})
          </span>

          {invitations.length === 0 ? (
            <div className="py-6 text-center text-dim text-[13px]">No pending invitations.</div>
          ) : (
            <div className="divide-y divide-line border border-line rounded-xl overflow-hidden bg-cream/20">
              {invitations.map((inv) => (
                <div key={inv.id} className="p-4 flex flex-wrap items-center justify-between gap-4 hover:bg-cream/50 transition-colors">
                  <div>
                    <span className="font-semibold text-[13.5px] text-ink block">{inv.email}</span>
                    <span className="text-[11.5px] text-dim flex items-center gap-1 mt-0.5">
                      <Ic d={IC_CLOCK} size={12} />
                      Expires: {new Date(inv.expiresAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 text-[11.5px] font-medium border rounded-full ${ROLE_BADGES[inv.role]}`}>
                      {ROLE_LABELS[inv.role]}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRevokeInvite(inv.id)}
                      className="text-[12px] text-brick hover:underline"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Audit Logs */}
      {tab === "audit" && (
        <div className="p-6">
          <span className="font-mono text-[11px] uppercase tracking-[.1em] text-dim block mb-3">
            Permission Change Audit Trail ({auditLogs.length})
          </span>

          {auditLogs.length === 0 ? (
            <div className="py-6 text-center text-dim text-[13px]">No audit logs recorded for this organization.</div>
          ) : (
            <div className="divide-y divide-line border border-line rounded-xl overflow-hidden bg-cream/20 max-h-[360px] overflow-y-auto">
              {auditLogs.map((log) => (
                <div key={log.id} className="p-3 text-[12.5px] flex items-center justify-between gap-4 hover:bg-cream/50">
                  <div>
                    <div className="font-mono text-[11px] text-honey font-semibold">{log.action}</div>
                    <div className="text-dim text-[12px] mt-0.5">
                      {log.previousRole ? `Role changed from ${log.previousRole} › ${log.newRole}` : `Assigned ${log.newRole}`}
                    </div>
                  </div>
                  <span className="font-mono text-[11px] text-dim shrink-0">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
