import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui/surface";
import { requirePage } from "@/server/auth/context";
import { SmtpForm } from "./smtp-form";

export const metadata: Metadata = { title: "Email" };

export default async function EmailSettingsPage() {
  const ctx = await requirePage("settings.write");
  const settings = await ctx.db.organizationSettings.findFirstOrThrow();
  return (
    <>
      <PageHeader
        title="Email"
        description="Optional. Connect your own mail server (SMTP) to email invoices and statements to customers from your address. Off until you turn it on."
        back={{ href: "/app/settings", label: "Settings" }}
      />
      <Card>
        <SmtpForm
          key={settings.version}
          hasPassword={Boolean(settings.smtpPasswordEnc)}
          defaults={{
            smtpEnabled: settings.smtpEnabled,
            smtpHost: settings.smtpHost ?? "",
            smtpPort: settings.smtpPort ?? 587,
            smtpSecure: settings.smtpSecure,
            smtpUser: settings.smtpUser ?? "",
            smtpPassword: "",
            smtpFromName: settings.smtpFromName ?? ctx.org.name,
            smtpFromEmail: settings.smtpFromEmail ?? "",
          }}
        />
      </Card>
    </>
  );
}
