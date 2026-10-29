import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";
import { raw } from "@/server/db/raw";
import { hashToken, newToken } from "@/server/security/tokens";

/**
 * Read-only support view. A platform admin gives a reason and opens one
 * organization for 60 minutes. While the cookie is valid, /app renders that
 * organization with a read-only role under a banner, every page visit is
 * written to SupportAccessLog, and writes are refused twice: by the action
 * wrapper and by the read-only tenant client.
 */
export const SUPPORT_COOKIE = "hzerp_support";
const SUPPORT_MINUTES = 60;

export async function openSupportSession(input: {
  platformAdminId: string;
  organizationId: string;
  reason: string;
}): Promise<void> {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SUPPORT_MINUTES * 60_000);
  await raw.supportSession.create({
    data: {
      tokenHash: hashToken(token),
      platformAdminId: input.platformAdminId,
      targetOrganizationId: input.organizationId,
      reason: input.reason,
      expiresAt,
    },
  });
  const cookieStore = await cookies();
  cookieStore.set(SUPPORT_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export type ActiveSupportSession = {
  id: string;
  organizationId: string;
  adminName: string;
  adminEmail: string;
  expiresAt: Date;
};

export const getSupportSession = cache(async (): Promise<ActiveSupportSession | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SUPPORT_COOKIE)?.value;
  if (!token || token.length > 200) return null;
  const session = await raw.supportSession.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      targetOrganizationId: true,
      expiresAt: true,
      endedAt: true,
      platformAdmin: { select: { name: true, email: true, isActive: true } },
    },
  });
  if (!session || session.endedAt || session.expiresAt < new Date() || !session.platformAdmin.isActive) return null;
  return {
    id: session.id,
    organizationId: session.targetOrganizationId,
    adminName: session.platformAdmin.name,
    adminEmail: session.platformAdmin.email,
    expiresAt: session.expiresAt,
  };
});

export async function endSupportSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SUPPORT_COOKIE)?.value;
  if (token) {
    await raw.supportSession
      .updateMany({ where: { tokenHash: hashToken(token), endedAt: null }, data: { endedAt: new Date() } })
      .catch(() => undefined);
  }
  cookieStore.set(SUPPORT_COOKIE, "", { path: "/", maxAge: 0 });
}

export async function logSupportVisit(session: ActiveSupportSession, path: string): Promise<void> {
  await raw.supportAccessLog.create({
    data: { supportSessionId: session.id, targetOrganizationId: session.organizationId, path: path.slice(0, 500) },
  });
}

/** The organization a support session looks at (the support view has no membership row). */
export async function supportOrganization(organizationId: string) {
  return raw.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      legalName: true,
      tradeName: true,
      stateCode: true,
      status: true,
      accentColor: true,
      accentColor2: true,
      logoFileId: true,
      lockDate: true,
      deletionScheduledFor: true,
      isDemo: true,
    },
  });
}
