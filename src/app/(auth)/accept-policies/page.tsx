import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/surface";
import { safeNextPath } from "@/lib/utils";
import { requireSession } from "@/server/auth/context";
import { outstandingPolicies } from "@/server/policies";
import { LogoutButton } from "../logout-button";
import { AcceptPoliciesButton } from "./accept-button";

export const metadata: Metadata = { title: "Updated terms" };

export default async function AcceptPoliciesPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const session = await requireSession();
  const policies = await outstandingPolicies(session.user.id);
  if (policies.length === 0) redirect(safeNextPath(next));

  return (
    <>
      <h1 className="mb-1.5 text-[24px] font-semibold">Please review our updated terms</h1>
      <p className="mb-6 text-[14px] text-[var(--a-muted)]">To keep using Hyperzen ERP, accept the current version of:</p>
      <Card>
        <ul className="mb-5 space-y-2">
          {policies.map((policy) => (
            <li key={policy.id}>
              <Link
                href={`/${policy.slug}`}
                target="_blank"
                className="inline-flex min-h-11 items-center text-[var(--accent)] underline"
              >
                {policy.title} (version {policy.version})
              </Link>
            </li>
          ))}
        </ul>
        <AcceptPoliciesButton next={next} />
      </Card>
      <div className="mt-4 text-center">
        <LogoutButton />
      </div>
    </>
  );
}
