import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui/surface";
import { requirePage } from "@/server/auth/context";
import { RetentionForm } from "./retention-form";

export const metadata: Metadata = { title: "Notification settings" };

export default async function NotificationSettingsPage() {
  const ctx = await requirePage("settings.write");
  const settings = await ctx.db.organizationSettings.findFirstOrThrow({ select: { notificationRetentionDays: true } });
  return (
    <>
      <PageHeader
        title="Notifications"
        description="Notifications older than this are deleted automatically. The activity log is never deleted — accounting rules require an audit trail that can't be switched off."
        back={{ href: "/app/settings", label: "Settings" }}
      />
      <Card>
        <RetentionForm days={settings.notificationRetentionDays} />
      </Card>
    </>
  );
}
