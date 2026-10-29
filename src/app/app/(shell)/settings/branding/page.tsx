import type { Metadata } from "next";
import { Card, CardTitle, PageHeader } from "@/components/ui/surface";
import { requirePage } from "@/server/auth/context";
import { BrandingForm, LogoUpload } from "./branding-forms";

export const metadata: Metadata = { title: "Branding" };

export default async function BrandingPage() {
  const ctx = await requirePage("settings.write");
  const organization = await ctx.db.organization.findFirstOrThrow({
    select: { logoFileId: true, accentColor: true, accentColor2: true },
  });
  return (
    <>
      <PageHeader title="Branding" description="Your logo goes on documents; the colours tint the app for everyone in this organization." back={{ href: "/app/settings", label: "Settings" }} />
      <div className="space-y-4">
        <Card>
          <CardTitle title="Logo" description="PNG, JPEG or WebP, up to 1 MB. Stored encrypted on our server." />
          <LogoUpload logoUrl={organization.logoFileId ? `/api/files/${organization.logoFileId}` : null} />
        </Card>
        <Card>
          <CardTitle title="Colours" description="Two accent colours for buttons and highlights." />
          <BrandingForm
            accentColor={organization.accentColor ?? "#5b8cff"}
            accentColor2={organization.accentColor2 ?? "#8b5cf6"}
            custom={Boolean(organization.accentColor || organization.accentColor2)}
          />
        </Card>
      </div>
    </>
  );
}
