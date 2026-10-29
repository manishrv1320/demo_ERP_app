import "server-only";

import { globalDb } from "@/server/db/global";
import { decryptText } from "@/server/security/encryption";
import { sendWithSmtp, type EmailMessage, type SendResult, type SmtpConfig } from "./transport";

/** The system mail settings from the platform console, or null when mail is off. */
export async function platformSmtp(): Promise<SmtpConfig | null> {
  const settings = await globalDb.platformSettings.findUnique({ where: { id: "platform" } });
  if (!settings?.smtpEnabled || !settings.smtpHost || !settings.smtpPort || !settings.smtpFromEmail) return null;
  return {
    host: settings.smtpHost,
    port: settings.smtpPort,
    secure: settings.smtpSecure,
    user: settings.smtpUser,
    password: settings.smtpPasswordEnc ? decryptText(settings.smtpPasswordEnc) : null,
    fromName: settings.smtpFromName ?? "Hyperzen ERP",
    fromEmail: settings.smtpFromEmail,
  };
}

export async function supportEmail(): Promise<string | null> {
  const settings = await globalDb.platformSettings.findUnique({
    where: { id: "platform" },
    select: { supportEmail: true },
  });
  return settings?.supportEmail ?? null;
}

export const isDevelopment = () => process.env.NODE_ENV !== "production";

/**
 * Email verification at sign-up (decision D5) applies once codes can actually
 * reach people: always in development (codes print to the terminal), and in
 * production once platform SMTP is set up.
 */
export async function emailVerificationRequired(): Promise<boolean> {
  if (isDevelopment()) return true;
  return (await platformSmtp()) !== null;
}

/** Can a one-time code be delivered at all? */
export async function codesDeliverable(): Promise<boolean> {
  return isDevelopment() || (await platformSmtp()) !== null;
}

export async function sendPlatformEmail(message: EmailMessage): Promise<SendResult> {
  const config = await platformSmtp();
  if (!config) {
    if (isDevelopment()) {
      console.info(`[email] (development, no SMTP) to ${message.to}: ${message.subject}\n${message.text}\n`);
      return { sent: true };
    }
    return { sent: false, error: "Email isn't set up yet." };
  }
  return sendWithSmtp(config, message);
}
