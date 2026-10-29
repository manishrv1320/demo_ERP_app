import { toCsv } from "@/lib/csv";
import { todayIST } from "@/lib/dates";
import { can, type Capability } from "@/lib/rbac";
import { getAppContext, type AppContext } from "@/server/auth/context";
import { activityWhere, memberWhere } from "@/server/lists";

export const dynamic = "force-dynamic";

/**
 * CSV for a list, with the list's own filters (?q=…). Needs data.export plus
 * the list's own capability. Each list is capped so one request stays light on
 * the shared server; the full data export has everything.
 */
const MAX_ROWS = 50_000;

type Exporter = { capability: Capability; build: (ctx: AppContext, q?: string) => Promise<{ header: string[]; rows: unknown[][] }> };

const EXPORTS: Record<string, Exporter> = {
  activity: {
    capability: "activity.read",
    async build(ctx, q) {
      const rows = await ctx.db.activityLog.findMany({
        where: activityWhere(q),
        orderBy: { createdAt: "desc" },
        take: MAX_ROWS,
        select: { createdAt: true, actorName: true, action: true, entityType: true, entityId: true, summary: true, ip: true },
      });
      return {
        header: ["When (UTC)", "Who", "Action", "Record type", "Record id", "Summary", "IP address"],
        rows: rows.map((row) => [row.createdAt, row.actorName, row.action, row.entityType, row.entityId, row.summary, row.ip]),
      };
    },
  },
  members: {
    capability: "users.manage",
    async build(ctx, q) {
      const rows = await ctx.db.membership.findMany({
        where: memberWhere(q),
        orderBy: { joinedAt: "asc" },
        take: MAX_ROWS,
        select: { joinedAt: true, user: { select: { name: true, email: true, phone: true } }, role: { select: { name: true } } },
      });
      return {
        header: ["Name", "Email", "Phone", "Role", "Joined (UTC)"],
        rows: rows.map((row) => [row.user.name, row.user.email, row.user.phone, row.role.name, row.joinedAt]),
      };
    },
  },
};

export async function GET(request: Request, { params }: { params: Promise<{ list: string }> }) {
  const result = await getAppContext();
  if (result.status !== "ok") return new Response("Not found", { status: 404 });
  const ctx = result.ctx;
  const { list } = await params;
  const exporter = EXPORTS[list];
  if (!exporter || !can(ctx.role, "data.export") || !can(ctx.role, exporter.capability)) {
    return new Response("Not found", { status: 404 });
  }
  const q = new URL(request.url).searchParams.get("q")?.trim().slice(0, 100) || undefined;
  const { header, rows } = await exporter.build(ctx, q);
  return new Response(toCsv(header, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${list}-${todayIST()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
