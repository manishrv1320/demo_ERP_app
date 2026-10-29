import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Badge, PageHeader } from "@/components/ui/surface";
import { normaliseCapabilities, outranks, OWNER_KEY } from "@/lib/rbac";
import { requirePage } from "@/server/auth/context";

export const metadata: Metadata = { title: "Roles" };

export default async function RolesPage() {
  const ctx = await requirePage("roles.manage");
  const roles = await ctx.db.role.findMany({
    orderBy: [{ rank: "asc" }, { name: "asc" }],
    select: {
      id: true,
      key: true,
      name: true,
      description: true,
      rank: true,
      isSystem: true,
      capabilities: true,
      _count: { select: { memberships: { where: { status: "ACTIVE" } } } },
    },
  });
  return (
    <>
      <PageHeader
        title="Roles"
        description="A role is a set of capabilities. Lower rank is more senior: you can only manage roles ranked below yours, and only grant what you hold."
        back={{ href: "/app/settings", label: "Settings" }}
      >
        <ButtonLink href="/app/settings/roles/new">
          <Plus className="size-4" /> New role
        </ButtonLink>
      </PageHeader>
      <DataTable
        rows={roles}
        rowKey={(row) => row.id}
        rowHref={(row) => (row.key !== OWNER_KEY && outranks(ctx.role, row.rank) ? `/app/settings/roles/${row.id}` : null)}
        columns={[
          { key: "name", header: "Role", cell: (row) => row.name, mobile: "title" },
          { key: "description", header: "Description", cell: (row) => <span className="text-[var(--a-muted)]">{row.description}</span>, mobile: "subtitle" },
          { key: "rank", header: "Rank", cell: (row) => row.rank, align: "right", mobile: "line" },
          {
            key: "capabilities",
            header: "Capabilities",
            cell: (row) => (row.key === OWNER_KEY ? "All" : normaliseCapabilities(row.capabilities).length),
            align: "right",
            mobile: "line",
          },
          { key: "members", header: "Members", cell: (row) => row._count.memberships, align: "right", mobile: "value" },
          { key: "type", header: "", cell: (row) => (row.isSystem ? <Badge>Built-in</Badge> : <Badge tone="accent">Custom</Badge>), mobile: "hidden" },
        ]}
      />
    </>
  );
}
