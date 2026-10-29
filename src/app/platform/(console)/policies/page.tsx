import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/surface";
import { formatDate } from "@/lib/dates";
import { activePolicies } from "@/server/policies";
import { listPolicies } from "@/server/platform/console";

export default async function PoliciesPage() {
  await activePolicies(); // creates the defaults on first visit
  const policies = await listPolicies();
  return (
    <>
      <PageHeader
        title="Policies"
        description="Terms and Privacy, shown at /terms and /privacy. Publishing a new version asks every user to accept it again."
      />
      <DataTable
        rows={policies}
        rowKey={(row) => row.id}
        rowHref={(row) => `/platform/policies/${row.id}`}
        columns={[
          { key: "title", header: "Policy", cell: (row) => row.title, mobile: "title" },
          { key: "slug", header: "Address", cell: (row) => `/${row.slug}`, mobile: "subtitle" },
          { key: "version", header: "Version", cell: (row) => row.version, align: "right", mobile: "value" },
          { key: "date", header: "Published", cell: (row) => formatDate(row.versionAt), mobile: "line" },
        ]}
      />
    </>
  );
}
