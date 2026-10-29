import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { Card, CardTitle, EmptyState, PageHeader } from "@/components/ui/surface";
import { relativeTime } from "@/lib/dates";
import { can } from "@/lib/rbac";
import { requirePage } from "@/server/auth/context";

export const metadata: Metadata = { title: "Home" };

export default async function DashboardPage() {
  const ctx = await requirePage();
  const canSettings = can(ctx.role, "settings.write");
  const canMembers = can(ctx.role, "users.manage");
  const canActivity = can(ctx.role, "activity.read");

  const [organization, memberCount, activity] = await Promise.all([
    ctx.db.organization.findFirst({
      select: { addressLine1: true, pincode: true, gstin: true, gstRegistration: true, logoFileId: true, accentColor: true },
    }),
    ctx.db.membership.count({ where: { status: "ACTIVE" } }),
    canActivity
      ? ctx.db.activityLog.findMany({
          orderBy: { createdAt: "desc" },
          take: 6,
          select: { id: true, actorName: true, summary: true, createdAt: true },
        })
      : Promise.resolve([]),
  ]);

  const steps = [
    canSettings && {
      done: Boolean(organization?.addressLine1 && organization?.pincode),
      title: "Add your company's address",
      description: "It appears on every invoice and document.",
      href: "/app/settings/company",
    },
    canSettings && {
      done: Boolean(organization?.gstin) || organization?.gstRegistration === "UNREGISTERED",
      title: "Set up GST",
      description: organization?.gstin ? "GSTIN saved." : "Add your GSTIN, or confirm you're not registered.",
      href: "/app/settings/gst",
    },
    canSettings && {
      done: Boolean(organization?.logoFileId || organization?.accentColor),
      title: "Add your logo and colours",
      description: "Make documents and the app look like your business.",
      href: "/app/settings/branding",
    },
    canMembers && {
      done: memberCount > 1,
      title: "Invite your team",
      description: "Give each person a role — Accountant, Sales, Storekeeper and more.",
      href: "/app/settings/members",
    },
  ].filter(Boolean) as { done: boolean; title: string; description: string; href: string }[];

  const firstName = ctx.user.name.split(" ")[0];

  return (
    <>
      <PageHeader title={`Hello, ${firstName}`} description={`${ctx.org.name} · ${ctx.role.name}`} />

      <div className="grid gap-4 lg:grid-cols-5">
        {steps.length > 0 ? (
          <Card className="lg:col-span-3">
            <CardTitle
              title="Get set up"
              description={`${steps.filter((step) => step.done).length} of ${steps.length} done`}
            />
            <ul className="-mx-2 space-y-0.5">
              {steps.map((step) => (
                <li key={step.href}>
                  <Link href={step.href} className="flex min-h-14 items-start gap-3 rounded-lg px-2 py-2.5 hover:bg-[var(--a-hover)]">
                    {step.done ? (
                      <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[var(--a-success)]" />
                    ) : (
                      <Circle className="mt-0.5 size-5 shrink-0 text-[var(--a-subtle)]" />
                    )}
                    <span>
                      <span className="block text-[14px] font-medium text-[var(--a-fg-strong)]">{step.title}</span>
                      <span className="block text-[12.5px] text-[var(--a-muted)]">{step.description}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        ) : (
          <Card className="lg:col-span-3">
            <CardTitle title={`Welcome to ${ctx.org.name}`} description={`You're signed in as ${ctx.role.name}.`} />
            <p className="text-[13.5px] text-[var(--a-muted)]">
              Your role decides which areas you see. Ask an Owner of {ctx.org.name} if you need access to more.
            </p>
          </Card>
        )}

        {canActivity ? (
          <Card className="lg:col-span-2">
            <CardTitle
              title="Recent activity"
              action={
                <Link href="/app/activity" className="inline-flex min-h-10 items-center text-[12.5px] text-[var(--accent)]">
                  View all
                </Link>
              }
            />
            {activity.length === 0 ? (
              <EmptyState title="Nothing yet" description="Changes people make will show up here." />
            ) : (
              <ul className="space-y-3">
                {activity.map((entry) => (
                  <li key={entry.id} className="text-[13px]">
                    <p className="text-[var(--a-fg)]">{entry.summary}</p>
                    <p className="text-[12px] text-[var(--a-muted)]">
                      {entry.actorName} · {relativeTime(entry.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : null}
      </div>
    </>
  );
}
