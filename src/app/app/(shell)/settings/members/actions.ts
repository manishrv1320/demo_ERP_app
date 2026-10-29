"use server";

import { z } from "zod";
import { addDays } from "@/lib/dates";
import { outranks, OWNER_KEY } from "@/lib/rbac";
import { inviteSchema } from "@/lib/validation/organization";
import { logActivity } from "@/server/activity";
import { action } from "@/server/auth/action";
import type { AppContext } from "@/server/auth/context";
import type { TenantTx } from "@/server/db/tenant";
import { emailLayout } from "@/server/email/transport";
import { sendPlatformEmail } from "@/server/email/platform";
import { UserError } from "@/server/errors";
import { notifyUsers } from "@/server/notifications";
import { HOUR, rateLimit } from "@/server/security/rate-limit";
import { hashToken, newToken } from "@/server/security/tokens";

const INVITE_DAYS = 7;
const idSchema = z.object({ id: z.string().min(1).max(40) });

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
}

/** A role the actor may hand out: below their own rank (Owners may hand out anything). */
async function assignableRole(ctx: AppContext, tx: TenantTx, roleId: string) {
  const role = await tx.role.findUnique({ where: { id: roleId }, select: { id: true, key: true, name: true, rank: true } });
  if (!role) throw new UserError("Choose a role.", "roleId");
  if (!outranks(ctx.role, role.rank)) throw new UserError("You can only give roles below your own.", "roleId");
  return role;
}

async function sendInvitation(ctx: AppContext, email: string, roleName: string, token: string) {
  const link = `${siteUrl()}/invite/${token}`;
  const message = emailLayout(
    `Join ${ctx.org.name} on Hyperzen ERP`,
    [
      `${ctx.user.name} invited you to ${ctx.org.name} as ${roleName}.`,
      `The link works for ${INVITE_DAYS} days. If you weren't expecting it, you can ignore this email.`,
    ],
    { label: "Accept the invitation", href: link },
  );
  const sent = await sendPlatformEmail({ to: email, subject: `${ctx.user.name} invited you to ${ctx.org.name}`, ...message });
  return { link, sent: sent.sent };
}

export const inviteMemberAction = action(
  { capability: "users.manage", schema: inviteSchema },
  async (ctx, input): Promise<{ ok: true; message: string; data: { link: string; emailed: boolean } }> => {
    if (!rateLimit(`invite:${ctx.org.id}`, 30, 24 * HOUR).success) {
      throw new UserError("You've sent a lot of invitations today. Please try again tomorrow.");
    }
    const token = newToken();
    const role = await ctx.db.$transaction(async (tx) => {
      const role = await assignableRole(ctx, tx, input.roleId);
      const member = await tx.membership.findFirst({ where: { status: "ACTIVE", user: { email: input.email } } });
      if (member) throw new UserError("That person is already a member.", "email");
      // One live invitation per address: a new one replaces the old.
      await tx.invitation.updateMany({
        where: { email: input.email, acceptedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.invitation.create({
        data: {
          organizationId: ctx.org.id,
          email: input.email,
          roleId: role.id,
          tokenHash: hashToken(token),
          invitedById: ctx.user.id,
          invitedByName: ctx.user.name,
          expiresAt: addDays(new Date(), INVITE_DAYS),
        },
      });
      await logActivity(ctx, { action: "member.invite", entityType: "Invitation", summary: `Invited ${input.email} as ${role.name}` }, tx);
      return role;
    });
    const { link, sent } = await sendInvitation(ctx, input.email, role.name, token);
    return {
      ok: true,
      message: sent ? `Invitation sent to ${input.email}.` : "Invitation created. Email isn't set up, so share the link yourself.",
      data: { link, emailed: sent },
    };
  },
);

export const revokeInvitationAction = action({ capability: "users.manage", schema: idSchema }, async (ctx, input) => {
  const invitation = await ctx.db.invitation.findUnique({ where: { id: input.id }, include: { role: true } });
  if (!invitation || invitation.acceptedAt || invitation.revokedAt) return { ok: true };
  if (!outranks(ctx.role, invitation.role.rank)) throw new UserError("You can only cancel invitations for roles below your own.");
  await ctx.db.invitation.update({ where: { id: invitation.id }, data: { revokedAt: new Date() } });
  await logActivity(ctx, { action: "member.invite-revoke", entityType: "Invitation", entityId: invitation.id, summary: `Cancelled the invitation for ${invitation.email}` });
  return { ok: true, message: "Invitation cancelled." };
});

async function ownerCount(tx: TenantTx): Promise<number> {
  return tx.membership.count({ where: { status: "ACTIVE", role: { key: OWNER_KEY } } });
}

export const changeMemberRoleAction = action(
  { capability: "users.manage", schema: z.object({ membershipId: z.string().min(1).max(40), roleId: z.string().min(1).max(40) }) },
  async (ctx, input) => {
    const changed = await ctx.db.$transaction(async (tx) => {
      const membership = await tx.membership.findUnique({
        where: { id: input.membershipId },
        include: { role: true, user: { select: { id: true, name: true } } },
      });
      if (!membership || membership.status !== "ACTIVE") throw new UserError("That member no longer exists.");
      if (membership.userId === ctx.user.id) throw new UserError("You can't change your own role.");
      if (!outranks(ctx.role, membership.role.rank)) throw new UserError("You can only change members whose role is below yours.");
      const role = await assignableRole(ctx, tx, input.roleId);
      if (membership.role.key === OWNER_KEY && role.key !== OWNER_KEY && (await ownerCount(tx)) <= 1) {
        throw new UserError("The last Owner can't be changed. Make someone else an Owner first.");
      }
      await tx.membership.update({ where: { id: membership.id }, data: { roleId: role.id } });
      await logActivity(ctx, { action: "member.role", entityType: "Membership", entityId: membership.id, summary: `${membership.user.name}: ${membership.role.name} → ${role.name}` }, tx);
      return { userId: membership.user.id, userName: membership.user.name, roleName: role.name };
    });
    // Best effort, outside the transaction: a failed notification never undoes the change.
    await notifyUsers(ctx.db, ctx.org.id, [changed.userId], {
      kind: "member.role",
      title: `Your role in ${ctx.org.name} is now ${changed.roleName}`,
      body: `Changed by ${ctx.user.name}.`,
    });
    return { ok: true, message: `${changed.userName} is now ${changed.roleName}.` };
  },
);

export const removeMemberAction = action(
  { capability: "users.manage", schema: z.object({ membershipId: z.string().min(1).max(40) }) },
  async (ctx, input) => {
    await ctx.db.$transaction(async (tx) => {
      const membership = await tx.membership.findUnique({
        where: { id: input.membershipId },
        include: { role: true, user: { select: { name: true, email: true } } },
      });
      if (!membership || membership.status !== "ACTIVE") return;
      if (membership.userId === ctx.user.id) throw new UserError("You can't remove yourself.");
      if (!outranks(ctx.role, membership.role.rank)) throw new UserError("You can only remove members whose role is below yours.");
      if (membership.role.key === OWNER_KEY && (await ownerCount(tx)) <= 1) throw new UserError("The last Owner can't be removed.");
      await tx.membership.update({ where: { id: membership.id }, data: { status: "REMOVED", removedAt: new Date() } });
      await logActivity(ctx, { action: "member.remove", entityType: "Membership", entityId: membership.id, summary: `Removed ${membership.user.name} (${membership.user.email})` }, tx);
    });
    return { ok: true, message: "Member removed. Their past work stays in the books." };
  },
);
