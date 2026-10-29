import "server-only";

/**
 * SMS delivery (optional, off by default). From Hyperzen's src/lib/sms.ts.
 * Set SMS_PROVIDER=twilio with the matching credentials in the server's
 * app.env and reset codes can go by text; leave it unset and email is used.
 */

export type SmsResult = { sent: boolean; error?: string };

export function smsConfigured(): boolean {
  if (process.env.SMS_PROVIDER?.toLowerCase() !== "twilio") return false;
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER,
  );
}

export async function sendSms(to: string, body: string): Promise<SmsResult> {
  if (!smsConfigured()) return { sent: false, error: "No SMS provider is configured." };
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_FROM_NUMBER!;
  try {
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    });
    if (!response.ok) {
      console.error(`[sms] gateway rejected the message: ${(await response.text()).slice(0, 200)}`);
      return { sent: false, error: "The SMS gateway rejected the message." };
    }
    return { sent: true };
  } catch (error) {
    console.error("[sms] send failed:", error);
    return { sent: false, error: "Could not reach the SMS gateway." };
  }
}

/** "+919876543210" → "••••••••3210" */
export function maskNumber(value: string): string {
  const digits = value.replace(/[^\d+]/g, "");
  if (digits.length < 4) return "•••";
  return `${digits.slice(0, digits.length - 4).replace(/\d/g, "•")}${digits.slice(-4)}`;
}

/** "ada@company.com" → "a••@company.com" */
export function maskEmail(value: string): string {
  const [local = "", domain = ""] = value.split("@");
  if (!domain) return "•••";
  return `${local.slice(0, 1)}${"•".repeat(Math.max(2, local.length - 1))}@${domain}`;
}
