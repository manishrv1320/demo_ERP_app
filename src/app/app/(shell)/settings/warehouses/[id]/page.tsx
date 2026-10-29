import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RevisionHistory } from "@/components/revision-history";
import { Card, PageHeader } from "@/components/ui/surface";
import { requirePage } from "@/server/auth/context";
import { listRevisions } from "@/server/revisions";
import { WarehouseForm } from "./warehouse-form";

export const metadata: Metadata = { title: "Warehouse" };

export default async function WarehousePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePage("settings.write");
  const { id } = await params;
  const isNew = id === "new";
  const [warehouse, branches] = await Promise.all([
    isNew ? null : ctx.db.warehouse.findUnique({ where: { id } }),
    ctx.db.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!isNew && !warehouse) notFound();
  const revisions = warehouse ? await listRevisions(ctx, "Warehouse", warehouse.id) : [];

  return (
    <>
      <PageHeader title={warehouse ? warehouse.name : "Add a warehouse"} back={{ href: "/app/settings/warehouses", label: "Warehouses" }} />
      <Card>
        <WarehouseForm
          key={warehouse?.version ?? "new"}
          branches={branches}
          defaults={{
            id: warehouse?.id,
            branchId: warehouse?.branchId ?? branches[0]?.id ?? "",
            name: warehouse?.name ?? "",
            code: warehouse?.code ?? "",
            address: warehouse?.address ?? "",
            isActive: warehouse?.isActive ?? true,
            version: warehouse?.version,
          }}
        />
      </Card>
      <RevisionHistory revisions={revisions} entityType="Warehouse" />
    </>
  );
}
