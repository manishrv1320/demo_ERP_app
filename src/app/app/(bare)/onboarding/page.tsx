import type { Metadata } from "next";
import { Card } from "@/components/ui/surface";
import { requireSession } from "@/server/auth/context";
import { listUserOrganizations } from "@/server/db/identity";
import { CreateOrganizationForm } from "./create-form";

export const metadata: Metadata = { title: "New organization" };

export default async function OnboardingPage() {
  const session = await requireSession();
  const existing = await listUserOrganizations(session.user.id);
  return (
    <>
      <h1 className="mb-1.5 text-[24px] font-semibold">{existing.length ? "Start another organization" : "Set up your business"}</h1>
      <p className="mb-6 text-[14px] text-[var(--a-muted)]">
        {existing.length
          ? "Each organization has its own books, GSTIN, team and settings. You'll be its Owner."
          : "You aren't a member of any organization yet. Start your own, or ask your employer to invite you."}
      </p>
      <Card>
        <CreateOrganizationForm />
      </Card>
    </>
  );
}
