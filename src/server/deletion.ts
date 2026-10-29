import "server-only";

import { addDays } from "@/lib/dates";
import type { AppContext } from "@/server/auth/context";
import { notifyUsers } from "@/server/notifications";

/**
 * Account and organization deletion (Google Play requires both). Each needs
 * typed confirmation, offers a data export first, and waits a 30-day grace
 * period (decision D4) during which it can be cancelled. The daily job
 * (scripts/jobs.ts) finishes deletions whose grace period has passed.
 */
export const DELETION_GRACE_DAYS = 30;

export function deletionDate(from = new Date()): Date {
  return addDays(from, DELETION_GRACE_DAYS);
}

export async function scheduleOrganizationDeletion(ctx: AppContext): Promise<Date> {
  const scheduledFor = deletionDate();
  await ctx.db.organization.update({
    where: { id: ctx.org.id },
    data: {
      status: "PENDING_DELETION",
      deletionRequestedAt: new Date(),
      deletionRequestedById: ctx.user.id,
      deletionScheduledFor: scheduledFor,
    },
  });
  const members = await ctx.db.membership.findMany({ where: { status: "ACTIVE" }, select: { userId: true } });
  await notifyUsers(
    ctx.db,
    ctx.org.id,
    members.map((member) => member.userId).filter((id) => id !== ctx.user.id),
    {
      kind: "organization.deletion",
      level: "WARNING",
      title: `${ctx.org.name} is scheduled for deletion`,
      body: `${ctx.user.name} asked for it to be deleted on ${scheduledFor.toDateString()}. Until then only an Owner can open it.`,
    },
  );
  return scheduledFor;
}

export async function cancelOrganizationDeletion(ctx: AppContext): Promise<void> {
  await ctx.db.organization.update({
    where: { id: ctx.org.id },
    data: { status: "ACTIVE", deletionRequestedAt: null, deletionRequestedById: null, deletionScheduledFor: null },
  });
}
