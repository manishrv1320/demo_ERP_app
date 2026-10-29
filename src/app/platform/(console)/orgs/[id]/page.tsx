import { notFound } from "next/navigation";
import { Badge, Card, CardTitle, DetailList, PageHeader } from "@/components/ui/surface";
import { formatDate, formatDateTime } from "@/lib/dates";
import { stateName } from "@/lib/gst/states";
import { organizationOverview } from "@/server/platform/console";
import { OrganizationControls } from "./controls";

export default async function PlatformOrganizationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const overview = await organizationOverview(id);
  if (!overview) notFound();
  const { organization, usage, owners, supportVisits } = overview;

  return (
    <>
      <PageHeader title={organization.tradeName || organization.legalName} description={organization.legalName} back={{ href: "/platform", label: "Organizations" }}>
        {organization.status === "ACTIVE" ? <Badge tone="success">Active</Badge> : organization.status === "SUSPENDED" ? <Badge tone="danger">Suspended</Badge> : <Badge tone="warning">Being deleted</Badge>}
      </PageHeader>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle title="Details" />
          <DetailList
            items={[
              { label: "GSTIN", value: organization.gstin },
              { label: "State", value: stateName(organization.stateCode) },
              { label: "City", value: organization.city },
              { label: "Created", value: formatDate(organization.createdAt) },
              { label: "Owners", value: owners.map((owner) => `${owner.name} <${owner.email}>`).join(", ") },
              ...(organization.status === "SUSPENDED"
                ? [{ label: "Suspended", value: `${formatDateTime(organization.suspendedAt)} — ${organization.suspendedReason ?? ""}` }]
                : []),
              ...(organization.status === "PENDING_DELETION" ? [{ label: "Deletion on", value: formatDate(organization.deletionScheduledFor) }] : []),
            ]}
          />
        </Card>
        <Card>
          <CardTitle title="Usage" />
          <DetailList
            items={[
              { label: "Members", value: usage.members },
              { label: "Branches", value: usage.branches },
              { label: "Activity entries", value: usage.activity },
              { label: "Files", value: `${usage.files} (${(usage.fileBytes / 1024 / 1024).toFixed(1)} MB)` },
              { label: "Last activity", value: usage.lastActivityAt ? formatDateTime(usage.lastActivityAt) : "None yet" },
            ]}
          />
        </Card>
        <Card className="lg:col-span-2">
          <CardTitle title="Actions" description="Each one asks for a reason, which goes into the platform audit log." />
          <OrganizationControls organizationId={organization.id} status={organization.status} />
        </Card>
        <Card className="lg:col-span-2">
          <CardTitle title="Support views" description="The last ten, with how many pages were opened in each." />
          {supportVisits.length === 0 ? (
            <p className="text-[13px] text-[var(--a-muted)]">None.</p>
          ) : (
            <ul className="space-y-2 text-[13px]">
              {supportVisits.map((visit) => (
                <li key={visit.id}>
                  {formatDateTime(visit.createdAt)} · {visit.platformAdmin.name} · {visit._count.visits} pages · “{visit.reason}”
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
