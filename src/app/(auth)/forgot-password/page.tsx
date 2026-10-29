import type { Metadata } from "next";
import { Card } from "@/components/ui/surface";
import { ResetFlow } from "./reset-flow";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="mb-1.5 text-[24px] font-semibold">Reset your password</h1>
      <p className="mb-6 text-[14px] text-[var(--a-muted)]">We&apos;ll send a six-digit code to confirm it&apos;s you.</p>
      <Card>
        <ResetFlow />
      </Card>
    </>
  );
}
