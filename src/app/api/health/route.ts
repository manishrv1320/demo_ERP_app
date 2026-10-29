import { globalDb } from "@/server/db/global";

export const dynamic = "force-dynamic";

/** Container health check: the app is up and can reach its database. */
export async function GET() {
  try {
    await globalDb.platformSettings.findFirst({ select: { id: true } });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
