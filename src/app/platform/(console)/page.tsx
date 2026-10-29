import { DataTable, Pagination, pageFrom } from "@/components/ui/data-table";
import { SearchBox } from "@/components/ui/search-box";
import { Badge, Card, PageHeader } from "@/components/ui/surface";
import { formatDate } from "@/lib/dates";
import { stateName } from "@/lib/gst/states";
import { listOrganizations, platformTotals } from "@/server/platform/console";

const PAGE_SIZE = 50;

export default async function PlatformHome({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const params = await searchParams;
  const q = params.q?.trim().slice(0, 100) || undefined;
  const page = pageFrom(params.page);
  const [{ rows, total }, totals] = await Promise.all([listOrganizations({ q, page, pageSize: PAGE_SIZE }), platformTotals()]);

  const stats = [
    { label: "Organizations", value: totals.organizations },
    { label: "Active", value: totals.active },
    { label: "Suspended", value: totals.suspended },
    { label: "Being deleted", value: totals.pending },
    { label: "Users", value: totals.users },
  ];

  return (
    <>
      <PageHeader title="Organizations" description="Usage and status only. Business data opens only through the logged, read-only support view.">
        <SearchBox placeholder="Name or GSTIN" />
      </PageHeader>
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        {stats.map((stat) => (
          <Card key={stat.label} className="!p-4">
            <p className="text-[12px] text-[var(--a-muted)]">{stat.label}</p>
            <p className="mt-1 text-[22px] font-semibold text-[var(--a-fg-strong)]">{stat.value}</p>
          </Card>
        ))}
      </div>
      <DataTable
        rows={rows}
        rowKey={(row) => row.id}
        rowHref={(row) => `/platform/orgs/${row.id}`}
        columns={[
          { key: "name", header: "Organization", cell: (row) => row.tradeName || row.legalName, mobile: "title" },
          { key: "gstin", header: "GSTIN", cell: (row) => row.gstin ?? "—", mobile: "subtitle" },
          { key: "state", header: "State", cell: (row) => stateName(row.stateCode), mobile: "line" },
          { key: "members", header: "Members", cell: (row) => row._count.memberships, align: "right", mobile: "line" },
          { key: "created", header: "Created", cell: (row) => formatDate(row.createdAt), mobile: "line" },
          {
            key: "status",
            header: "Status",
            cell: (row) => (
              <span className="flex gap-1">
                {row.status === "ACTIVE" ? <Badge tone="success">Active</Badge> : row.status === "SUSPENDED" ? <Badge tone="danger">Suspended</Badge> : <Badge tone="warning">Being deleted</Badge>}
                {row.isDemo ? <Badge tone="accent">Demo</Badge> : null}
              </span>
            ),
            mobile: "value",
          },
        ]}
      />
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/platform" params={{ q }} />
    </>
  );
}
