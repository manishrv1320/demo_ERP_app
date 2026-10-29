import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/surface";
import { safeNextPath } from "@/lib/utils";
import { getSession } from "@/server/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; deleted?: string }> }) {
  const { next, deleted } = await searchParams;
  if (await getSession()) redirect(safeNextPath(next));
  return (
    <>
      <h1 className="mb-1.5 text-[24px] font-semibold">Sign in</h1>
      <p className="mb-6 text-[14px] text-[var(--a-muted)]">Welcome back. Use the email you signed up with.</p>
      {deleted ? (
        <p className="mb-4 rounded-lg border border-[var(--a-border)] bg-[var(--a-panel)] px-4 py-3 text-[13.5px]" role="status">
          Your account is scheduled for deletion on {deleted.slice(0, 40)}. Sign in before then to cancel.
        </p>
      ) : null}
      <Card>
        <LoginForm next={next} />
      </Card>
    </>
  );
}
