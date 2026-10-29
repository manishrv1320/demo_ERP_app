import "server-only";

import type { Prisma } from "@prisma/client";
import type { AppContext } from "@/server/auth/context";
import type { TenantTx } from "@/server/db/tenant";

/**
 * Restorable snapshots (rule 6): before a record is edited or deleted, its
 * current state is saved. Restoring re-validates the snapshot through the
 * module's own Zod schema, so an old snapshot can't bypass today's rules.
 */

/** Plain JSON for a snapshot: dates become ISO strings, BigInts strings. */
export function toSnapshot(record: Record<string, unknown>): Prisma.InputJsonObject {
  return JSON.parse(
    JSON.stringify(record, (_key, value) => (typeof value === "bigint" ? value.toString() : value)),
  ) as Prisma.InputJsonObject;
}

export async function saveRevision(
  ctx: AppContext,
  tx: TenantTx,
  entry: { entityType: string; entityId: string; label: string; data: Record<string, unknown> },
): Promise<void> {
  await tx.revision.create({
    data: {
      organizationId: ctx.org.id,
      entityType: entry.entityType,
      entityId: entry.entityId,
      label: entry.label.slice(0, 200),
      data: toSnapshot(entry.data),
      authorUserId: ctx.user.id,
      authorName: ctx.user.name,
    },
  });
}

export async function listRevisions(ctx: AppContext, entityType: string, entityId: string) {
  return ctx.db.revision.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { id: true, label: true, authorName: true, createdAt: true },
  });
}
