import "server-only";

import nodemailer from "nodemailer";

/**
 * SMTP delivery (optional, off by default). Two levels use it:
 *   • platform SMTP (Platform console → Email) for sign-up, reset and invite mail;
 *   • an organization's own SMTP (Settings → Email) for sending its documents.
 * Passwords are stored encrypted and decrypted only just before sending.
 */
export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string | null;
  password: string | null;
  fromName: string | null;
  fromEmail: string;
};

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
};

export type SendResult = { sent: true } | { sent: false; error: string };

export async function sendWithSmtp(config: SmtpConfig, message: EmailMessage): Promise<SendResult> {
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user ? { user: config.user, pass: config.password ?? "" } : undefined,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });
  try {
    await transporter.sendMail({
      from: config.fromName ? { name: config.fromName, address: config.fromEmail } : config.fromEmail,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      replyTo: message.replyTo,
      attachments: message.attachments,
    });
    return { sent: true };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`[email] send failed: ${detail}`);
    return { sent: false, error: "The mail server refused the message. Check the SMTP settings." };
  } finally {
    transporter.close();
  }
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** A plain, readable email layout that works in every client. */
export function emailLayout(
  title: string,
  paragraphs: string[],
  action?: { label: string; href: string },
): { html: string; text: string } {
  const body = paragraphs
    .map((text) => `<p style="margin:0 0 14px;line-height:1.6">${escapeHtml(text)}</p>`)
    .join("");
  const button = action
    ? `<p style="margin:22px 0"><a href="${escapeHtml(action.href)}" style="display:inline-block;background:#5b8cff;color:#fff;text-decoration:none;padding:11px 18px;border-radius:8px;font-weight:600">${escapeHtml(action.label)}</a></p>` +
      `<p style="margin:0 0 14px;font-size:12px;color:#666">Or open: ${escapeHtml(action.href)}</p>`
    : "";
  const html =
    `<!doctype html><html><body style="margin:0;background:#f4f4f6;font-family:Inter,Segoe UI,Arial,sans-serif;color:#16161c">` +
    `<div style="max-width:520px;margin:0 auto;padding:28px 16px"><div style="background:#fff;border-radius:12px;padding:26px;border:1px solid #e5e5ea">` +
    `<h1 style="margin:0 0 16px;font-size:19px">${escapeHtml(title)}</h1>${body}${button}</div>` +
    `<p style="font-size:12px;color:#888;text-align:center;margin-top:16px">Hyperzen ERP</p></div></body></html>`;
  const text = [title, "", ...paragraphs, ...(action ? ["", `${action.label}: ${action.href}`] : [])].join("\n");
  return { html, text };
}
