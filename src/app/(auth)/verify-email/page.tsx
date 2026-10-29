import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/surface";
import { requireSession } from "@/server/auth/context";
import { maskEmail } from "@/server/sms";
import { LogoutButton } from "../logout-button";
import { VerifyEmailForm } from "./verify-form";

export const metadata: Metadata = { title: "Verify your email" };

export default async function VerifyEmailPage() {
  const session = await requireSession();
  if (session.user.emailVerifiedAt) redirect("/app");
  return (
    <>
      <h1 className="mb-1.5 text-[24px] font-semibold">Check your email</h1>
      <p className="mb-6 text-[14px] text-[var(--a-muted)]">
        We sent a six-digit code to {maskEmail(session.user.email)}. Enter it to finish setting up your account.
      </p>
      <Card>
        <VerifyEmailForm />
      </Card>
      <div className="mt-4 text-center">
        <LogoutButton label="Use a different account" />
      </div>
    </>
  );
}
