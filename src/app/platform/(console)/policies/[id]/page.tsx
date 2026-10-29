import { notFound } from "next/navigation";
import { Card, PageHeader } from "@/components/ui/surface";
import { listPolicies } from "@/server/platform/console";
import { PolicyEditor } from "./policy-editor";

export default async function PolicyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const policy = (await listPolicies()).find((item) => item.id === id);
  if (!policy) notFound();
  return (
    <>
      <PageHeader title={policy.title} description={`Version ${policy.version} · /${policy.slug}`} back={{ href: "/platform/policies", label: "Policies" }} />
      <Card>
        <PolicyEditor key={`${policy.id}-${policy.version}`} id={policy.id} title={policy.title} content={policy.content} />
      </Card>
    </>
  );
}
