import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/surface";
import { requireSession } from "@/server/auth/context";
import { listUserOrganizations } from "@/server/db/identity";
import { OrganizationChoice } from "./organization-choice";

export const metadata: Metadata = { title: "Choose an organization" };

export default async function SelectOrganizationPage() {
  const session = await requireSession();
  const organizations = await listUserOrganizations(session.user.id);
  if (organizations.length === 0) redirect("/app/onboarding");

  return (
    <>
      <h1 className="mb-1.5 text-[24px] font-semibold">Choose an organization</h1>
      <p className="mb-6 text-[14px] text-[var(--a-muted)]">You can switch any time from the top of the screen.</p>
      <ul className="space-y-2">
        {organizations.map((organization) => (
          <li key={organization.id}>
            <OrganizationChoice id={organization.id}>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium text-[var(--a-fg-strong)]">{organization.name}</span>
                <span className="block text-[12.5px] text-[var(--a-muted)]">{organization.roleName}</span>
              </span>
              {organization.status !== "ACTIVE" ? (
                <Badge tone="warning">{organization.status === "SUSPENDED" ? "Suspended" : "Being deleted"}</Badge>
              ) : null}
            </OrganizationChoice>
          </li>
        ))}
      </ul>
      <Link
        href="/app/onboarding"
        className="mt-3 flex min-h-14 items-center gap-2 rounded-xl border border-dashed border-[var(--a-border-strong)] px-4 text-[14px] text-[var(--a-fg)] hover:bg-[var(--a-hover)]"
      >
        <Plus className="size-4" /> Start a new organization
      </Link>
    </>
  );
}
