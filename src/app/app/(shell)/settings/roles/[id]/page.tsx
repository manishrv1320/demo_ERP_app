import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RevisionHistory } from "@/components/revision-history";
import { Card, PageHeader } from "@/components/ui/surface";
import { CAPABILITIES, CAPABILITY_GROUPS, grantableCapabilities, MAX_RANK, normaliseCapabilities, outranks, OWNER_KEY } from "@/lib/rbac";
import { requirePage } from "@/server/auth/context";
import { listRevisions } from "@/server/revisions";
import { RoleForm } from "./role-form";

export const metadata: Metadata = { title: "Role" };

export default async function RolePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePage("roles.manage");
  const { id } = await params;
  const isNew = id === "new";
  const role = isNew ? null : await ctx.db.role.findUnique({ where: { id } });
  // The Owner role, and roles at or above your own rank, aren't editable — so they aren't reachable.
  if (!isNew && (!role || role.key === OWNER_KEY || !outranks(ctx.role, role.rank))) notFound();
  const revisions = role ? await listRevisions(ctx, "Role", role.id) : [];
  const grantable = grantableCapabilities(ctx.role);

  return (
    <>
      <PageHeader title={role ? role.name : "New role"} back={{ href: "/app/settings/roles", label: "Roles" }} />
      <Card>
        <RoleForm
          key={role?.version ?? "new"}
          isSystem={role?.isSystem ?? false}
          minRank={Math.min(ctx.role.rank + 1, MAX_RANK)}
          groups={CAPABILITY_GROUPS.map((group) => ({
            name: group,
            items: CAPABILITIES.filter((item) => item.group === group).map((item) => ({
              key: item.key,
              label: item.label,
              description: item.description,
              grantable: grantable.includes(item.key),
            })),
          }))}
          defaults={{
            id: role?.id,
            name: role?.name ?? "",
            description: role?.description ?? "",
            rank: role?.rank ?? 50,
            capabilities: role ? normaliseCapabilities(role.capabilities) : [],
            version: role?.version,
          }}
        />
      </Card>
      <RevisionHistory revisions={revisions} entityType="Role" />
    </>
  );
}
