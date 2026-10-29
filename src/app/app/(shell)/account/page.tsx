import type { Metadata } from "next";
import { Download } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardTitle, PageHeader } from "@/components/ui/surface";
import { formatDateTime } from "@/lib/dates";
import { requireAppContext, requireSession } from "@/server/auth/context";
import { globalDb } from "@/server/db/global";
import { soleOwnerships } from "@/server/db/identity";
import { DELETION_GRACE_DAYS } from "@/server/deletion";
import { DeleteAccount, DeviceList, PasswordForm, ProfileForm } from "./account-forms";

export const metadata: Metadata = { title: "Your account" };

function describeDevice(userAgent: string | null, isApp: boolean): string {
  if (isApp) return "Hyperzen ERP app (Android)";
  if (!userAgent) return "Unknown device";
  const browser = /Edg\//.test(userAgent) ? "Edge" : /Chrome\//.test(userAgent) ? "Chrome" : /Firefox\//.test(userAgent) ? "Firefox" : /Safari\//.test(userAgent) ? "Safari" : "Browser";
  const os = /Android/.test(userAgent) ? "Android" : /iPhone|iPad/.test(userAgent) ? "iOS" : /Windows/.test(userAgent) ? "Windows" : /Mac OS/.test(userAgent) ? "macOS" : /Linux/.test(userAgent) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}

export default async function AccountPage() {
  const ctx = await requireAppContext();
  if (ctx.readOnly) {
    return <PageHeader title="Your account" description="Not available in the support view." />;
  }
  const session = await requireSession();
  const [user, sessions, owned] = await Promise.all([
    globalDb.user.findUniqueOrThrow({ where: { id: session.user.id }, select: { name: true, phone: true, email: true } }),
    globalDb.session.findMany({
      where: { userId: session.user.id, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: "desc" },
      select: { id: true, userAgent: true, isApp: true, ip: true, lastSeenAt: true },
    }),
    soleOwnerships(session.user.id),
  ]);

  return (
    <>
      <PageHeader title="Your account" description={user.email} />
      <div className="space-y-4">
        <Card>
          <CardTitle title="Profile" />
          <ProfileForm defaults={{ name: user.name, phone: user.phone ?? "" }} />
        </Card>
        <Card>
          <CardTitle title="Password" description="Changing it signs out every other device." />
          <PasswordForm />
        </Card>
        <Card>
          <CardTitle title="Signed-in devices" />
          <DeviceList
            devices={sessions.map((row) => ({
              id: row.id,
              label: describeDevice(row.userAgent, row.isApp),
              detail: `${row.ip ?? "unknown network"} · last active ${formatDateTime(row.lastSeenAt)}`,
              current: row.id === session.id,
            }))}
          />
        </Card>
        <Card>
          <CardTitle title="Your data" description="Your profile, memberships, policy acceptances and signed-in devices as a JSON file." />
          <ButtonLink href="/api/export/account" variant="secondary" prefetch={false}>
            <Download className="size-4" /> Download my data
          </ButtonLink>
        </Card>
        <Card>
          <CardTitle
            title="Delete my account"
            description={`You're signed out everywhere. Sign in within ${DELETION_GRACE_DAYS} days to cancel; after that your personal details are erased. Documents you created stay with each organization as "Deleted user".`}
          />
          <DeleteAccount
            blockers={owned.filter((org) => org.othersRemain).map((org) => org.name)}
            alsoDeleted={owned.filter((org) => !org.othersRemain).map((org) => org.name)}
          />
        </Card>
      </div>
    </>
  );
}
