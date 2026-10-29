"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { formatDate } from "@/lib/dates";
import { safeNextPath, type ActionResult } from "@/lib/utils";
import {
  acceptInviteSchema,
  loginSchema,
  resetCompleteSchema,
  resetRequestSchema,
  resetVerifySchema,
  signUpSchema,
  verifyEmailSchema,
} from "@/lib/validation/auth";
import { fieldErrors } from "@/lib/validation/common";
import { checkCode, findResetToken, issueCode, issueResetToken } from "@/server/auth/codes";
import { burnPasswordCheck, hashPassword, verifyPassword } from "@/server/auth/passwords";
import { createSession, destroySession, getSession, revokeSessions } from "@/server/auth/session";
import { globalDb } from "@/server/db/global";
import { acceptInvitation, findInvitation } from "@/server/db/identity";
import { forOrg } from "@/server/db/tenant";
import { createAccountWithOrganization } from "@/server/db/provision";
import { codesDeliverable, emailVerificationRequired, supportEmail } from "@/server/email/platform";
import { notifyUsers } from "@/server/notifications";
import { activePolicies, outstandingPolicies, recordAcceptances } from "@/server/policies";
import { HOUR, MINUTE, rateLimit } from "@/server/security/rate-limit";
import { requestMeta } from "@/server/security/request";
import { hashToken } from "@/server/security/tokens";
import { maskEmail, maskNumber, smsConfigured } from "@/server/sms";

const tooMany = { ok: false as const, message: "Too many attempts. Please wait a while and try again." };
const RESET_COOKIE = "hzerp_reset";

function invalid(error: z.ZodError) {
  return { ok: false as const, message: "Please check the highlighted fields.", errors: fieldErrors(error) };
}

// ---------------------------------------------------------------------------
// Sign up
// ---------------------------------------------------------------------------

export async function signUpAction(input: z.input<typeof signUpSchema>): Promise<ActionResult> {
  const meta = await requestMeta();
  if (!rateLimit(`signup:ip:${meta.ip ?? "unknown"}`, 5, HOUR).success) return tooMany;

  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const data = parsed.data;

  const existing = await globalDb.user.findUnique({ where: { email: data.email }, select: { id: true } });
  if (existing) {
    return {
      ok: false,
      message: "An account with this email already exists. Sign in instead.",
      errors: { email: "Already registered — sign in instead." },
    };
  }

  const policies = await activePolicies();
  const { userId, organizationId } = await createAccountWithOrganization({
    name: data.name,
    email: data.email,
    passwordHash: await hashPassword(data.password),
    legalName: data.organizationName,
    stateCode: data.stateCode,
    acceptances: policies.map((policy) => ({ policyId: policy.id, version: policy.version })),
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  await createSession(userId, organizationId);

  if (await emailVerificationRequired()) {
    await issueCode({ userId, email: data.email, purpose: "VERIFY_EMAIL", channel: "EMAIL", destination: data.email, ip: meta.ip });
    redirect("/verify-email");
  }
  redirect("/app");
}

// ---------------------------------------------------------------------------
// Sign in / out
// ---------------------------------------------------------------------------

/** A pending-deletion account comes back with errors.pendingDeletion so the form can offer to cancel it. */
export type LoginResult = ActionResult;

export async function loginAction(
  input: z.input<typeof loginSchema> & { next?: string; cancelDeletion?: boolean },
): Promise<LoginResult> {
  const meta = await requestMeta();
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { email, password } = parsed.data;

  const limits = [
    rateLimit(`login:ip:${meta.ip ?? "unknown"}`, 30, 15 * MINUTE),
    rateLimit(`login:email:${email}`, 10, 15 * MINUTE),
  ];
  if (limits.some((limit) => !limit.success)) return tooMany;

  const wrong = { ok: false as const, message: "That email and password don't match." };
  const user = await globalDb.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true, status: true, deletionScheduledFor: true },
  });
  if (!user || user.status === "DELETED") {
    await burnPasswordCheck(password);
    return wrong;
  }
  if (!(await verifyPassword(password, user.passwordHash))) return wrong;

  if (user.status === "PENDING_DELETION") {
    if (!input.cancelDeletion) {
      return {
        ok: false,
        message: `This account is scheduled for deletion on ${formatDate(user.deletionScheduledFor)}. Sign in to cancel the deletion?`,
        errors: { pendingDeletion: "yes" },
      };
    }
    await globalDb.user.update({
      where: { id: user.id },
      data: { status: "ACTIVE", deletionRequestedAt: null, deletionScheduledFor: null },
    });
  }

  await globalDb.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(user.id);
  redirect(safeNextPath(input.next));
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

// ---------------------------------------------------------------------------
// Password reset by code (three steps)
// ---------------------------------------------------------------------------

async function findAccount(identifier: string) {
  if (identifier.includes("@")) {
    return globalDb.user.findUnique({
      where: { email: identifier.toLowerCase() },
      select: { id: true, email: true, phone: true, status: true },
    });
  }
  const digits = identifier.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return globalDb.user.findFirst({
    where: { phone: { endsWith: digits.slice(-10) } },
    select: { id: true, email: true, phone: true, status: true },
  });
}

export type ResetRequestResult = ActionResult<{ destination: string; channel: "EMAIL" | "SMS" }>;

/** Step one: send a code. The reply is identical whether or not an account matched. */
export async function requestResetCodeAction(input: z.input<typeof resetRequestSchema>): Promise<ResetRequestResult> {
  const parsed = resetRequestSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { identifier } = parsed.data;
  const meta = await requestMeta();
  const target = identifier.includes("@") ? identifier.toLowerCase() : identifier.replace(/\D/g, "");
  const limits = [
    rateLimit(`reset:ip:${meta.ip ?? "unknown"}`, 10, HOUR),
    rateLimit(`reset:hour:${target}`, 5, HOUR),
    rateLimit(`reset:day:${target}`, 10, 24 * HOUR),
  ];
  if (limits.some((limit) => !limit.success)) return tooMany;

  if (!(await codesDeliverable())) {
    const contact = await supportEmail();
    return {
      ok: false,
      message: contact
        ? `Password reset by code isn't available yet. Please write to ${contact}.`
        : "Password reset by code isn't available yet. Please contact Hyperzen support.",
    };
  }

  const byEmail = identifier.includes("@");
  const generic: ResetRequestResult = {
    ok: true,
    message: "If that matches an account, a six-digit code is on its way.",
    data: { destination: byEmail ? maskEmail(identifier) : maskNumber(identifier), channel: byEmail ? "EMAIL" : "SMS" },
  };

  const user = await findAccount(identifier);
  if (!user || user.status !== "ACTIVE") return generic;

  const useSms = (!byEmail || parsed.data.channel === "SMS") && Boolean(user.phone) && smsConfigured();
  await issueCode({
    userId: user.id,
    email: user.email,
    purpose: "RESET",
    channel: useSms ? "SMS" : "EMAIL",
    destination: useSms ? user.phone! : user.email,
    ip: meta.ip,
  });
  return generic;
}

/** Step two: check the code; on success a short-lived cookie allows step three. */
export async function verifyResetCodeAction(input: z.input<typeof resetVerifySchema>): Promise<ActionResult> {
  const parsed = resetVerifySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const meta = await requestMeta();
  if (!rateLimit(`reset-verify:ip:${meta.ip ?? "unknown"}`, 20, 15 * MINUTE).success) return tooMany;

  const failed = { ok: false as const, message: "That code isn't correct or has expired." };
  const user = await findAccount(parsed.data.identifier);
  if (!user || user.status !== "ACTIVE") return failed;

  const check = await checkCode(user.id, "RESET", parsed.data.code);
  if (!check.ok) return failed;

  const token = await issueResetToken(check.codeId);
  (await cookies()).set(RESET_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 15 * 60,
  });
  return { ok: true };
}

/** Step three: the new password. Every session is signed out. */
export async function completeResetAction(input: z.input<typeof resetCompleteSchema>): Promise<ActionResult> {
  const parsed = resetCompleteSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const cookieStore = await cookies();
  const token = cookieStore.get(RESET_COOKIE)?.value;
  const row = token ? await findResetToken(token) : null;
  if (!row) return { ok: false, message: "This reset has expired. Please ask for a new code." };

  await globalDb.user.update({
    where: { id: row.userId },
    data: { passwordHash: await hashPassword(parsed.data.password), passwordChangedAt: new Date() },
  });
  await revokeSessions(row.userId);
  await globalDb.verificationCode.deleteMany({ where: { userId: row.userId, purpose: "RESET" } });
  cookieStore.delete(RESET_COOKIE);
  return { ok: true, message: "Password changed. Sign in with your new password." };
}

// ---------------------------------------------------------------------------
// Email verification
// ---------------------------------------------------------------------------

export async function sendVerificationCodeAction(): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Please sign in again." };
  if (session.user.emailVerifiedAt) return { ok: true, message: "Your email is already verified." };
  if (!rateLimit(`verify-send:${session.user.id}`, 5, HOUR).success) return tooMany;
  const meta = await requestMeta();
  await issueCode({
    userId: session.user.id,
    email: session.user.email,
    purpose: "VERIFY_EMAIL",
    channel: "EMAIL",
    destination: session.user.email,
    ip: meta.ip,
  });
  return { ok: true, message: `A new code is on its way to ${maskEmail(session.user.email)}.` };
}

export async function verifyEmailAction(input: z.input<typeof verifyEmailSchema>): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Please sign in again." };
  const parsed = verifyEmailSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (!rateLimit(`verify-check:${session.user.id}`, 20, 15 * MINUTE).success) return tooMany;

  const check = await checkCode(session.user.id, "VERIFY_EMAIL", parsed.data.code);
  if (!check.ok) return { ok: false, message: "That code isn't correct or has expired.", errors: { code: "Check the code." } };
  await globalDb.verificationCode.update({ where: { id: check.codeId }, data: { consumedAt: new Date() } });
  await globalDb.user.update({ where: { id: session.user.id }, data: { emailVerifiedAt: new Date() } });
  redirect("/app");
}

// ---------------------------------------------------------------------------
// Policies
// ---------------------------------------------------------------------------

export async function acceptPoliciesAction(input: { next?: string }): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Please sign in again." };
  await recordAcceptances(session.user.id, await outstandingPolicies(session.user.id), await requestMeta());
  redirect(safeNextPath(input.next));
}

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

async function usableInvitation(token: string) {
  const invitation = await findInvitation(hashToken(token));
  if (!invitation || invitation.acceptedAt || invitation.revokedAt || invitation.expiresAt < new Date()) return null;
  if (invitation.organization.status !== "ACTIVE") return null;
  return invitation;
}

export async function acceptInviteAction(input: z.input<typeof acceptInviteSchema>): Promise<ActionResult> {
  const parsed = acceptInviteSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const meta = await requestMeta();
  if (!rateLimit(`invite:ip:${meta.ip ?? "unknown"}`, 20, HOUR).success) return tooMany;

  const invitation = await usableInvitation(parsed.data.token);
  if (!invitation) return { ok: false, message: "This invitation has expired or was already used. Ask for a new one." };

  const session = await getSession();
  let userId: string;
  let userName: string;

  if (session) {
    if (session.user.email !== invitation.email) {
      return { ok: false, message: `This invitation is for ${invitation.email}. Sign out and sign in with that address.` };
    }
    userId = session.user.id;
    userName = session.user.name;
  } else {
    const existing = await globalDb.user.findUnique({ where: { email: invitation.email }, select: { id: true } });
    if (existing) return { ok: false, message: "You already have an account — sign in to accept." };

    const name = parsed.data.name?.trim() ?? "";
    const password = parsed.data.password ?? "";
    const errors: Record<string, string> = {};
    if (!name) errors.name = "Your name is required.";
    if (password.length < 10) errors.password = "Use at least 10 characters.";
    if (!parsed.data.acceptPolicies) errors.acceptPolicies = "Please accept the Terms and Privacy Policy.";
    if (Object.keys(errors).length > 0) return { ok: false, message: "Please check the highlighted fields.", errors };

    // Opening the emailed link proves the address, so it counts as verified.
    const user = await globalDb.user.create({
      data: {
        email: invitation.email,
        name: name.slice(0, 120),
        passwordHash: await hashPassword(password),
        emailVerifiedAt: new Date(),
      },
      select: { id: true },
    });
    await recordAcceptances(user.id, await activePolicies(), meta);
    userId = user.id;
    userName = name;
  }

  await acceptInvitation({
    invitationId: invitation.id,
    organizationId: invitation.organizationId,
    userId,
    roleId: invitation.role.id,
  });

  const db = forOrg(invitation.organizationId);
  await db.activityLog.create({
    data: {
      organizationId: invitation.organizationId,
      actorUserId: userId,
      actorName: userName,
      action: "member.joined",
      entityType: "Membership",
      summary: `${invitation.email} joined as ${invitation.role.name}`,
      ip: meta.ip,
    },
  });
  await notifyUsers(db, invitation.organizationId, [invitation.invitedById], {
    kind: "member.joined",
    level: "SUCCESS",
    title: `${userName} accepted your invitation`,
    body: `They joined as ${invitation.role.name}.`,
    href: "/app/settings/members",
  });

  if (session) {
    await globalDb.session.update({ where: { id: session.id }, data: { activeOrganizationId: invitation.organizationId } });
  } else {
    await createSession(userId, invitation.organizationId);
  }
  redirect("/app");
}
