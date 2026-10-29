import type { Metadata } from "next";
import Link from "next/link";
import { DataTable } from "@/components/ui/data-table";
import { Badge, PageHeader } from "@/components/ui/surface";
import { financialYearFor, toDateOnly, todayIST } from "@/lib/dates";
import { formatDocumentNumber, resolvePrefix } from "@/lib/numbering";
import { DOCUMENT_TYPES, documentTypeLabel } from "@/lib/numbering-defaults";
import { requirePage } from "@/server/auth/context";
import { SeriesFilters } from "./series-filters";

export const metadata: Metadata = { title: "Number series" };

export default async function NumberSeriesPage({ searchParams }: { searchParams: Promise<{ fy?: string; branch?: string }> }) {
  const ctx = await requirePage("settings.write");
  const params = await searchParams;
  const [years, branches] = await Promise.all([
    ctx.db.financialYear.findMany({ orderBy: { startDate: "desc" }, select: { id: true, label: true, startDate: true } }),
    ctx.db.branch.findMany({ orderBy: [{ isHeadOffice: "desc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);
  const currentStart = financialYearFor(todayIST()).startDate;
  const year = years.find((item) => item.id === params.fy) ?? years.find((item) => toDateOnly(item.startDate) === currentStart) ?? years[0];
  const branch = branches.find((item) => item.id === params.branch) ?? branches[0];

  const series =
    year && branch
      ? await ctx.db.numberSeries.findMany({
          where: { financialYearId: year.id, branchId: branch.id },
          select: { id: true, documentType: true, prefix: true, padding: true, nextNumber: true, mode: true },
        })
      : [];
  const order = new Map(DOCUMENT_TYPES.map((item, index) => [item.type, index]));
  series.sort((a, b) => (order.get(a.documentType) ?? 0) - (order.get(b.documentType) ?? 0));
  const sampleDate = year ? toDateOnly(year.startDate) : currentStart;

  return (
    <>
      <PageHeader
        title="Number series"
        description="GST allows document numbers of up to 16 characters — letters, digits, / and - — unique within a financial year."
        back={{ href: "/app/settings", label: "Settings" }}
      />
      <SeriesFilters
        years={years.map((item) => ({ id: item.id, label: item.label }))}
        branches={branches}
        yearId={year?.id ?? ""}
        branchId={branch?.id ?? ""}
      />
      <DataTable
        rows={series}
        rowKey={(row) => row.id}
        rowHref={(row) => `/app/settings/number-series/${row.id}`}
        columns={[
          { key: "type", header: "Document", cell: (row) => documentTypeLabel(row.documentType), mobile: "title" },
          {
            key: "next",
            header: "Next number",
            cell: (row) => <code className="text-[13px]">{formatDocumentNumber(resolvePrefix(row.prefix, sampleDate), row.padding, row.nextNumber)}</code>,
            mobile: "subtitle",
          },
          { key: "prefix", header: "Prefix", cell: (row) => <code className="text-[12.5px] text-[var(--a-muted)]">{row.prefix}</code>, mobile: "line" },
          { key: "mode", header: "Numbering", cell: (row) => (row.mode === "AUTO" ? <Badge tone="success">Automatic</Badge> : <Badge>Manual</Badge>), mobile: "value" },
        ]}
      />
      <p className="mt-3 text-[12.5px] text-[var(--a-muted)]">
        Numbers are taken only when a document is issued, inside the same transaction, so a series never has gaps.{" "}
        <Link href="/app/settings/financial-years" className="text-[var(--accent)]">
          Add a financial year
        </Link>
      </p>
    </>
  );
}
