import { todayIST } from "@/lib/dates";
import { getSession } from "@/server/auth/session";
import { globalDb } from "@/server/db/global";
import { listUserOrganizations } from "@/server/db/identity";

export const dynamic = "force-dynamic";

/** "Download my data": the signed-in person's own account data, as JSON. */
export async function GET() {
  const session = await getSession();
  if (!session) return new Response("Not found", { status: 404 });
  const [user, organizations, acceptances, sessions] = await Promise.all([
    globalDb.user.findUniqueOrThrow({
      where: { id: session.user.id },
      select: { name: true, email: true, phone: true, emailVerifiedAt: true, createdAt: true, lastLoginAt: true, passwordChangedAt: true },
    }),
    listUserOrganizations(session.user.id),
    globalDb.policyAcceptance.findMany({
      where: { userId: session.user.id },
      select: { version: true, acceptedAt: true, ip: true, policy: { select: { title: true } } },
    }),
    globalDb.session.findMany({
      where: { userId: session.user.id },
      select: { createdAt: true, lastSeenAt: true, expiresAt: true, ip: true, userAgent: true, isApp: true },
    }),
  ]);
  const body = JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      account: user,
      organizations: organizations.map((org) => ({ name: org.name, role: org.roleName, status: org.status })),
      policyAcceptances: acceptances.map((row) => ({ policy: row.policy.title, version: row.version, acceptedAt: row.acceptedAt, ip: row.ip })),
      signedInDevices: sessions,
    },
    null,
    2,
  );
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="hyperzen-erp-my-data-${todayIST()}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
