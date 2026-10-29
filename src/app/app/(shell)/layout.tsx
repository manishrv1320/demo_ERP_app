import { ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { navigationFor } from "@/components/shell/nav";
import { formatDate, formatDateTime } from "@/lib/dates";
import { sanitizeColor } from "@/lib/utils";
import { requireAppContext } from "@/server/auth/context";
import { listUserOrganizations } from "@/server/db/identity";
import { endSupportViewAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireAppContext();
  const organizations =
    ctx.kind === "member"
      ? (await listUserOrganizations(ctx.user.id)).map((org) => ({ id: org.id, name: org.name, roleName: org.roleName }))
      : [{ id: ctx.org.id, name: ctx.org.name, roleName: "Support view (read-only)" }];
  const nav = navigationFor(ctx.role);

  // Per-organization accent colours, validated before they reach CSS.
  const accent = sanitizeColor(ctx.org.accentColor);
  const accent2 = sanitizeColor(ctx.org.accentColor2);
  const accentCss = accent || accent2 ? `:root{${accent ? `--accent:${accent};` : ""}${accent2 ? `--accent-2:${accent2};` : ""}}` : null;

  const banner = ctx.support ? (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-[var(--a-warning)] px-4 py-2 text-[13px] font-medium text-black">
      <ShieldAlert className="size-4" />
      <span className="flex-1">
        Support view of {ctx.org.name} — read-only. Every page you open is logged. Ends {formatDateTime(ctx.support.expiresAt)}.
      </span>
      <form action={endSupportViewAction}>
        <button type="submit" className="min-h-9 rounded-md bg-black/15 px-3 hover:bg-black/25">
          End support view
        </button>
      </form>
    </div>
  ) : ctx.org.status === "PENDING_DELETION" ? (
    <div className="bg-[var(--a-danger)] px-4 py-2 text-[13px] font-medium text-white">
      {ctx.org.name} will be deleted on {formatDate(ctx.org.deletionScheduledFor)}. Members can&apos;t sign in to it until
      you cancel.
    </div>
  ) : null;

  return (
    <>
      {accentCss ? <style>{accentCss}</style> : null}
      <AppShell
        organization={{ id: ctx.org.id, name: ctx.org.name, logoUrl: ctx.org.logoFileId ? `/api/files/${ctx.org.logoFileId}` : null }}
        organizations={organizations}
        user={{ name: ctx.user.name, email: ctx.user.email }}
        sidebar={nav.sidebar}
        tabs={nav.tabs}
        readOnly={ctx.readOnly}
        banner={banner}
      >
        {children}
      </AppShell>
    </>
  );
}
