import type { Metadata } from "next";
import { Download } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardTitle, PageHeader } from "@/components/ui/surface";
import { formatDate } from "@/lib/dates";
import { requirePage } from "@/server/auth/context";
import { DELETION_GRACE_DAYS } from "@/server/deletion";
import { CancelDeletion, RequestDeletion } from "./deletion-controls";

export const metadata: Metadata = { title: "Delete organization" };

export default async function DeleteOrganizationPage() {
  const ctx = await requirePage("owner");
  const organization = await ctx.db.organization.findFirstOrThrow({
    select: { legalName: true, status: true, deletionScheduledFor: true },
  });
  const pending = organization.status === "PENDING_DELETION";

  return (
    <>
      <PageHeader title="Delete organization" description={ctx.org.name} back={pending ? undefined : { href: "/app/settings", label: "Settings" }} />
      <div className="space-y-4">
        <Card>
          <CardTitle
            title="1. Export your data first"
            description="A zip with a CSV file for every table — settings, members, roles, activity log and, as you use them, documents and accounts — plus your uploaded files."
          />
          <ButtonLink href="/api/export/organization" variant="secondary" prefetch={false}>
            <Download className="size-4" /> Download all data
          </ButtonLink>
        </Card>

        {pending ? (
          <Card>
            <CardTitle
              title={`Scheduled for deletion on ${formatDate(organization.deletionScheduledFor)}`}
              description="Until then nobody except an Owner can open this organization. After that date everything is permanently removed: documents, accounts, members, files. This can't be undone."
            />
            <CancelDeletion />
          </Card>
        ) : (
          <Card>
            <CardTitle
              title="2. Delete"
              description={`Members lose access straight away. You have ${DELETION_GRACE_DAYS} days to change your mind; after that every record and file of this organization is permanently deleted. Your own login stays, along with your other organizations.`}
            />
            <RequestDeletion legalName={organization.legalName} />
          </Card>
        )}
      </div>
    </>
  );
}
