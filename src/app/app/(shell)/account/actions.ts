"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { formatDate } from "@/lib/dates";
import { changePasswordSchema, profileSchema } from "@/lib/validation/auth";
import { userAction } from "@/server/auth/action";
import { hashPassword, verifyPassword } from "@/server/auth/passwords";
import { createSession, destroySession, revokeSessions } from "@/server/auth/session";
import { deletionDate } from "@/server/deletion";
import { globalDb } from "@/server/db/global";
import { soleOwnerships } from "@/server/db/identity";
import { forOrg } from "@/server/db/tenant";
import { UserError } from "@/server/errors";
import { MINUTE, rateLimit } from "@/server/security/rate-limit";

export const updateProfileAction = userAction(profileSchema, async (session, input) => {
  await globalDb.user.update({ where: { id: session.user.id }, data: input });
  return { ok: true, message: "Profile saved." };
});

/** A new password signs out every device; this one gets a fresh session. */
export const changePasswordAction = userAction(changePasswordSchema, async (session, input) => {
  if (!rateLimit(`password-change:${session.user.id}`, 5, 15 * MINUTE).success) {
    throw new UserError("Too many attempts. Please wait a while.");
  }
  const user = await globalDb.user.findUniqueOrThrow({ where: { id: session.user.id }, select: { passwordHash: true } });
  if (!(await verifyPassword(input.current, user.passwordHash))) {
    return { ok: false, message: "Your current password isn't right.", errors: { current: "Not right." } };
  }
  await globalDb.user.update({
    where: { id: session.user.id },
    data: { passwordHash: await hashPassword(input.password), passwordChangedAt: new Date() },
  });
  await revokeSessions(session.user.id);
  await createSession(session.user.id, session.activeOrganizationId);
  return { ok: true, message: "Password changed. Every other device has been signed out." };
});

export const revokeSessionAction = userAction(z.object({ id: z.string().min(1).max(40) }), async (session, input) => {
  if (input.id === session.id) throw new UserError("Use Sign out for this device.");
  await globalDb.session.deleteMany({ where: { id: input.id, userId: session.user.id } });
  return { ok: true, message: "Signed out of that device." };
});

export const signOutOtherDevicesAction = userAction(z.object({}), async (session) => {
  await revokeSessions(session.user.id, session.id);
  return { ok: true, message: "Signed out of every other device." };
});

/**
 * Delete my account (Google Play requirement): typed confirmation, then a
 * 30-day grace period during which signing in cancels it. An Owner who is the
 * only Owner of an organization with other members must hand it over first;
 * an organization where they're the only member is deleted with them.
 */
export const requestAccountDeletionAction = userAction(
  z.object({ confirmation: z.string().trim().max(20) }),
  async (session, input) => {
    if (input.confirmation !== "DELETE") throw new UserError("Type DELETE to confirm.");
    const owned = await soleOwnerships(session.user.id);
    const blocking = owned.filter((org) => org.othersRemain);
    if (blocking.length > 0) {
      throw new UserError(
        `You're the only Owner of ${blocking.map((org) => org.name).join(", ")}. Make another member an Owner, or delete the organization, first.`,
      );
    }
    const when = deletionDate();
    for (const org of owned) {
      await forOrg(org.organizationId).organization.update({
        where: { id: org.organizationId },
        data: {
          status: "PENDING_DELETION",
          deletionRequestedAt: new Date(),
          deletionRequestedById: session.user.id,
          deletionScheduledFor: when,
        },
      });
    }
    await globalDb.user.update({
      where: { id: session.user.id },
      data: { status: "PENDING_DELETION", deletionRequestedAt: new Date(), deletionScheduledFor: when },
    });
    await revokeSessions(session.user.id);
    await destroySession();
    redirect(`/login?deleted=${encodeURIComponent(formatDate(when))}`);
  },
);
