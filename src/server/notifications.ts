import "server-only";

import type { NotificationLevel } from "@prisma/client";
import { can, normaliseCapabilities, type Capability } from "@/lib/rbac";
import type { TenantDb, TenantTx } from "@/server/db/tenant";

/**
 * In-app notifications (Hyperzen's src/lib/notifications.ts): best effort — a
 * failed notification never fails the action that caused it. Each recipient
 * has their own row and read state. The bell polls /api/notifications/poll.
 */

export type NotificationInput = {
  kind: string;
  title: string;
  body?: string | null;
  href?: string | null;
  level?: NotificationLevel;
  entityType?: string | null;
  entityId?: string | null;
};

export async function notifyUsers(
  db: TenantDb | TenantTx,
  organizationId: string,
  userIds: string[],
  input: NotificationInput,
): Promise<void> {
  const recipients = [...new Set(userIds)];
  if (recipients.length === 0) return;
  try {
    await db.notification.createMany({
      data: recipients.map((recipientUserId) => ({
        organizationId,
        recipientUserId,
        kind: input.kind,
        level: input.level ?? "INFO",
        title: input.title.slice(0, 200),
        body: input.body?.slice(0, 1000) ?? null,
        href: input.href ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
      })),
    });
  } catch (error) {
    console.error("[notify] failed:", error);
  }
}

/** Notify every active member whose role holds the capability (Owners always). */
export async function notifyCapability(
  db: TenantDb,
  organizationId: string,
  capability: Capability,
  input: NotificationInput,
  options: { exceptUserId?: string } = {},
): Promise<void> {
  try {
    const members = await db.membership.findMany({
      where: { status: "ACTIVE" },
      select: { userId: true, role: { select: { id: true, key: true, name: true, rank: true, capabilities: true } } },
    });
    const userIds = members
      .filter((member) => member.userId !== options.exceptUserId)
      .filter((member) => can({ ...member.role, capabilities: normaliseCapabilities(member.role.capabilities) }, capability))
      .map((member) => member.userId);
    await notifyUsers(db, organizationId, userIds, input);
  } catch (error) {
    console.error("[notify] failed:", error);
  }
}

const PURGE_INTERVAL_MS = 60 * 60_000;

/**
 * Retention: notifications older than the organization's setting are removed.
 * Runs at most hourly, opportunistically from the bell's poll (as Hyperzen
 * does) and from the daily job. The activity log is not touched.
 */
export async function purgeExpiredNotifications(db: TenantDb, force = false): Promise<number> {
  const settings = await db.organizationSettings.findFirst({
    select: { id: true, notificationRetentionDays: true, lastNotificationPurgeAt: true },
  });
  if (!settings) return 0;
  const now = Date.now();
  if (!force && settings.lastNotificationPurgeAt && now - settings.lastNotificationPurgeAt.getTime() < PURGE_INTERVAL_MS) {
    return 0;
  }
  const cutoff = new Date(now - settings.notificationRetentionDays * 24 * 60 * 60_000);
  const [deleted] = await Promise.all([
    db.notification.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    db.organizationSettings.update({ where: { id: settings.id }, data: { lastNotificationPurgeAt: new Date(now) } }),
  ]);
  return deleted.count;
}
