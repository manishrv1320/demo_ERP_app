import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { raw } from "@/server/db/raw";
import { requestMeta } from "@/server/security/request";
import { hashToken, newToken } from "@/server/security/tokens";

/**
 * Hyperzen staff sign in to /platform with separate accounts (created only by
 * `npm run platform:create-admin`), a separate session table and a cookie
 * scoped to /platform. A tenant session can never satisfy this check — it's a
 * different table.
 */
export const PLATFORM_COOKIE = "hzerp_platform";
const PLATFORM_HOURS = 12;

export async function createPlatformSession(platformAdminId: string): Promise<void> {
  const token = newToken();
  const expiresAt = new Date(Date.now() + PLATFORM_HOURS * 60 * 60 * 1000);
  const meta = await requestMeta();
  await raw.platformSession.create({
    data: { tokenHash: hashToken(token), platformAdminId, ip: meta.ip, userAgent: meta.userAgent, expiresAt },
  });
  const cookieStore = await cookies();
  cookieStore.set(PLATFORM_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/platform",
    expires: expiresAt,
  });
}

export async function destroyPlatformSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(PLATFORM_COOKIE)?.value;
  if (token) await raw.platformSession.deleteMany({ where: { tokenHash: hashToken(token) } }).catch(() => undefined);
  cookieStore.set(PLATFORM_COOKIE, "", { path: "/platform", maxAge: 0 });
}

export type PlatformAdminSession = { id: string; email: string; name: string };

export const getPlatformAdmin = cache(async (): Promise<PlatformAdminSession | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(PLATFORM_COOKIE)?.value;
  if (!token || token.length > 200) return null;
  const session = await raw.platformSession.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { expiresAt: true, platformAdmin: { select: { id: true, email: true, name: true, isActive: true } } },
  });
  if (!session || session.expiresAt < new Date() || !session.platformAdmin.isActive) return null;
  const { isActive: _isActive, ...admin } = session.platformAdmin;
  return admin;
});

export async function requirePlatformAdmin(): Promise<PlatformAdminSession> {
  const admin = await getPlatformAdmin();
  if (!admin) redirect("/platform/login");
  return admin;
}

export async function auditPlatform(
  platformAdminId: string | null,
  action: string,
  targetOrganizationId: string | null,
  detail?: Record<string, unknown>,
): Promise<void> {
  const meta = await requestMeta();
  await raw.platformAuditLog.create({
    data: {
      platformAdminId,
      action,
      targetOrganizationId,
      detail: detail ? (detail as object) : undefined,
      ip: meta.ip,
    },
  });
}
