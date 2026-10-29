import type { Metadata } from "next";
import { RevisionHistory } from "@/components/revision-history";
import { Card, PageHeader } from "@/components/ui/surface";
import { requirePage } from "@/server/auth/context";
import { listRevisions } from "@/server/revisions";
import { GstForm } from "./gst-form";

export const metadata: Metadata = { title: "GST" };

export default async function GstPage() {
  const ctx = await requirePage("settings.write");
  const organization = await ctx.db.organization.findFirstOrThrow();
  const revisions = await listRevisions(ctx, "Organization", organization.id);
  return (
    <>
      <PageHeader
        title="GST"
        description="The head office uses this registration. Add a branch for each other state you're registered in."
        back={{ href: "/app/settings", label: "Settings" }}
      />
      <Card>
        <GstForm
          key={organization.version}
          defaults={{
            gstRegistration: organization.gstRegistration,
            gstin: organization.gstin ?? "",
            pan: organization.pan ?? "",
            stateCode: organization.stateCode,
            version: organization.version,
          }}
        />
      </Card>
      <RevisionHistory revisions={revisions} entityType="Organization" />
    </>
  );
}
