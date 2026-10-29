import "server-only";

import type { Prisma } from "@prisma/client";
import { financialYearFor, parseDateOnly, todayIST } from "@/lib/dates";
import { DOCUMENT_TYPES, defaultPrefix } from "@/lib/numbering-defaults";
import { OWNER_KEY, SYSTEM_ROLES } from "@/lib/rbac";
import { raw } from "./raw";

type Tx = Prisma.TransactionClient;

/**
 * Everything a new organization starts with, created in one transaction:
 * settings, the seven default roles, the head-office branch and main
 * warehouse, the current financial year, a number series for every document
 * type, and the Owner's membership. Seeded from code, so every organization
 * starts identical. (Later phases add the chart of accounts and GST units here.)
 */
export async function provisionOrganization(
  tx: Tx,
  input: { ownerUserId: string; legalName: string; stateCode: string; today?: string; isDemo?: boolean },
): Promise<{ organizationId: string }> {
  const today = input.today ?? todayIST();
  const fy = financialYearFor(today);

  const organization = await tx.organization.create({
    data: {
      legalName: input.legalName,
      stateCode: input.stateCode,
      booksStartDate: parseDateOnly(fy.startDate),
      isDemo: Boolean(input.isDemo),
    },
    select: { id: true },
  });
  const organizationId = organization.id;

  await tx.organizationSettings.create({ data: { organizationId } });

  await tx.role.createMany({
    data: SYSTEM_ROLES.map((role) => ({
      organizationId,
      key: role.key,
      name: role.name,
      description: role.description,
      rank: role.rank,
      capabilities: role.capabilities,
      isSystem: true,
    })),
  });
  const owner = await tx.role.findUniqueOrThrow({
    where: { organizationId_key: { organizationId, key: OWNER_KEY } },
    select: { id: true },
  });

  const branch = await tx.branch.create({
    data: { organizationId, name: "Head office", code: "HO", stateCode: input.stateCode, isHeadOffice: true },
    select: { id: true, code: true, isHeadOffice: true },
  });
  await tx.warehouse.create({
    data: { organizationId, branchId: branch.id, name: "Main warehouse", code: "MAIN" },
  });

  const year = await tx.financialYear.create({
    data: {
      organizationId,
      label: fy.label,
      startDate: parseDateOnly(fy.startDate),
      endDate: parseDateOnly(fy.endDate),
    },
    select: { id: true },
  });

  await createSeriesFor(tx, organizationId, [branch], [year.id]);

  await tx.membership.create({
    data: { organizationId, userId: input.ownerUserId, roleId: owner.id },
  });

  return { organizationId };
}

/** Number series rows for every document type, for each branch × financial year pair. */
export function seriesRows(
  organizationId: string,
  branches: { id: string; code: string; isHeadOffice: boolean }[],
  financialYearIds: string[],
): Prisma.NumberSeriesCreateManyInput[] {
  const rows: Prisma.NumberSeriesCreateManyInput[] = [];
  for (const branch of branches) {
    for (const financialYearId of financialYearIds) {
      for (const entry of DOCUMENT_TYPES) {
        rows.push({
          organizationId,
          documentType: entry.type,
          branchId: branch.id,
          financialYearId,
          prefix: defaultPrefix(entry.type, branch),
          padding: 4,
        });
      }
    }
  }
  return rows;
}

export async function createSeriesFor(
  tx: Tx,
  organizationId: string,
  branches: { id: string; code: string; isHeadOffice: boolean }[],
  financialYearIds: string[],
): Promise<void> {
  await tx.numberSeries.createMany({ data: seriesRows(organizationId, branches, financialYearIds), skipDuplicates: true });
}

/** Sign-up: the user, their first organization and their policy acceptances, all or nothing. */
export async function createAccountWithOrganization(input: {
  name: string;
  email: string;
  passwordHash: string;
  legalName: string;
  stateCode: string;
  acceptances: { policyId: string; version: number }[];
  ip: string | null;
  userAgent: string | null;
}): Promise<{ userId: string; organizationId: string }> {
  return raw.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name: input.name, email: input.email, passwordHash: input.passwordHash },
      select: { id: true },
    });
    if (input.acceptances.length > 0) {
      await tx.policyAcceptance.createMany({
        data: input.acceptances.map((acceptance) => ({
          ...acceptance,
          userId: user.id,
          ip: input.ip,
          userAgent: input.userAgent,
        })),
        skipDuplicates: true,
      });
    }
    const { organizationId } = await provisionOrganization(tx, {
      ownerUserId: user.id,
      legalName: input.legalName,
      stateCode: input.stateCode,
    });
    return { userId: user.id, organizationId };
  });
}

/** An existing user starts another organization (they become its Owner). */
export async function createAdditionalOrganization(input: {
  userId: string;
  legalName: string;
  stateCode: string;
}): Promise<{ organizationId: string }> {
  return raw.$transaction((tx) =>
    provisionOrganization(tx, { ownerUserId: input.userId, legalName: input.legalName, stateCode: input.stateCode }),
  );
}
