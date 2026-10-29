import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RevisionHistory } from "@/components/revision-history";
import { Card, PageHeader } from "@/components/ui/surface";
import { toDateOnly } from "@/lib/dates";
import { documentTypeLabel } from "@/lib/numbering-defaults";
import { requirePage } from "@/server/auth/context";
import { listRevisions } from "@/server/revisions";
import { SeriesForm } from "./series-form";

export const metadata: Metadata = { title: "Number series" };

export default async function SeriesPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePage("settings.write");
  const { id } = await params;
  const series = await ctx.db.numberSeries.findUnique({
    where: { id },
    include: { financialYear: { select: { label: true, startDate: true } }, branch: { select: { name: true } } },
  });
  if (!series) notFound();
  const revisions = await listRevisions(ctx, "NumberSeries", series.id);

  return (
    <>
      <PageHeader
        title={documentTypeLabel(series.documentType)}
        description={`${series.branch.name} · ${series.financialYear.label}`}
        back={{ href: `/app/settings/number-series?fy=${series.financialYearId}&branch=${series.branchId}`, label: "Number series" }}
      />
      <Card>
        <SeriesForm
          key={series.version}
          sampleDate={toDateOnly(series.financialYear.startDate)}
          backHref={`/app/settings/number-series?fy=${series.financialYearId}&branch=${series.branchId}`}
          defaults={{
            id: series.id,
            prefix: series.prefix,
            padding: series.padding,
            nextNumber: series.nextNumber,
            mode: series.mode,
            version: series.version,
          }}
        />
      </Card>
      <RevisionHistory revisions={revisions} entityType="NumberSeries" />
    </>
  );
}
