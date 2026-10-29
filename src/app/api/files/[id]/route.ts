import { can, type Capability } from "@/lib/rbac";
import { getAppContext } from "@/server/auth/context";
import { readOrganizationFile } from "@/server/files/storage";

export const dynamic = "force-dynamic";

/** Who may download each kind of private file. A logo is visible to every member. */
const CATEGORY_CAPABILITY: Record<string, Capability | null> = {
  LOGO: null,
  RECEIPT: "accounts.read",
  ATTACHMENT: null,
  BANK_STATEMENT: "accounts.read",
  PAYSLIP: "payroll.read",
};

/**
 * Private files, decrypted on the way out. The tenant client means another
 * organization's file id simply isn't found, and the storage layer refuses a
 * path outside this organization's folder.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const result = await getAppContext();
  if (result.status !== "ok") return new Response("Not found", { status: 404 });
  const ctx = result.ctx;
  const { id } = await params;
  if (id.length > 40) return new Response("Not found", { status: 404 });

  const file = await ctx.db.storedFile.findUnique({ where: { id } });
  if (!file) return new Response("Not found", { status: 404 });
  const capability = CATEGORY_CAPABILITY[file.category];
  if (capability && !can(ctx.role, capability)) return new Response("Not found", { status: 404 });

  const bytes = await readOrganizationFile(ctx.org.id, file.storagePath);
  if (!bytes) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `inline; filename="${encodeURIComponent(file.originalName)}"`,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
