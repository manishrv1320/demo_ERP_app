import "server-only";

import type { AppContext } from "@/server/auth/context";
import type { TenantTx } from "@/server/db/tenant";
import { requestMeta } from "@/server/security/request";

/**
 * The audit trail: who changed what, when. Written in the same transaction as
 * the change where there is one. Entries for accounting records are never
 * purged — the Companies (Accounts) Rules require an audit trail that can't be
 * switched off.
 */
export async function logActivity(
  ctx: AppContext,
  entry: { action: string; entityType: string; entityId?: string | null; summary: string },
  tx?: TenantTx,
): Promise<void> {
  const meta = await requestMeta();
  await (tx ?? ctx.db).activityLog.create({
    data: {
      organizationId: ctx.org.id,
      actorUserId: ctx.user.id,
      actorName: ctx.user.name,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      summary: entry.summary.slice(0, 500),
      ip: meta.ip,
    },
  });
}

/** "name: Main → Central; code: MAIN → CEN" — the fields that actually changed. (Hyperzen's describeChanges.) */
export function describeChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  labels: Record<string, string>,
): string {
  const parts: string[] = [];
  for (const [key, label] of Object.entries(labels)) {
    const from = before[key] ?? "";
    const to = after[key] ?? "";
    if (String(from) !== String(to)) {
      parts.push(`${label}: ${String(from) || "—"} → ${String(to) || "—"}`);
    }
  }
  return parts.join("; ");
}
