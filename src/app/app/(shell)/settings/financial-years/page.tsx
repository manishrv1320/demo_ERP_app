import type { Metadata } from "next";
import { DataTable } from "@/components/ui/data-table";
import { Badge, Card, CardTitle, PageHeader } from "@/components/ui/surface";
import { financialYearFor, formatDate, toDateOnly, todayIST } from "@/lib/dates";
import { requirePage } from "@/server/auth/context";
import { AddYearButtons } from "./add-year";

export const metadata: Metadata = { title: "Financial years" };

function shiftYear(startDate: string, years: number): string {
  return `${Number(startDate.slice(0, 4)) + years}-04-01`;
}

export default async function FinancialYearsPage() {
  const ctx = await requirePage("settings.write");
  const years = await ctx.db.financialYear.findMany({ orderBy: { startDate: "desc" } });
  const current = financialYearFor(todayIST()).startDate;
  const latest = years[0] ? toDateOnly(years[0].startDate) : current;
  const earliest = years.at(-1) ? toDateOnly(years.at(-1)!.startDate) : current;

  return (
    <>
      <PageHeader
        title="Financial years"
        description="Indian financial years run from 1 April to 31 March. Document numbers restart in each year."
        back={{ href: "/app/settings", label: "Settings" }}
      />
      <DataTable
        rows={years}
        rowKey={(row) => row.id}
        columns={[
          { key: "label", header: "Year", cell: (row) => row.label, mobile: "title" },
          { key: "range", header: "Period", cell: (row) => `${formatDate(row.startDate)} – ${formatDate(row.endDate)}`, mobile: "subtitle" },
          {
            key: "status",
            header: "Status",
            cell: (row) =>
              toDateOnly(row.startDate) === current ? <Badge tone="accent">Current</Badge> : row.isClosed ? <Badge>Closed</Badge> : <Badge tone="success">Open</Badge>,
            mobile: "value",
          },
        ]}
      />
      <Card className="mt-4">
        <CardTitle title="Add a year" description="Each new year gets number series copied from the year before, starting again at 1." />
        <AddYearButtons
          options={[
            { startDate: shiftYear(latest, 1), label: `Add ${financialYearFor(shiftYear(latest, 1)).label}` },
            { startDate: shiftYear(earliest, -1), label: `Add ${financialYearFor(shiftYear(earliest, -1)).label} (earlier)` },
          ]}
        />
      </Card>
    </>
  );
}
