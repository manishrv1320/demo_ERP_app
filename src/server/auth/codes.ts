import "server-only";

import type { CodeChannel, CodePurpose } from "@prisma/client";
import { globalDb } from "@/server/db/global";
import { emailLayout } from "@/server/email/transport";
import { isDevelopment, sendPlatformEmail } from "@/server/email/platform";
import { sendSms } from "@/server/sms";
import { hashToken, newSixDigitCode, newToken, sameHash } from "@/server/security/tokens";

/**
 * Six-digit codes for password reset and email verification (Hyperzen's
 * reset-actions.ts): only the hash is stored, a code lives ten minutes, five
 * wrong guesses cancel it, and asking again replaces the previous one.
 */
export const CODE_TTL_MINUTES = 10;
export const RESET_TTL_MINUTES = 15;
export const MAX_CODE_ATTEMPTS = 5;

export async function issueCode(input: {
  userId: string;
  email: string;
  purpose: CodePurpose;
  channel: CodeChannel;
  destination: string;
  ip: string | null;
}): Promise<{ delivered: boolean }> {
  const code = newSixDigitCode();
  await globalDb.verificationCode.deleteMany({
    where: { userId: input.userId, purpose: input.purpose, consumedAt: null },
  });
  await globalDb.verificationCode.create({
    data: {
      userId: input.userId,
      purpose: input.purpose,
      channel: input.channel,
      destination: input.destination,
      codeHash: hashToken(code),
      expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60_000),
      ip: input.ip,
    },
  });

  if (isDevelopment()) {
    console.info(
      `\n  ┌─ ${input.purpose === "RESET" ? "password reset" : "email verification"} code ─────────────\n` +
        `  │  ${input.email}\n  │  code: ${code}   (expires in ${CODE_TTL_MINUTES} min)\n` +
        "  │  development only — never printed in production\n  └──────────────────────────────────────────\n",
    );
  }

  const what = input.purpose === "RESET" ? "reset your password" : "verify your email address";
  if (input.channel === "SMS") {
    const result = await sendSms(
      input.destination,
      `${code} is your Hyperzen ERP code to ${what}. It expires in ${CODE_TTL_MINUTES} minutes.`,
    );
    if (result.sent) return { delivered: true };
  }
  const message = emailLayout(`Your code: ${code}`, [
    `Use this code to ${what} in Hyperzen ERP. It expires in ${CODE_TTL_MINUTES} minutes.`,
    "If you didn't ask for it, you can ignore this email — nothing changes without the code.",
  ]);
  const sent = await sendPlatformEmail({
    to: input.email,
    subject: `Your Hyperzen ERP code: ${code}`,
    ...message,
  });
  return { delivered: sent.sent };
}

export type CodeCheck = { ok: true; codeId: string } | { ok: false };

/** Check a code; a wrong guess counts against the code's five attempts. */
export async function checkCode(userId: string, purpose: CodePurpose, code: string): Promise<CodeCheck> {
  const row = await globalDb.verificationCode.findFirst({
    where: { userId, purpose, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!row || row.attempts >= MAX_CODE_ATTEMPTS) return { ok: false };
  if (!sameHash(row.codeHash, hashToken(code))) {
    await globalDb.verificationCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    return { ok: false };
  }
  return { ok: true, codeId: row.id };
}

/** After a correct reset code: a short-lived token that allows choosing a new password. */
export async function issueResetToken(codeId: string): Promise<string> {
  const token = newToken();
  await globalDb.verificationCode.update({
    where: { id: codeId },
    data: {
      consumedAt: new Date(),
      resetTokenHash: hashToken(token),
      resetExpiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60_000),
    },
  });
  return token;
}

export async function findResetToken(token: string) {
  const row = await globalDb.verificationCode.findUnique({
    where: { resetTokenHash: hashToken(token) },
    select: { id: true, userId: true, resetExpiresAt: true, purpose: true },
  });
  if (!row || row.purpose !== "RESET" || !row.resetExpiresAt || row.resetExpiresAt < new Date()) return null;
  return row;
}
