import type { Metadata } from "next";
import { RevisionHistory } from "@/components/revision-history";
import { Card, PageHeader } from "@/components/ui/surface";
import { requirePage } from "@/server/auth/context";
import { listRevisions } from "@/server/revisions";
import { CompanyForm } from "./company-form";

export const metadata: Metadata = { title: "Company profile" };

export default async function CompanyPage() {
  const ctx = await requirePage("settings.write");
  const organization = await ctx.db.organization.findFirstOrThrow();
  const revisions = await listRevisions(ctx, "Organization", organization.id);
  return (
    <>
      <PageHeader title="Company profile" description="Shown on invoices and other documents." back={{ href: "/app/settings", label: "Settings" }} />
      <Card>
        {/* Keyed by version: after a save or a restore the form starts from the stored values. */}
        <CompanyForm
          key={organization.version}
          defaults={{
            legalName: organization.legalName,
            tradeName: organization.tradeName ?? "",
            addressLine1: organization.addressLine1 ?? "",
            addressLine2: organization.addressLine2 ?? "",
            city: organization.city ?? "",
            pincode: organization.pincode ?? "",
            phone: organization.phone ?? "",
            email: organization.email ?? "",
            website: organization.website ?? "",
            version: organization.version,
          }}
        />
      </Card>
      <RevisionHistory revisions={revisions} entityType="Organization" />
    </>
  );
}
