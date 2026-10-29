import "server-only";

import { isOwner, normaliseCapabilities, outranks, OWNER_KEY } from "@/lib/rbac";
import type { AppContext } from "@/server/auth/context";

/** For the members screen: which roles this person may hand out. */
export async function assignableRolesFor(ctx: AppContext) {
  const roles = await ctx.db.role.findMany({ orderBy: [{ rank: "asc" }, { name: "asc" }], select: { id: true, name: true, rank: true, key: true, capabilities: true } });
  return roles
    .filter((role) => outranks(ctx.role, role.rank))
    .map((role) => ({ id: role.id, name: role.name, isOwner: role.key === OWNER_KEY, capabilityCount: normaliseCapabilities(role.capabilities).length }))
    .filter((role) => !role.isOwner || isOwner(ctx.role));
}
