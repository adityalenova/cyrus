export type AuditAction =
  | "AUTH_LOGIN"
  | "AUTH_LOGOUT"
  | "ROLE_CHANGE"
  | "CATALOG_UPDATE"
  | "SUBMISSION_APPROVE"
  | "SUBMISSION_REJECT"
  | "API_KEY_REVOKE";

export interface AuditEvent {
  actorId: string;
  ipAddress: string;
  action: AuditAction;
  targetId?: string;
  targetType?: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

export function createAuditEvent(
  actorId: string,
  ipAddress: string,
  action: AuditAction,
  options?: {
    targetId?: string;
    targetType?: string;
    details?: Record<string, unknown>;
  }
): AuditEvent {
  return {
    actorId,
    ipAddress,
    action,
    targetId: options?.targetId,
    targetType: options?.targetType,
    details: options?.details,
    timestamp: new Date().toISOString(),
  };
}

export async function dispatchAuditEvent(event: AuditEvent): Promise<void> {
  console.info(`[AUDIT] ${JSON.stringify(event)}`);
}
