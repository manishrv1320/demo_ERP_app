import "server-only";

import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { deleteOrganizationFolder } from "@/server/files/storage";
import { TENANT_MODELS } from "./models";
import { raw } from "./raw";

/**
 * Finishing deletions once the 30-day grace period has passed (run by
 * scripts/jobs.ts). Organizations are removed completely; user accounts are
 * anonymised, because the business records they created belong to their
 * organizations and stay there as "Deleted user".
 */

/** Tenant models ordered so every row is deleted before the rows it points at. */
export function deletionOrder(): string[] {
  const dependsOn = new Map<string, Set<string>>();
  for (const model of Prisma.dmmf.datamodel.models) {
    if (!TENANT_MODELS.has(model.name)) continue;
    const targets = new Set<string>();
    for (const field of model.fields) {
      if (field.kind === "object" && field.relationFromFields?.length && TENANT_MODELS.has(field.type) && field.type !== model.name) {
        targets.add(field.type);
      }
    }
    dependsOn.set(model.name, targets);
  }
  // A model can go once nothing still waiting points at it.
  const order: string[] = [];
  const remaining = new Set(dependsOn.keys());
  while (remaining.size > 0) {
    const ready = [...remaining].filter((name) => ![...remaining].some((other) => other !== name && dependsOn.get(other)!.has(name)));
    if (ready.length === 0) throw new Error(`Circular tenant references: ${[...remaining].join(", ")}`);
    for (const name of ready.sort()) {
      order.push(name);
      remaining.delete(name);
    }
  }
  return order;
}

type Deletable = { deleteMany(args: unknown): Promise<{ count: number }> };

export async function purgeOrganization(organizationId: string): Promise<void> {
  await raw.$transaction(
    async (tx) => {
      for (const model of deletionOrder()) {
        const delegate = (tx as unknown as Record<string, Deletable>)[model[0]!.toLowerCase() + model.slice(1)]!;
        await delegate.deleteMany({ where: { organizationId } });
      }
      await tx.organization.delete({ where: { id: organizationId } });
    },
    { timeout: 120_000 },
  );
  await deleteOrganizationFolder(organizationId);
}

export async function organizationsDueForDeletion(now = new Date()) {
  return raw.organization.findMany({
    where: { status: "PENDING_DELETION", deletionScheduledFor: { lte: now } },
    select: { id: true, legalName: true },
  });
}

export async function anonymiseUser(userId: string): Promise<void> {
  await raw.$transaction(async (tx) => {
    await tx.session.deleteMany({ where: { userId } });
    await tx.verificationCode.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({ where: { recipientUserId: userId } });
    await tx.membership.updateMany({ where: { userId, status: "ACTIVE" }, data: { status: "REMOVED", removedAt: new Date() } });
    await tx.activityLog.updateMany({ where: { actorUserId: userId }, data: { actorName: "Deleted user" } });
    await tx.revision.updateMany({ where: { authorUserId: userId }, data: { authorName: "Deleted user" } });
    await tx.invitation.updateMany({ where: { invitedById: userId }, data: { invitedByName: "Deleted user" } });
    await tx.user.update({
      where: { id: userId },
      data: {
        email: `deleted-${userId}@deleted.invalid`,
        name: "Deleted user",
        phone: null,
        // An unguessable hash nobody knows the password for.
        passwordHash: `deleted:${randomBytes(32).toString("hex")}`,
        emailVerifiedAt: null,
        status: "DELETED",
        deletionScheduledFor: null,
      },
    });
  });
}

export async function usersDueForDeletion(now = new Date()) {
  return raw.user.findMany({
    where: { status: "PENDING_DELETION", deletionScheduledFor: { lte: now } },
    select: { id: true },
  });
}

/** Housekeeping: expired sessions and codes, and every organization's notification retention. */
export async function purgeExpired(now = new Date()) {
  const [sessions, platformSessions, codes] = await Promise.all([
    raw.session.deleteMany({ where: { expiresAt: { lt: now } } }),
    raw.platformSession.deleteMany({ where: { expiresAt: { lt: now } } }),
    raw.verificationCode.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 24 * 60 * 60_000) } } }),
  ]);
  const settings = await raw.organizationSettings.findMany({ select: { organizationId: true, notificationRetentionDays: true } });
  let notifications = 0;
  for (const row of settings) {
    const cutoff = new Date(now.getTime() - row.notificationRetentionDays * 24 * 60 * 60_000);
    notifications += (await raw.notification.deleteMany({ where: { organizationId: row.organizationId, createdAt: { lt: cutoff } } })).count;
  }
  return { sessions: sessions.count + platformSessions.count, codes: codes.count, notifications };
}
