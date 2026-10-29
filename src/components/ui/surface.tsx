import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  back,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  back?: { href: string; label: string };
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 md:mb-6 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {back ? (
          <Link
            href={back.href}
            className="mb-2 inline-flex min-h-10 items-center text-[13px] text-[var(--a-muted)] hover:text-[var(--a-fg)] md:min-h-0"
          >
            ← {back.label}
          </Link>
        ) : null}
        <h1 className="text-[21px] font-semibold tracking-tight md:text-[22px]">{title}</h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-[var(--a-muted)]">{description}</p>
        ) : null}
      </div>
      {children ? <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

export function Card({
  className,
  children,
  padded = true,
}: {
  className?: string;
  children: React.ReactNode;
  padded?: boolean;
}) {
  return (
    <div className={cn("rounded-xl border border-[var(--a-border)] bg-[var(--a-panel)]", padded && "p-4 md:p-5", className)}>
      {children}
    </div>
  );
}

export function CardTitle({
  title,
  description,
  action,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-[15px] font-medium">{title}</h2>
        {description ? <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--a-muted)]">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-[var(--a-border-strong)] px-6 py-10 text-center">
      {icon ? <div className="mb-3 text-[var(--a-muted)]">{icon}</div> : null}
      <p className="text-[14.5px] font-medium text-[var(--a-fg-strong)]">{title}</p>
      {description ? <p className="mt-1.5 max-w-sm text-[13px] text-[var(--a-muted)]">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

const badgeTones = {
  neutral: "bg-[var(--a-hover)] text-[var(--a-muted)] border-[var(--a-border)]",
  accent: "bg-[color-mix(in_oklab,var(--accent)_14%,transparent)] text-[var(--accent)] border-[color-mix(in_oklab,var(--accent)_30%,transparent)]",
  success: "bg-[color-mix(in_oklab,var(--a-success)_14%,transparent)] text-[var(--a-success)] border-[color-mix(in_oklab,var(--a-success)_30%,transparent)]",
  warning: "bg-[color-mix(in_oklab,var(--a-warning)_14%,transparent)] text-[var(--a-warning)] border-[color-mix(in_oklab,var(--a-warning)_30%,transparent)]",
  danger: "bg-[color-mix(in_oklab,var(--a-danger)_14%,transparent)] text-[var(--a-danger)] border-[color-mix(in_oklab,var(--a-danger)_30%,transparent)]",
};

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof badgeTones; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11.5px] font-medium", badgeTones[tone])}>
      {children}
    </span>
  );
}

/** A tappable row for hub pages (settings, "More") — big on phones, compact on desktop. */
export function NavRow({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon?: React.ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--a-hover)] md:min-h-0"
    >
      {icon ? <span className="text-[var(--a-muted)]">{icon}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-medium text-[var(--a-fg-strong)] md:text-[14px]">{title}</span>
        {description ? <span className="mt-0.5 block text-[12.5px] text-[var(--a-muted)]">{description}</span> : null}
      </span>
      <ChevronRight className="size-4 shrink-0 text-[var(--a-subtle)]" aria-hidden />
    </Link>
  );
}

export function NavList({ children }: { children: React.ReactNode }) {
  return (
    <div className="divide-y divide-[var(--a-border)] overflow-hidden rounded-xl border border-[var(--a-border)] bg-[var(--a-panel)]">
      {children}
    </div>
  );
}

/** Label/value pairs, two columns on desktop. */
export function DetailList({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-[12px] text-[var(--a-muted)]">{item.label}</dt>
          <dd className="mt-0.5 break-words text-[14px] text-[var(--a-fg)]">{item.value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
