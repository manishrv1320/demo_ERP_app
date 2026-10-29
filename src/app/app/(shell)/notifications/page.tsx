import type { Metadata } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Pagination, pageFrom } from "@/components/ui/data-table";
import { Badge, EmptyState, PageHeader } from "@/components/ui/surface";
import { formatDateTime } from "@/lib/dates";
import { requirePage } from "@/server/auth/context";
import { MarkAllReadButton } from "./mark-all-read";

export const metadata: Metadata = { title: "Notifications" };

const PAGE_SIZE = 30;

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const ctx = await requirePage();
  const page = pageFrom((await searchParams).page);
  const where = { recipientUserId: ctx.user.id };
  const [rows, total, unread] = await Promise.all([
    ctx.db.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { id: true, title: true, body: true, href: true, level: true, readAt: true, createdAt: true },
    }),
    ctx.db.notification.count({ where }),
    ctx.db.notification.count({ where: { ...where, readAt: null } }),
  ]);

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Kept for the number of days set in Settings → Notifications, then removed automatically."
      >
        {unread > 0 && !ctx.readOnly ? <MarkAllReadButton /> : null}
      </PageHeader>
      {rows.length === 0 ? (
        <EmptyState icon={<Bell className="size-6" />} title="No notifications" description="Invitations, approvals and alerts will appear here." />
      ) : (
        <ul className="divide-y divide-[var(--a-border)] overflow-hidden rounded-xl border border-[var(--a-border)] bg-[var(--a-panel)]">
          {rows.map((row) => {
            const content = (
              <div className="flex gap-3 px-4 py-3.5">
                <span
                  className={`mt-1.5 size-2 shrink-0 rounded-full ${row.readAt ? "bg-transparent" : "bg-[var(--accent)]"}`}
                  aria-label={row.readAt ? undefined : "Unread"}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] text-[var(--a-fg-strong)]">
                    {row.title} {row.level === "WARNING" || row.level === "ERROR" ? <Badge tone="warning">Attention</Badge> : null}
                  </p>
                  {row.body ? <p className="mt-0.5 text-[13px] text-[var(--a-muted)]">{row.body}</p> : null}
                  <p className="mt-1 text-[12px] text-[var(--a-subtle)]">{formatDateTime(row.createdAt)}</p>
                </div>
              </div>
            );
            return <li key={row.id}>{row.href ? <Link href={row.href} className="block hover:bg-[var(--a-hover)]">{content}</Link> : content}</li>;
          })}
        </ul>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/app/notifications" />
    </>
  );
}
