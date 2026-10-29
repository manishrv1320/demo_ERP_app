import type { Metadata } from "next";
import {
  Bell,
  Building2,
  CalendarRange,
  Hash,
  Mail,
  Palette,
  Receipt,
  ShieldCheck,
  Trash2,
  Users,
  Warehouse,
  Store,
} from "lucide-react";
import { NavList, NavRow, PageHeader } from "@/components/ui/surface";
import { can, isOwner } from "@/lib/rbac";
import { requirePage } from "@/server/auth/context";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ctx = await requirePage(["settings.write", "users.manage", "roles.manage"]);
  const settings = can(ctx.role, "settings.write");
  const icon = (Icon: React.ComponentType<{ className?: string }>) => <Icon className="size-5" />;

  return (
    <>
      <PageHeader title="Settings" description={ctx.org.name} />
      <div className="space-y-6">
        {settings ? (
          <section>
            <h2 className="mb-2 px-1 text-[12px] font-medium uppercase tracking-wide text-[var(--a-subtle)]">Business</h2>
            <NavList>
              <NavRow href="/app/settings/company" icon={icon(Building2)} title="Company profile" description="Legal name, address and contact details" />
              <NavRow href="/app/settings/gst" icon={icon(Receipt)} title="GST" description="Registration type, GSTIN, PAN and state" />
              <NavRow href="/app/settings/branches" icon={icon(Store)} title="Branches" description="Locations, and a GSTIN for each state you're registered in" />
              <NavRow href="/app/settings/warehouses" icon={icon(Warehouse)} title="Warehouses" description="Where stock is kept" />
              <NavRow href="/app/settings/financial-years" icon={icon(CalendarRange)} title="Financial years" description="1 April to 31 March" />
              <NavRow href="/app/settings/number-series" icon={icon(Hash)} title="Number series" description="How invoice and document numbers look, e.g. INV/26-27/0001" />
            </NavList>
          </section>
        ) : null}

        {settings ? (
          <section>
            <h2 className="mb-2 px-1 text-[12px] font-medium uppercase tracking-wide text-[var(--a-subtle)]">Appearance and messages</h2>
            <NavList>
              <NavRow href="/app/settings/branding" icon={icon(Palette)} title="Branding" description="Logo and accent colours" />
              <NavRow href="/app/settings/email" icon={icon(Mail)} title="Email" description="Your own mail server for sending documents (optional)" />
              <NavRow href="/app/settings/notifications" icon={icon(Bell)} title="Notifications" description="How long notifications are kept" />
            </NavList>
          </section>
        ) : null}

        {can(ctx.role, "users.manage") || can(ctx.role, "roles.manage") ? (
          <section>
            <h2 className="mb-2 px-1 text-[12px] font-medium uppercase tracking-wide text-[var(--a-subtle)]">People and access</h2>
            <NavList>
              {can(ctx.role, "users.manage") ? (
                <NavRow href="/app/settings/members" icon={icon(Users)} title="Members" description="Invite people and choose their roles" />
              ) : null}
              {can(ctx.role, "roles.manage") ? (
                <NavRow href="/app/settings/roles" icon={icon(ShieldCheck)} title="Roles" description="What each role can see and do" />
              ) : null}
            </NavList>
          </section>
        ) : null}

        {isOwner(ctx.role) ? (
          <section>
            <NavList>
              <NavRow href="/app/settings/delete-organization" icon={icon(Trash2)} title="Delete organization" description="Export your data, then delete everything after a 30-day grace period" />
            </NavList>
          </section>
        ) : null}
      </div>
    </>
  );
}
