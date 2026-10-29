import "server-only";

import type { Prisma } from "@prisma/client";

/**
 * Filters shared by a list page and its CSV export, so the export always
 * contains exactly what the screen shows.
 */

export function activityWhere(q?: string): Prisma.ActivityLogWhereInput {
  if (!q) return {};
  return {
    OR: [
      { summary: { contains: q, mode: "insensitive" } },
      { actorName: { contains: q, mode: "insensitive" } },
      { action: { contains: q, mode: "insensitive" } },
    ],
  };
}

export function memberWhere(q?: string): Prisma.MembershipWhereInput {
  return {
    status: "ACTIVE",
    ...(q
      ? {
          user: {
            OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }],
          },
        }
      : {}),
  };
}
