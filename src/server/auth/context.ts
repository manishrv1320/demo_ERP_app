import "server-only";

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import type { OrganizationStatus } from "@prisma/client";
import { can, isOwner, normaliseCapabilities, SUPPORT_ROLE, type ActorRole, type Capability } from "@/lib/rbac";
import { findMembership, listUserOrganizations } from "@/server/db/identity";
import { forOrg, type TenantDb } from "@/server/db/tenant";
import { emailVerificationRequired } from "@/server/email/platform";
import { getSupportSession, logSupportVisit, supportOrganization } from "@/server/platform/support";
import { outstandingPolicies } from "@/server/policies";
import { getSession, setActiveOrganization, type CurrentSession } from "./session";

/**
 * The request context: session → user → membership(user, active organization)
 * → role, re-checked on every request. Pages call `requirePage()`, server
 * actions go through `action()` in ./action.ts. Both hand out `ctx.db`, the
 * tenant client for the active organization — the only database access
 * ordinary code has.
 */

export type ContextOrganization = {
  id: string;
  name: string;
  legalName: string;
  stateCode: string;
  status: OrganizationStatus;
  accentColor: string | null;
  accentColor2: string | null;
  logoFileId: string | null;
  lockDate: Date | null;
  deletionScheduledFor: Date | null;
  isDemo: boolean;
};

export type AppContext = {
  kind: "member" | "support";
  user: { id: string; name: string; email: string };
  sessionId: string | null;
  isApp: boolean;
  org: ContextOrganization;
  role: ActorRole;
  db: TenantDb;
  readOnly: boolean;
  support: { adminName: string; expiresAt: Date } | null;
};

export type ContextResult =
  | { status: "ok"; ctx: AppContext }
  | { status: "signed-out" }
  | { status: "unverified" }
  | { status: "policies" }
  | { status: "no-organization" }
  | { status: "choose-organization" }
  | { status: "unavailable"; reason: "suspended" | "pending-deletion"; organizationName: string };

type OrganizationRow = Omit<ContextOrganization, "name"> & { tradeName: string | null };

function toContextOrganization(row: OrganizationRow): ContextOrganization {
  const { tradeName, ...rest } = row;
  return { ...rest, name: tradeName || row.legalName };
}

/** The path of the current request (set by src/middleware.ts). */
export async function currentPath(): Promise<string> {
  return (await headers()).get("x-hzerp-path") ?? "/app";
}

async function supportContext(): Promise<ContextResult | null> {
  const support = await getSupportSession();
  if (!support) return null;
  const organization = await supportOrganization(support.organizationId);
  if (!organization) return null;
  await logSupportVisit(support, await currentPath());
  return {
    status: "ok",
    ctx: {
      kind: "support",
      user: { id: `support:${support.id}`, name: `${support.adminName} (Hyperzen support)`, email: support.adminEmail },
      sessionId: null,
      isApp: false,
      org: toContextOrganization(organization),
      role: SUPPORT_ROLE,
      db: forOrg(organization.id, { readOnly: true }),
      readOnly: true,
      support: { adminName: support.adminName, expiresAt: support.expiresAt },
    },
  };
}

async function memberContext(session: CurrentSession): Promise<ContextResult> {
  if (!session.user.emailVerifiedAt && (await emailVerificationRequired())) return { status: "unverified" };
  if ((await outstandingPolicies(session.user.id)).length > 0) return { status: "policies" };

  let organizationId = session.activeOrganizationId;
  let membership = organizationId ? await findMembership(session.user.id, organizationId) : null;

  // No usable active organization: pick the only one, or ask.
  if (!membership || membership.status !== "ACTIVE") {
    const organizations = await listUserOrganizations(session.user.id);
    if (organizations.length === 0) {
      if (organizationId) await setActiveOrganization(session.id, null);
      return { status: "no-organization" };
    }
    if (organizations.length > 1) return { status: "choose-organization" };
    organizationId = organizations[0]!.id;
    await setActiveOrganization(session.id, organizationId);
    membership = await findMembership(session.user.id, organizationId);
    if (!membership || membership.status !== "ACTIVE") return { status: "no-organization" };
  }

  const org = toContextOrganization(membership.organization);
  const role: ActorRole = {
    id: membership.role.id,
    key: membership.role.key,
    name: membership.role.name,
    rank: membership.role.rank,
    capabilities: normaliseCapabilities(membership.role.capabilities),
  };

  if (org.status === "SUSPENDED") {
    return { status: "unavailable", reason: "suspended", organizationName: org.name };
  }
  // During the deletion grace period only an Owner can get in — to cancel it.
  if (org.status === "PENDING_DELETION" && !isOwner(role)) {
    return { status: "unavailable", reason: "pending-deletion", organizationName: org.name };
  }

  return {
    status: "ok",
    ctx: {
      kind: "member",
      user: { id: session.user.id, name: session.user.name, email: session.user.email },
      sessionId: session.id,
      isApp: session.isApp,
      org,
      role,
      db: forOrg(org.id),
      readOnly: false,
      support: null,
    },
  };
}

export const getAppContext = cache(async (): Promise<ContextResult> => {
  const support = await supportContext();
  if (support) return support;
  const session = await getSession();
  if (!session) return { status: "signed-out" };
  return memberContext(session);
});

/** For /app pages: sends people where they need to go, or returns the context. */
export async function requireAppContext(): Promise<AppContext> {
  const result = await getAppContext();
  switch (result.status) {
    case "ok": {
      const path = await currentPath();
      const pending = result.ctx.org.status === "PENDING_DELETION";
      if (pending && !path.startsWith("/app/settings/delete-organization") && !path.startsWith("/app/account")) {
        redirect("/app/settings/delete-organization");
      }
      return result.ctx;
    }
    case "signed-out":
      redirect(`/login?next=${encodeURIComponent(await currentPath())}`);
    case "unverified":
      redirect("/verify-email");
    case "policies":
      redirect(`/accept-policies?next=${encodeURIComponent(await currentPath())}`);
    case "no-organization":
      redirect("/app/onboarding");
    case "choose-organization":
      redirect("/app/select-org");
    case "unavailable":
      redirect("/app/unavailable");
  }
}

/**
 * Gate for a page. A screen the role can't use is a 404, not a disabled
 * button (rule 4). Pass several capabilities to require any one of them.
 */
export async function requirePage(capability?: Capability | Capability[] | "owner"): Promise<AppContext> {
  const ctx = await requireAppContext();
  if (!capability) return ctx;
  if (capability === "owner") {
    if (!isOwner(ctx.role)) notFound();
    return ctx;
  }
  const list = Array.isArray(capability) ? capability : [capability];
  if (!list.some((item) => can(ctx.role, item))) notFound();
  return ctx;
}

/** Signed in, whatever the organization state — for /app/select-org, onboarding and the account page. */
export async function requireSession(): Promise<CurrentSession> {
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(await currentPath())}`);
  return session;
}
