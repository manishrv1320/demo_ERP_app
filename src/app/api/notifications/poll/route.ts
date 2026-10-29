import { getAppContext } from "@/server/auth/context";
import { purgeExpiredNotifications } from "@/server/notifications";

export const dynamic = "force-dynamic";

/** The bell's poll: unread count and the latest few. Also runs the hourly retention purge. */
export async function GET() {
  const result = await getAppContext();
  if (result.status !== "ok" || result.ctx.readOnly) return Response.json({ unread: 0, items: [] }, { status: 401 });
  const { db, user } = result.ctx;

  await purgeExpiredNotifications(db).catch((error) => console.error("[notifications] purge failed:", error));

  const [unread, items] = await Promise.all([
    db.notification.count({ where: { recipientUserId: user.id, readAt: null } }),
    db.notification.findMany({
      where: { recipientUserId: user.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, title: true, body: true, href: true, level: true, createdAt: true, readAt: true },
    }),
  ]);
  return Response.json({ unread, items }, { headers: { "Cache-Control": "no-store" } });
}
