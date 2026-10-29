import "server-only";

import { OWNER_KEY } from "@/lib/rbac";
import { raw } from "./raw";

/**
 * The few cross-organization reads the app genuinely needs, as named
 * functions — never open access. Each one starts from the signed-in user (or
 * an invitation token) and returns only what that person may see.
 */

/** The user's membership in one organization, with its role and the organization's status. */
export async function findMembership(userId: string, organizationId: string) {
  return raw.membership.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: {
      id: true,
      status: true,
      role: { select: { id: true, key: true, name: true, rank: true, capabilities: true } },
      organization: {
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
      },
    },
  });
}

export type MembershipWithOrganization = NonNullable<Awaited<ReturnType<typeof findMembership>>>;

/** Organizations the user belongs to, for the switcher. Removed memberships are left out. */
export async function listUserOrganizations(userId: string) {
  const rows = await raw.membership.findMany({
    where: { userId, status: "ACTIVE" },
    orderBy: { joinedAt: "asc" },
    select: {
      role: { select: { name: true, key: true } },
      organization: { select: { id: true, legalName: true, tradeName: true, status: true } },
    },
  });
  return rows.map((row) => ({
    id: row.organization.id,
    name: row.organization.tradeName || row.organization.legalName,
    status: row.organization.status,
    roleName: row.role.name,
    isOwner: row.role.key === OWNER_KEY,
  }));
}

export type UserOrganization = Awaited<ReturnType<typeof listUserOrganizations>>[number];

/** An invitation by its token hash — looked up before the person belongs to the organization. */
export async function findInvitation(tokenHash: string) {
  return raw.invitation.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      organizationId: true,
      email: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
      invitedById: true,
      invitedByName: true,
      role: { select: { id: true, name: true } },
      organization: { select: { legalName: true, tradeName: true, status: true } },
    },
  });
}

/** Accept an invitation: create (or re-activate) the membership and close the invitation. */
export async function acceptInvitation(input: { invitationId: string; organizationId: string; userId: string; roleId: string }) {
  await raw.$transaction(async (tx) => {
    const claimed = await tx.invitation.updateMany({
      where: { id: input.invitationId, organizationId: input.organizationId, acceptedAt: null, revokedAt: null },
      data: { acceptedAt: new Date() },
    });
    if (claimed.count !== 1) throw new Error("This invitation has already been used.");

    await tx.membership.upsert({
      where: { organizationId_userId: { organizationId: input.organizationId, userId: input.userId } },
      create: { organizationId: input.organizationId, userId: input.userId, roleId: input.roleId },
      update: { status: "ACTIVE", roleId: input.roleId, removedAt: null, joinedAt: new Date() },
    });
  });
}

/**
 * Before a user deletes their account: organizations where they're the only
 * active Owner. `othersRemain` decides whether that blocks deletion (others
 * would be left without an Owner) or the organization is deleted with them.
 */
export async function soleOwnerships(userId: string) {
  const owned = await raw.membership.findMany({
    where: { userId, status: "ACTIVE", role: { key: OWNER_KEY } },
    select: { organizationId: true, organization: { select: { legalName: true, tradeName: true, status: true } } },
  });

  const result: { organizationId: string; name: string; othersRemain: boolean }[] = [];
  for (const row of owned) {
    const [owners, members] = await Promise.all([
      raw.membership.count({
        where: { organizationId: row.organizationId, status: "ACTIVE", role: { key: OWNER_KEY } },
      }),
      raw.membership.count({ where: { organizationId: row.organizationId, status: "ACTIVE" } }),
    ]);
    if (owners === 1) {
      result.push({
        organizationId: row.organizationId,
        name: row.organization.tradeName || row.organization.legalName,
        othersRemain: members > 1,
      });
    }
  }
  return result;
}
