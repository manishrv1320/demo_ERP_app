import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RevisionHistory } from "@/components/revision-history";
import { Card, PageHeader } from "@/components/ui/surface";
import { requirePage } from "@/server/auth/context";
import { listRevisions } from "@/server/revisions";
import { BranchForm } from "./branch-form";

export const metadata: Metadata = { title: "Branch" };

export default async function BranchPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePage("settings.write");
  const { id } = await params;
  const isNew = id === "new";
  const branch = isNew ? null : await ctx.db.branch.findUnique({ where: { id } });
  if (!isNew && !branch) notFound();
  const revisions = branch ? await listRevisions(ctx, "Branch", branch.id) : [];

  return (
    <>
      <PageHeader title={branch ? branch.name : "Add a branch"} back={{ href: "/app/settings/branches", label: "Branches" }} />
      <Card>
        <BranchForm
          key={branch?.version ?? "new"}
          isHeadOffice={branch?.isHeadOffice ?? false}
          defaults={{
            id: branch?.id,
            name: branch?.name ?? "",
            code: branch?.code ?? "",
            gstin: branch?.gstin ?? "",
            stateCode: branch?.stateCode ?? ctx.org.stateCode,
            addressLine1: branch?.addressLine1 ?? "",
            addressLine2: branch?.addressLine2 ?? "",
            city: branch?.city ?? "",
            pincode: branch?.pincode ?? "",
            phone: branch?.phone ?? "",
            isActive: branch?.isActive ?? true,
            version: branch?.version,
          }}
        />
      </Card>
      <RevisionHistory revisions={revisions} entityType="Branch" />
    </>
  );
}
