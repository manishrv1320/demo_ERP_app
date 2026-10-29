import Link from "next/link";
import { DataTable, Pagination, pageFrom } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/surface";
import { formatDateTime } from "@/lib/dates";
import { listAuditLog } from "@/server/platform/console";

const PAGE_SIZE = 50;

export default async function PlatformAuditPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = pageFrom((await searchParams).page);
  const { rows, total } = await listAuditLog(page, PAGE_SIZE);
  return (
    <>
      <PageHeader title="Audit log" description="Every sign-in, suspension, support view and settings change in this console." />
      <DataTable
        rows={rows}
        rowKey={(row) => row.id}
        columns={[
          { key: "when", header: "When", cell: (row) => formatDateTime(row.createdAt), mobile: "subtitle" },
          { key: "who", header: "Who", cell: (row) => row.platformAdmin?.name ?? "—", mobile: "line" },
          { key: "action", header: "Action", cell: (row) => row.action, mobile: "title" },
          {
            key: "org",
            header: "Organization",
            cell: (row) => (row.targetOrganizationId ? <Link className="text-[var(--accent)]" href={`/platform/orgs/${row.targetOrganizationId}`}>Open</Link> : "—"),
            mobile: "line",
          },
          {
            key: "detail",
            header: "Detail",
            cell: (row) => <span className="text-[12.5px] text-[var(--a-muted)]">{row.detail ? JSON.stringify(row.detail).slice(0, 160) : ""}</span>,
            mobile: "line",
          },
        ]}
      />
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/platform/audit" />
    </>
  );
}
