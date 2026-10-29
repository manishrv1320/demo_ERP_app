"use server";

import { z } from "zod";
import { formatDate } from "@/lib/dates";
import { logActivity } from "@/server/activity";
import { action } from "@/server/auth/action";
import { cancelOrganizationDeletion, scheduleOrganizationDeletion } from "@/server/deletion";
import { UserError } from "@/server/errors";

/** Owner only (tied to the system Owner role, not a grantable capability). */
export const requestOrganizationDeletionAction = action(
  { capability: "owner", schema: z.object({ confirmation: z.string().trim().max(200) }) },
  async (ctx, input) => {
    const organization = await ctx.db.organization.findFirstOrThrow({ select: { legalName: true } });
    if (input.confirmation !== organization.legalName) {
      throw new UserError(`Type the legal name exactly: ${organization.legalName}`, "confirmation");
    }
    const when = await scheduleOrganizationDeletion(ctx);
    await logActivity(ctx, {
      action: "organization.deletion-request",
      entityType: "Organization",
      entityId: ctx.org.id,
      summary: `Deletion requested; scheduled for ${formatDate(when)}`,
    });
    return { ok: true, message: `Scheduled for deletion on ${formatDate(when)}.` };
  },
);

export const cancelOrganizationDeletionAction = action(
  { capability: "owner", schema: z.object({}), allowWhenPendingDeletion: true },
  async (ctx) => {
    if (ctx.org.status !== "PENDING_DELETION") return { ok: true };
    await cancelOrganizationDeletion(ctx);
    await logActivity(ctx, { action: "organization.deletion-cancel", entityType: "Organization", entityId: ctx.org.id, summary: "Deletion cancelled" });
    return { ok: true, message: "Deletion cancelled. Everyone can sign in again." };
  },
);
