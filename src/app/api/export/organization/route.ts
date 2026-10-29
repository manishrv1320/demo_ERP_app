import { todayIST } from "@/lib/dates";
import { can, isOwner } from "@/lib/rbac";
import { logActivity } from "@/server/activity";
import { getAppContext } from "@/server/auth/context";
import { organizationExportStream } from "@/server/db/export";
import { MINUTE, rateLimit } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

/** Everything the organization holds, as a zip. Owners always; others with data.export. */
export async function GET() {
  const result = await getAppContext();
  if (result.status !== "ok") return new Response("Not found", { status: 404 });
  const ctx = result.ctx;
  if (ctx.readOnly || !(isOwner(ctx.role) || can(ctx.role, "data.export"))) return new Response("Not found", { status: 404 });
  if (!rateLimit(`org-export:${ctx.org.id}`, 5, 10 * MINUTE).success) {
    return new Response("Please wait a few minutes before exporting again.", { status: 429 });
  }
  await logActivity(ctx, { action: "data.export", entityType: "Organization", entityId: ctx.org.id, summary: "Full data export downloaded" });
  const slug = ctx.org.name.replace(/[^\w-]+/g, "-").slice(0, 40) || "organization";
  return new Response(organizationExportStream(ctx.org.id), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${slug}-export-${todayIST()}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
