import { Card, PageHeader } from "@/components/ui/surface";
import { platformSettingsRow } from "@/server/platform/console";
import { PlatformEmailForm } from "./email-form";

export default async function PlatformEmailPage() {
  const settings = await platformSettingsRow();
  return (
    <>
      <PageHeader
        title="System email"
        description="Optional, off by default. Sends sign-up codes, password resets and invitations. You type the SMTP password into this form yourself; it's stored encrypted and never shown again."
      />
      <Card>
        <PlatformEmailForm
          hasPassword={Boolean(settings.smtpPasswordEnc)}
          defaults={{
            smtpEnabled: settings.smtpEnabled,
            smtpHost: settings.smtpHost ?? "",
            smtpPort: settings.smtpPort ?? 587,
            smtpSecure: settings.smtpSecure,
            smtpUser: settings.smtpUser ?? "",
            smtpPassword: "",
            smtpFromName: settings.smtpFromName ?? "Hyperzen ERP",
            smtpFromEmail: settings.smtpFromEmail ?? "",
            supportEmail: settings.supportEmail ?? "",
          }}
        />
      </Card>
    </>
  );
}
