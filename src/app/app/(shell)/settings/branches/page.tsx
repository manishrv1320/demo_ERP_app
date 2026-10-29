import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Badge, PageHeader } from "@/components/ui/surface";
import { stateName } from "@/lib/gst/states";
import { requirePage } from "@/server/auth/context";

export const metadata: Metadata = { title: "Branches" };

export default async function BranchesPage() {
  const ctx = await requirePage("settings.write");
  const branches = await ctx.db.branch.findMany({
    orderBy: [{ isHeadOffice: "desc" }, { name: "asc" }],
    select: { id: true, name: true, code: true, gstin: true, stateCode: true, city: true, isHeadOffice: true, isActive: true },
  });
  return (
    <>
      <PageHeader
        title="Branches"
        description="Each branch numbers its own documents. A branch in another state charges GST under its own GSTIN."
        back={{ href: "/app/settings", label: "Settings" }}
      >
        <ButtonLink href="/app/settings/branches/new">
          <Plus className="size-4" /> Add branch
        </ButtonLink>
      </PageHeader>
      <DataTable
        rows={branches}
        rowKey={(row) => row.id}
        rowHref={(row) => `/app/settings/branches/${row.id}`}
        columns={[
          { key: "name", header: "Branch", cell: (row) => row.name, mobile: "title" },
          { key: "code", header: "Code", cell: (row) => row.code, mobile: "subtitle" },
          { key: "state", header: "State", cell: (row) => stateName(row.stateCode), mobile: "line" },
          { key: "gstin", header: "GSTIN", cell: (row) => row.gstin ?? "—", mobile: "line" },
          {
            key: "status",
            header: "Status",
            cell: (row) => (
              <span className="flex flex-wrap gap-1">
                {row.isHeadOffice ? <Badge tone="accent">Head office</Badge> : null}
                {row.isActive ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>}
              </span>
            ),
            mobile: "value",
          },
        ]}
      />
    </>
  );
}
