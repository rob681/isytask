/**
 * Audit Logger
 *
 * Writes immutable records to the audit_logs table for security-sensitive actions.
 * All writes are fire-and-forget (non-blocking) to avoid affecting request latency.
 *
 * Usage:
 *   await audit(db, {
 *     agencyId: ctx.session.user.agencyId,
 *     userId: ctx.session.user.id,
 *     action: "USER_PASSWORD_CHANGED",
 *     entityType: "User",
 *     entityId: userId,
 *   });
 */

import type { PrismaClient } from "@isytask/db";
import { randomUUID } from "crypto";

export type AuditAction =
  // Auth
  | "USER_LOGIN"
  | "USER_LOGIN_FAILED"
  | "USER_LOGOUT"
  | "USER_ACCOUNT_LOCKED"
  | "PASSWORD_RESET_REQUESTED"
  | "PASSWORD_RESET_COMPLETED"
  | "PASSWORD_CHANGED"
  | "MFA_ENABLED"
  | "MFA_DISABLED"
  // Users
  | "USER_CREATED"
  | "USER_UPDATED"
  | "USER_DEACTIVATED"
  | "USER_REACTIVATED"
  | "USER_INVITED"
  | "USER_DELETED"
  // Tasks
  | "TASK_CREATED"
  | "TASK_STATUS_CHANGED"
  | "TASK_ASSIGNED"
  | "TASK_DELETED"
  // Services
  | "SERVICE_CREATED"
  | "SERVICE_UPDATED"
  | "SERVICE_DELETED"
  // Config
  | "CONFIG_UPDATED"
  | "BILLING_SUBSCRIPTION_CHANGED"
  // GDPR
  | "DATA_EXPORT_REQUESTED"
  | "ACCOUNT_DELETION_REQUESTED";

export interface AuditParams {
  agencyId?: string | null;
  userId?: string | null;   // null = system action
  action: AuditAction | string;
  entityType?: string;
  entityId?: string;
  oldValue?: object;
  newValue?: object;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Write an audit log entry. Non-blocking — errors are swallowed to avoid
 * disrupting the main request, but logged to console.
 */
export function audit(db: PrismaClient, params: AuditParams): void {
  db.auditLog
    .create({
      data: {
        id: randomUUID(),
        agencyId: params.agencyId ?? null,
        userId: params.userId ?? null,
        action: params.action,
        entityType: params.entityType ?? null,
        entityId: params.entityId ?? null,
        oldValue: params.oldValue ? (params.oldValue as any) : undefined,
        newValue: params.newValue ? (params.newValue as any) : undefined,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
      },
    })
    .catch((err) => {
      console.error("[Audit] Failed to write audit log:", err);
    });
}
