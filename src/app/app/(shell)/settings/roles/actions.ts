"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { CAPABILITIES, grantableCapabilities, normaliseCapabilities, outranks, OWNER_KEY } from "@/lib/rbac";
import { roleSchema } from "@/lib/validation/organization";
import { describeChanges, logActivity } from "@/server/activity";
import { action } from "@/server/auth/action";
import { StaleVersionError, UserError } from "@/server/errors";
import { saveRevision } from "@/server/revisions";

/**
 * Roles are data, capabilities are code (Hyperzen's roles actions):
 *   • you can only grant capabilities you hold yourself;
 *   • you can only create or edit roles ranked below your own;
 *   • capabilities you don't hold are left exactly as they were on the role;
 *   • the Owner role can't be edited, and system roles keep their rank.
 */
export const saveRoleAction = action({ capability: "roles.manage", schema: roleSchema }, async (ctx, input) => {
  const grantable = new Set(grantableCapabilities(ctx.role));
  const requested = normaliseCapabilities(input.capabilities);
  const notAllowed = requested.filter((capability) => !grantable.has(capability));

  const id = await ctx.db.$transaction(async (tx) => {
    if (!input.id) {
      if (!outranks(ctx.role, input.rank)) throw new UserError("A new role must rank below your own.", "rank");
      if (notAllowed.length > 0) throw new UserError("You can only grant capabilities you hold yourself.", "capabilities");
      const role = await tx.role.create({
        data: {
          organizationId: ctx.org.id,
          key: `CUSTOM_${randomBytes(4).toString("hex").toUpperCase()}`,
          name: input.name,
          description: input.description,
          rank: input.rank,
          capabilities: requested,
        },
      });
      await logActivity(ctx, { action: "role.create", entityType: "Role", entityId: role.id, summary: `Role ${role.name} created with ${requested.length} capabilities` }, tx);
      return role.id;
    }

    const before = await tx.role.findUnique({ where: { id: input.id } });
    if (!before) throw new UserError("That role no longer exists.");
    if (before.key === OWNER_KEY) throw new UserError("The Owner role always holds everything and can't be edited.");
    if (!outranks(ctx.role, before.rank)) throw new UserError("You can only edit roles below your own.");
    const rank = before.isSystem ? before.rank : input.rank;
    if (!outranks(ctx.role, rank)) throw new UserError("The role must rank below your own.", "rank");
    if (input.version !== undefined && input.version !== before.version) throw new StaleVersionError();

    const existing = normaliseCapabilities(before.capabilities);
    const capabilities = [
      ...existing.filter((capability) => !grantable.has(capability)),
      ...requested.filter((capability) => grantable.has(capability)),
    ];
    await saveRevision(ctx, tx, { entityType: "Role", entityId: before.id, label: `Role ${before.name}`, data: before });
    await tx.role.update({
      where: { id: before.id },
      data: { name: input.name, description: input.description, rank, capabilities, version: { increment: 1 } },
    });

    const added = capabilities.filter((capability) => !existing.includes(capability));
    const removed = existing.filter((capability) => !capabilities.includes(capability));
    const label = (key: string) => CAPABILITIES.find((item) => item.key === key)?.label ?? key;
    const changes = [
      describeChanges(before, { name: input.name, rank }, { name: "name", rank: "rank" }),
      added.length ? `added ${added.map(label).join(", ")}` : "",
      removed.length ? `removed ${removed.map(label).join(", ")}` : "",
    ].filter(Boolean);
    await logActivity(ctx, { action: "role.update", entityType: "Role", entityId: before.id, summary: `Role ${input.name} updated${changes.length ? ` — ${changes.join("; ")}` : ""}` }, tx);
    return before.id;
  });
  return { ok: true, message: input.id ? "Role saved." : "Role created.", data: { id } };
});

export const deleteRoleAction = action(
  { capability: "roles.manage", schema: z.object({ id: z.string().min(1).max(40) }) },
  async (ctx, input) => {
    await ctx.db.$transaction(async (tx) => {
      const role = await tx.role.findUnique({ where: { id: input.id } });
      if (!role) return;
      if (role.isSystem) throw new UserError("Built-in roles can't be deleted.");
      if (!outranks(ctx.role, role.rank)) throw new UserError("You can only delete roles below your own.");
      const inUse = await tx.membership.count({ where: { roleId: role.id, status: "ACTIVE" } });
      if (inUse > 0) throw new UserError(`${inUse} member${inUse === 1 ? " has" : "s have"} this role. Give them another role first.`);
      await saveRevision(ctx, tx, { entityType: "Role", entityId: role.id, label: `Deleted role ${role.name}`, data: role });
      // Removed memberships and old invitations still point at the role; move them to Viewer.
      const viewer = await tx.role.findFirstOrThrow({ where: { key: "VIEWER" }, select: { id: true } });
      await tx.membership.updateMany({ where: { roleId: role.id }, data: { roleId: viewer.id } });
      await tx.invitation.updateMany({ where: { roleId: role.id, acceptedAt: null }, data: { revokedAt: new Date() } });
      await tx.invitation.updateMany({ where: { roleId: role.id }, data: { roleId: viewer.id } });
      await tx.role.delete({ where: { id: role.id } });
      await logActivity(ctx, { action: "role.delete", entityType: "Role", entityId: role.id, summary: `Role ${role.name} deleted` }, tx);
    });
    return { ok: true, message: "Role deleted." };
  },
);
