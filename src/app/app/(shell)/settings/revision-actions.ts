"use server";

import { z } from "zod";
import { can, grantableCapabilities, normaliseCapabilities, outranks, OWNER_KEY } from "@/lib/rbac";
import {
  branchSchema,
  companyProfileSchema,
  gstSettingsSchema,
  numberSeriesSchema,
  roleSchema,
  warehouseSchema,
} from "@/lib/validation/organization";
import { logActivity } from "@/server/activity";
import { action } from "@/server/auth/action";
import type { AppContext } from "@/server/auth/context";
import type { TenantTx } from "@/server/db/tenant";
import { UserError } from "@/server/errors";
import { saveRevision } from "@/server/revisions";

/**
 * Restore a snapshot from revision history. The snapshot is re-validated with
 * the same Zod schema the edit form uses, so an old snapshot can't bring back
 * something today's rules reject. The current state is snapshotted first, so a
 * restore can itself be undone.
 */

type Snapshot = Record<string, unknown>;

const RESTORERS: Record<string, (ctx: AppContext, tx: TenantTx, entityId: string, data: Snapshot) => Promise<string>> = {
  async Organization(ctx, tx, entityId, data) {
    if (!can(ctx.role, "settings.write")) throw new UserError("You don't have permission to do that.");
    const current = await tx.organization.findFirstOrThrow();
    const profile = companyProfileSchema.parse({ ...data, version: current.version });
    const gst = gstSettingsSchema.parse({ ...data, version: current.version });
    await saveRevision(ctx, tx, { entityType: "Organization", entityId, label: "Before restoring", data: current });
    const { version: _v1, ...profileData } = profile;
    const { version: _v2, ...gstData } = gst;
    await tx.organization.update({ where: { id: ctx.org.id }, data: { ...profileData, ...gstData, version: { increment: 1 } } });
    return "Company profile";
  },
  async Branch(ctx, tx, entityId, data) {
    if (!can(ctx.role, "settings.write")) throw new UserError("You don't have permission to do that.");
    const current = await tx.branch.findUniqueOrThrow({ where: { id: entityId } });
    const { id: _id, version: _version, ...parsed } = branchSchema.parse({ ...data, id: entityId, version: current.version });
    await saveRevision(ctx, tx, { entityType: "Branch", entityId, label: "Before restoring", data: current });
    await tx.branch.update({ where: { id: entityId }, data: { ...parsed, isActive: current.isHeadOffice ? true : parsed.isActive, version: { increment: 1 } } });
    return `Branch ${parsed.name}`;
  },
  async Warehouse(ctx, tx, entityId, data) {
    if (!can(ctx.role, "settings.write")) throw new UserError("You don't have permission to do that.");
    const current = await tx.warehouse.findUniqueOrThrow({ where: { id: entityId } });
    const { id: _id, version: _version, ...parsed } = warehouseSchema.parse({ ...data, id: entityId, version: current.version });
    await saveRevision(ctx, tx, { entityType: "Warehouse", entityId, label: "Before restoring", data: current });
    await tx.warehouse.update({ where: { id: entityId }, data: { ...parsed, version: { increment: 1 } } });
    return `Warehouse ${parsed.name}`;
  },
  async NumberSeries(ctx, tx, entityId, data) {
    if (!can(ctx.role, "settings.write")) throw new UserError("You don't have permission to do that.");
    const current = await tx.numberSeries.findUniqueOrThrow({ where: { id: entityId } });
    const { id: _id, version: _version, ...parsed } = numberSeriesSchema.parse({ ...data, id: entityId, version: current.version });
    await saveRevision(ctx, tx, { entityType: "NumberSeries", entityId, label: "Before restoring", data: current });
    // Never wind the counter back: numbers already issued must stay unique.
    await tx.numberSeries.update({
      where: { id: entityId },
      data: { ...parsed, nextNumber: Math.max(parsed.nextNumber, current.nextNumber), version: { increment: 1 } },
    });
    return `Number series ${current.documentType}`;
  },
  async Role(ctx, tx, entityId, data) {
    if (!can(ctx.role, "roles.manage")) throw new UserError("You don't have permission to do that.");
    const current = await tx.role.findUniqueOrThrow({ where: { id: entityId } });
    if (current.key === OWNER_KEY) throw new UserError("The Owner role can't be changed.");
    if (!outranks(ctx.role, current.rank)) throw new UserError("You can only change roles below your own.");
    const parsed = roleSchema.parse({ ...data, id: entityId, capabilities: normaliseCapabilities(data.capabilities) });
    if (!outranks(ctx.role, parsed.rank)) throw new UserError("That snapshot ranks the role at or above your own.");
    const grantable = new Set(grantableCapabilities(ctx.role));
    const capabilities = normaliseCapabilities(parsed.capabilities).filter((capability) => grantable.has(capability));
    await saveRevision(ctx, tx, { entityType: "Role", entityId, label: "Before restoring", data: current });
    await tx.role.update({
      where: { id: entityId },
      data: {
        name: parsed.name,
        description: parsed.description,
        rank: current.isSystem ? current.rank : parsed.rank,
        capabilities,
        version: { increment: 1 },
      },
    });
    return `Role ${parsed.name}`;
  },
};

export const restoreRevisionAction = action(
  { capability: ["settings.write", "roles.manage"], schema: z.object({ revisionId: z.string().min(1).max(40) }) },
  async (ctx, input) => {
    const label = await ctx.db.$transaction(async (tx) => {
      const revision = await tx.revision.findUnique({ where: { id: input.revisionId } });
      if (!revision) throw new UserError("That snapshot no longer exists.");
      const restore = RESTORERS[revision.entityType];
      if (!restore) throw new UserError("That kind of record can't be restored.");
      const result = await restore(ctx, tx, revision.entityId, revision.data as Snapshot);
      await logActivity(
        ctx,
        { action: "revision.restore", entityType: revision.entityType, entityId: revision.entityId, summary: `${result} restored to the snapshot "${revision.label}"` },
        tx,
      );
      return result;
    });
    return { ok: true, message: `${label} restored.` };
  },
);
