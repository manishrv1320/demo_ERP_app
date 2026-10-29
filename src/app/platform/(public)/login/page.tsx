import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/shell/brand";
import { Card } from "@/components/ui/surface";
import { getPlatformAdmin } from "@/server/platform/session";
import { PlatformLoginForm } from "./login-form";

export const metadata: Metadata = { title: "Platform console", robots: { index: false, follow: false } };

export default async function PlatformLoginPage() {
  if (await getPlatformAdmin()) redirect("/platform");
  return (
    <div className="pt-safe mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      <div className="mb-6 flex items-center gap-2.5">
        <BrandMark />
        <span className="text-[15px] font-semibold">Hyperzen platform console</span>
      </div>
      <Card>
        <p className="mb-4 text-[13px] text-[var(--a-muted)]">For Hyperzen staff only. Company logins don&apos;t work here.</p>
        <PlatformLoginForm />
      </Card>
    </div>
  );
}
