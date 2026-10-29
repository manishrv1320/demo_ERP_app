import "server-only";

import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import type { ActionResult } from "@/lib/utils";
import { fieldErrors } from "@/lib/validation/common";
import { raw } from "@/server/db/raw";
import { describeError } from "@/server/errors";
import { getPlatformAdmin, type PlatformAdminSession } from "./session";

/**
 * Platform console data access. This module (with ./session and ./support) is
 * the only non-db code allowed the raw client: Hyperzen staff look across
 * organizations, but only at usage and status — never at business documents.
 * Opening an organization's data goes through the logged, read-only support view.
 */

export function platformAction<S extends z.ZodTypeAny, R = undefined>(
  schema: S,
  handler: (admin: PlatformAdminSession, input: z.output<S>) => Promise<ActionResult<R>>,
): (input: z.input<S>) => Promise<ActionResult<R>> {
  return async (input) => {
    const admin = await getPlatformAdmin();
    if (!admin) return { ok: false, message: "Please sign in to the platform console again." };
    const parsed = schema.safeParse(input);
    if (!parsed.success) return { ok: false, message: "Please check the highlighted fields.", errors: fieldErrors(parsed.error) };
    try {
      return await handler(admin, parsed.data);
    } catch (error) {
      unstable_rethrow(error);
      return { ok: false, message: describeError(error).message };
    }
  };
}

export async function listOrganizations(options: { q?: string; page: number; pageSize: number }) {
  const where = options.q
    ? {
        OR: [
          { legalName: { contains: options.q, mode: "insensitive" as const } },
          { tradeName: { contains: options.q, mode: "insensitive" as const } },
          { gstin: { contains: options.q.toUpperCase() } },
        ],
      }
    : {};
  const [rows, total] = await Promise.all([
    raw.organization.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize,
      select: {
        id: true,
        legalName: true,
        tradeName: true,
        gstin: true,
        stateCode: true,
        status: true,
        isDemo: true,
        createdAt: true,
        _count: { select: { memberships: { where: { status: "ACTIVE" } } } },
      },
    }),
    raw.organization.count({ where }),
  ]);
  return { rows, total };
}

export async function platformTotals() {
  const [organizations, active, suspended, pending, users] = await Promise.all([
    raw.organization.count(),
    raw.organization.count({ where: { status: "ACTIVE" } }),
    raw.organization.count({ where: { status: "SUSPENDED" } }),
    raw.organization.count({ where: { status: "PENDING_DELETION" } }),
    raw.user.count({ where: { status: "ACTIVE" } }),
  ]);
  return { organizations, active, suspended, pending, users };
}

/** Usage and status for one organization — counts, not contents. */
export async function organizationOverview(id: string) {
  const organization = await raw.organization.findUnique({
    where: { id },
    select: {
      id: true,
      legalName: true,
      tradeName: true,
      gstin: true,
      stateCode: true,
      city: true,
      status: true,
      suspendedAt: true,
      suspendedReason: true,
      deletionScheduledFor: true,
      isDemo: true,
      createdAt: true,
    },
  });
  if (!organization) return null;
  const [members, owners, branches, activity, files, lastActivity, supportVisits] = await Promise.all([
    raw.membership.count({ where: { organizationId: id, status: "ACTIVE" } }),
    raw.membership.findMany({
      where: { organizationId: id, status: "ACTIVE", role: { key: "OWNER" } },
      select: { user: { select: { name: true, email: true } } },
    }),
    raw.branch.count({ where: { organizationId: id } }),
    raw.activityLog.count({ where: { organizationId: id } }),
    raw.storedFile.aggregate({ where: { organizationId: id }, _count: { _all: true }, _sum: { size: true } }),
    raw.activityLog.findFirst({ where: { organizationId: id }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    raw.supportSession.findMany({
      where: { targetOrganizationId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, reason: true, createdAt: true, endedAt: true, platformAdmin: { select: { name: true } }, _count: { select: { visits: true } } },
    }),
  ]);
  return {
    organization,
    usage: {
      members,
      branches,
      activity,
      files: files._count._all,
      fileBytes: files._sum.size ?? 0,
      lastActivityAt: lastActivity?.createdAt ?? null,
    },
    owners: owners.map((row) => row.user),
    supportVisits,
  };
}

export async function setOrganizationSuspended(id: string, suspended: boolean, reason: string | null) {
  const organization = await raw.organization.findUniqueOrThrow({ where: { id }, select: { status: true } });
  if (organization.status === "PENDING_DELETION") throw new Error("This organization is being deleted.");
  await raw.organization.update({
    where: { id },
    data: suspended
      ? { status: "SUSPENDED", suspendedAt: new Date(), suspendedReason: reason }
      : { status: "ACTIVE", suspendedAt: null, suspendedReason: null },
  });
}

export async function listAuditLog(page: number, pageSize: number) {
  const [rows, total] = await Promise.all([
    raw.platformAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, action: true, targetOrganizationId: true, detail: true, ip: true, createdAt: true, platformAdmin: { select: { name: true } } },
    }),
    raw.platformAuditLog.count(),
  ]);
  return { rows, total };
}

export async function listPolicies() {
  return raw.policy.findMany({ orderBy: { slug: "asc" } });
}

export async function updatePolicy(id: string, input: { title: string; content: string; publishNewVersion: boolean }) {
  const policy = await raw.policy.findUniqueOrThrow({ where: { id } });
  await raw.policy.update({
    where: { id },
    data: {
      title: input.title,
      content: input.content,
      ...(input.publishNewVersion ? { version: policy.version + 1, versionAt: new Date() } : {}),
    },
  });
  return { previousVersion: policy.version, version: input.publishNewVersion ? policy.version + 1 : policy.version };
}

export async function platformSettingsRow() {
  return raw.platformSettings.upsert({ where: { id: "platform" }, create: { id: "platform" }, update: {} });
}

export async function savePlatformSettings(data: {
  smtpEnabled: boolean;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  smtpUser: string | null;
  smtpPasswordEnc: string | null | undefined;
  smtpFromName: string | null;
  smtpFromEmail: string | null;
  supportEmail: string | null;
}) {
  const { smtpPasswordEnc, ...rest } = data;
  await raw.platformSettings.upsert({
    where: { id: "platform" },
    create: { id: "platform", ...rest, smtpPasswordEnc: smtpPasswordEnc ?? null },
    update: { ...rest, ...(smtpPasswordEnc !== undefined ? { smtpPasswordEnc } : {}) },
  });
}

export async function findPlatformAdminByEmail(email: string) {
  return raw.platformAdmin.findUnique({ where: { email } });
}

export async function touchPlatformAdmin(id: string) {
  await raw.platformAdmin.update({ where: { id }, data: { lastLoginAt: new Date() } });
}
