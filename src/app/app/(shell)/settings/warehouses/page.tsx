import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Badge, PageHeader } from "@/components/ui/surface";
import { requirePage } from "@/server/auth/context";

export const metadata: Metadata = { title: "Warehouses" };

export default async function WarehousesPage() {
  const ctx = await requirePage("settings.write");
  const warehouses = await ctx.db.warehouse.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true, isActive: true, branch: { select: { name: true } } },
  });
  return (
    <>
      <PageHeader
        title="Warehouses"
        description="Stock is tracked per warehouse. Each belongs to a branch."
        back={{ href: "/app/settings", label: "Settings" }}
      >
        <ButtonLink href="/app/settings/warehouses/new">
          <Plus className="size-4" /> Add warehouse
        </ButtonLink>
      </PageHeader>
      <DataTable
        rows={warehouses}
        rowKey={(row) => row.id}
        rowHref={(row) => `/app/settings/warehouses/${row.id}`}
        columns={[
          { key: "name", header: "Warehouse", cell: (row) => row.name, mobile: "title" },
          { key: "code", header: "Code", cell: (row) => row.code, mobile: "subtitle" },
          { key: "branch", header: "Branch", cell: (row) => row.branch.name, mobile: "line" },
          {
            key: "status",
            header: "Status",
            cell: (row) => (row.isActive ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>),
            mobile: "value",
          },
        ]}
      />
    </>
  );
}
