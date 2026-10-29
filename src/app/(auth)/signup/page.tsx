import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/surface";
import { getSession } from "@/server/auth/session";
import { SignUpForm } from "./signup-form";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignUpPage() {
  if (await getSession()) redirect("/app");
  return (
    <>
      <h1 className="mb-1.5 text-[24px] font-semibold">Create your account</h1>
      <p className="mb-6 text-[14px] text-[var(--a-muted)]">
        One login for all your businesses. You can add more organizations and invite your team later.
      </p>
      <Card>
        <SignUpForm />
      </Card>
    </>
  );
}
