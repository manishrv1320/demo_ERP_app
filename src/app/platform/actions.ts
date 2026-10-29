"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/lib/utils";
import { emailField, optionalEmail, optionalText } from "@/lib/validation/common";
import { smtpSchema } from "@/lib/validation/organization";
import { burnPasswordCheck, verifyPassword } from "@/server/auth/passwords";
import {
  findPlatformAdminByEmail,
  platformAction,
  platformSettingsRow,
  savePlatformSettings,
  setOrganizationSuspended,
  touchPlatformAdmin,
  updatePolicy,
} from "@/server/platform/console";
import { auditPlatform, createPlatformSession, destroyPlatformSession } from "@/server/platform/session";
import { openSupportSession } from "@/server/platform/support";
import { encryptText } from "@/server/security/encryption";
import { MINUTE, rateLimit } from "@/server/security/rate-limit";
import { requestMeta } from "@/server/security/request";

export async function platformLoginAction(input: { email: string; password: string }): Promise<ActionResult> {
  const parsed = z.object({ email: emailField, password: z.string().min(1).max(200) }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Enter your email and password." };
  const meta = await requestMeta();
  const limits = [
    rateLimit(`platform-login:ip:${meta.ip ?? "unknown"}`, 10, 15 * MINUTE),
    rateLimit(`platform-login:email:${parsed.data.email}`, 5, 15 * MINUTE),
  ];
  if (limits.some((limit) => !limit.success)) return { ok: false, message: "Too many attempts. Please wait a while." };

  const admin = await findPlatformAdminByEmail(parsed.data.email);
  if (!admin || !admin.isActive) {
    await burnPasswordCheck(parsed.data.password);
    return { ok: false, message: "That email and password don't match." };
  }
  if (!(await verifyPassword(parsed.data.password, admin.passwordHash))) {
    await auditPlatform(admin.id, "login-failed", null);
    return { ok: false, message: "That email and password don't match." };
  }
  await createPlatformSession(admin.id);
  await touchPlatformAdmin(admin.id);
  await auditPlatform(admin.id, "login", null);
  redirect("/platform");
}

export async function platformLogoutAction(): Promise<void> {
  await destroyPlatformSession();
  redirect("/platform/login");
}

const reasonSchema = z.object({
  organizationId: z.string().min(1).max(40),
  reason: z.string().trim().min(5, "Give a reason (at least 5 characters).").max(300),
});

export const suspendOrganizationAction = platformAction(reasonSchema, async (admin, input) => {
  await setOrganizationSuspended(input.organizationId, true, input.reason);
  await auditPlatform(admin.id, "suspend", input.organizationId, { reason: input.reason });
  return { ok: true, message: "Organization suspended. Its members can't open it until it's reactivated." };
});

export const reactivateOrganizationAction = platformAction(reasonSchema, async (admin, input) => {
  await setOrganizationSuspended(input.organizationId, false, null);
  await auditPlatform(admin.id, "reactivate", input.organizationId, { reason: input.reason });
  return { ok: true, message: "Organization reactivated." };
});

/** Read-only support view: logged when opened, and every page visit is logged too. */
export const openSupportViewAction = platformAction(reasonSchema, async (admin, input) => {
  await openSupportSession({ platformAdminId: admin.id, organizationId: input.organizationId, reason: input.reason });
  await auditPlatform(admin.id, "support-open", input.organizationId, { reason: input.reason });
  redirect("/app");
});

export const savePolicyAction = platformAction(
  z.object({
    id: z.string().min(1).max(40),
    title: z.string().trim().min(3).max(120),
    content: z.string().trim().min(50, "The policy text looks too short.").max(60_000),
    publishNewVersion: z.boolean(),
  }),
  async (admin, input) => {
    const result = await updatePolicy(input.id, input);
    await auditPlatform(admin.id, "policy-edit", null, { policyId: input.id, version: result.version, newVersion: input.publishNewVersion });
    return {
      ok: true,
      message: input.publishNewVersion
        ? `Published version ${result.version}. Every user will be asked to accept it.`
        : "Saved as a correction to the current version.",
    };
  },
);

export const savePlatformEmailAction = platformAction(
  smtpSchema.and(z.object({ supportEmail: optionalEmail, smtpFromName: optionalText(120) })),
  async (admin, input) => {
    const current = await platformSettingsRow();
    await savePlatformSettings({
      smtpEnabled: input.smtpEnabled,
      smtpHost: input.smtpHost,
      smtpPort: input.smtpPort ?? null,
      smtpSecure: input.smtpSecure,
      smtpUser: input.smtpUser,
      // Typed into the form by the person who owns it; stored encrypted, never shown again.
      smtpPasswordEnc: input.smtpPassword ? encryptText(input.smtpPassword) : current.smtpPasswordEnc,
      smtpFromName: input.smtpFromName,
      smtpFromEmail: input.smtpFromEmail,
      supportEmail: input.supportEmail,
    });
    await auditPlatform(admin.id, "email-settings", null, { enabled: input.smtpEnabled, host: input.smtpHost, passwordChanged: Boolean(input.smtpPassword) });
    return { ok: true, message: "Saved." };
  },
);
