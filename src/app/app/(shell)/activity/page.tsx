import type { Metadata } from "next";
import { Download, History } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { DataTable, Pagination, pageFrom } from "@/components/ui/data-table";
import { SearchBox } from "@/components/ui/search-box";
import { EmptyState, PageHeader } from "@/components/ui/surface";
import { formatDateTime } from "@/lib/dates";
import { can } from "@/lib/rbac";
import { requirePage } from "@/server/auth/context";
import { activityWhere } from "@/server/lists";

export const metadata: Metadata = { title: "Activity log" };

const PAGE_SIZE = 40;

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ page?: string; q?: string }> }) {
  const ctx = await requirePage("activity.read");
  const params = await searchParams;
  const page = pageFrom(params.page);
  const q = params.q?.trim().slice(0, 100) || undefined;
  const where = activityWhere(q);

  const [rows, total] = await Promise.all([
    ctx.db.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { id: true, actorName: true, action: true, summary: true, createdAt: true, ip: true },
    }),
    ctx.db.activityLog.count({ where }),
  ]);

  return (
    <>
      <PageHeader
        title="Activity log"
        description="The audit trail of who changed what. It can't be edited or switched off; accounting entries are kept for at least 8 years."
      >
        <SearchBox placeholder="Search activity" />
        {can(ctx.role, "data.export") ? (
          <ButtonLink href={`/api/export/activity${q ? `?q=${encodeURIComponent(q)}` : ""}`} variant="secondary" prefetch={false}>
            <Download className="size-4" /> CSV
          </ButtonLink>
        ) : null}
      </PageHeader>
      <DataTable
        rows={rows}
        rowKey={(row) => row.id}
        empty={<EmptyState icon={<History className="size-6" />} title={q ? "No matching activity" : "No activity yet"} />}
        columns={[
          { key: "summary", header: "What happened", cell: (row) => row.summary, mobile: "title" },
          { key: "actor", header: "Who", cell: (row) => row.actorName, mobile: "subtitle" },
          { key: "when", header: "When", cell: (row) => formatDateTime(row.createdAt), mobile: "subtitle", className: "whitespace-nowrap" },
          { key: "action", header: "Action", cell: (row) => <code className="text-[12px] text-[var(--a-muted)]">{row.action}</code>, mobile: "hidden" },
        ]}
      />
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/app/activity" params={{ q }} />
    </>
  );
}
