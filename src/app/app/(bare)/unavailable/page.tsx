import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/surface";
import { getAppContext } from "@/server/auth/context";
import { getSession } from "@/server/auth/session";
import { listUserOrganizations } from "@/server/db/identity";

export const metadata: Metadata = { title: "Organization unavailable" };

export default async function UnavailablePage() {
  const result = await getAppContext();
  if (result.status !== "unavailable") redirect("/app");
  const session = await getSession();
  const others = session ? (await listUserOrganizations(session.user.id)).filter((org) => org.status === "ACTIVE") : [];

  return (
    <Card>
      <h1 className="text-[20px] font-semibold">
        {result.reason === "suspended" ? `${result.organizationName} is suspended` : `${result.organizationName} is being deleted`}
      </h1>
      <p className="mt-2 text-[14px] leading-relaxed text-[var(--a-muted)]">
        {result.reason === "suspended"
          ? "Hyperzen has suspended access to this organization. Its Owner has been told why and can contact Hyperzen support."
          : "An Owner has scheduled this organization for deletion. Until it's deleted or the Owner cancels, only Owners can open it."}
      </p>
      {others.length > 0 ? (
        <Link href="/app/select-org" className="mt-5 inline-flex min-h-11 items-center text-[14px] text-[var(--accent)]">
          Open another organization →
        </Link>
      ) : null}
    </Card>
  );
}
