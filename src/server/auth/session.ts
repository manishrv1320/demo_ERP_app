import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";
import { globalDb } from "@/server/db/global";
import { requestMeta } from "@/server/security/request";
import { hashToken, newToken } from "@/server/security/tokens";

/**
 * Sessions are rows in the database; the cookie holds a random token and only
 * its SHA-256 hash is stored. Same model as Hyperzen's src/lib/auth.ts, with
 * 30-day sessions that carry the active organization.
 */
export const SESSION_COOKIE = "hzerp_session";
const SESSION_DAYS = 30;
/** lastSeenAt is refreshed at most this often, to keep page loads write-free. */
const TOUCH_INTERVAL_MS = 10 * 60_000;

export async function createSession(userId: string, activeOrganizationId: string | null = null): Promise<void> {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const meta = await requestMeta();

  await globalDb.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      activeOrganizationId,
      isApp: meta.isApp,
      ip: meta.ip,
      userAgent: meta.userAgent,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await globalDb.session.deleteMany({ where: { tokenHash: hashToken(token) } }).catch(() => undefined);
  }
  cookieStore.delete(SESSION_COOKIE);
}

export type CurrentSession = {
  id: string;
  activeOrganizationId: string | null;
  isApp: boolean;
  user: {
    id: string;
    email: string;
    name: string;
    phone: string | null;
    emailVerifiedAt: Date | null;
    status: "ACTIVE" | "PENDING_DELETION" | "DELETED";
  };
};

/** The signed-in user's session for this request, memoised so the tree hits the database once. */
export const getSession = cache(async (): Promise<CurrentSession | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token || token.length > 200) return null;

  const session = await globalDb.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      activeOrganizationId: true,
      isApp: true,
      expiresAt: true,
      lastSeenAt: true,
      user: {
        select: { id: true, email: true, name: true, phone: true, emailVerifiedAt: true, status: true },
      },
    },
  });

  if (!session || session.expiresAt < new Date() || session.user.status !== "ACTIVE") return null;

  if (Date.now() - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await globalDb.session
      .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
      .catch(() => undefined);
  }

  return {
    id: session.id,
    activeOrganizationId: session.activeOrganizationId,
    isApp: session.isApp,
    user: session.user,
  };
});

export async function setActiveOrganization(sessionId: string, organizationId: string | null): Promise<void> {
  await globalDb.session.update({ where: { id: sessionId }, data: { activeOrganizationId: organizationId } });
}

/** After a password change or account deletion: sign out everywhere (optionally except this device). */
export async function revokeSessions(userId: string, exceptSessionId?: string): Promise<void> {
  await globalDb.session.deleteMany({
    where: { userId, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
  });
}

export async function purgeExpiredSessions(): Promise<number> {
  const result = await globalDb.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return result.count;
}
