import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PolicyView } from "@/components/marketing/policy-view";
import { policyPage } from "@/server/policies";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Privacy Policy" };

/** Public, works without the app — the Play Store listing links here. */
export default async function Page() {
  const policy = await policyPage("privacy");
  if (!policy) notFound();
  return <PolicyView title={policy.title} version={policy.version} versionAt={policy.versionAt} blocks={policy.blocks} />;
}
