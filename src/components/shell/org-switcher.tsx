"use client";

import Link from "next/link";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { switchOrganizationAction } from "@/app/app/actions";
import { cn } from "@/lib/utils";

export type SwitcherOrganization = { id: string; name: string; roleName: string };

export function OrgSwitcher({
  current,
  organizations,
  disabled,
  compact,
}: {
  current: { id: string; name: string; logoUrl: string | null };
  organizations: SwitcherOrganization[];
  disabled?: boolean;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const logo = current.logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- private, authenticated image route
    <img src={current.logoUrl} alt="" className="size-7 shrink-0 rounded-md object-contain" />
  ) : (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[var(--a-active)] text-[12px] font-semibold">
      {current.name.slice(0, 1).toUpperCase()}
    </span>
  );

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled || pending}
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex w-full min-w-0 items-center gap-2.5 rounded-lg text-left transition-colors hover:bg-[var(--a-hover)] disabled:cursor-default disabled:hover:bg-transparent",
          compact ? "min-h-11 px-1.5" : "border border-[var(--a-border)] px-2.5 py-2",
        )}
      >
        {logo}
        <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-[var(--a-fg-strong)] md:text-[13.5px]">
          {current.name}
        </span>
        {disabled ? null : <ChevronsUpDown className="size-4 shrink-0 text-[var(--a-subtle)]" />}
      </button>

      {open ? (
        <div className="absolute left-0 z-50 mt-1.5 w-[min(88vw,300px)] overflow-hidden rounded-xl border border-[var(--a-border-strong)] bg-[var(--a-elevated)] shadow-xl">
          <p className="px-3 pt-3 pb-1.5 text-[11.5px] font-medium uppercase tracking-wide text-[var(--a-subtle)]">
            Organizations
          </p>
          <ul role="listbox" className="max-h-72 overflow-y-auto pb-1">
            {organizations.map((organization) => (
              <li key={organization.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={organization.id === current.id}
                  className="flex min-h-12 w-full items-center gap-2 px-3 text-left hover:bg-[var(--a-hover)] md:min-h-10"
                  onClick={() => {
                    setOpen(false);
                    if (organization.id === current.id) return;
                    start(async () => {
                      const result = await switchOrganizationAction(organization.id);
                      if (result && !result.ok) toast.error(result.message);
                    });
                  }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] text-[var(--a-fg-strong)]">{organization.name}</span>
                    <span className="block text-[12px] text-[var(--a-muted)]">{organization.roleName}</span>
                  </span>
                  {organization.id === current.id ? <Check className="size-4 text-[var(--accent)]" /> : null}
                </button>
              </li>
            ))}
          </ul>
          <Link
            href="/app/onboarding"
            onClick={() => setOpen(false)}
            className="flex min-h-12 items-center gap-2 border-t border-[var(--a-border)] px-3 text-[13.5px] text-[var(--a-fg)] hover:bg-[var(--a-hover)] md:min-h-10"
          >
            <Plus className="size-4" /> New organization
          </Link>
        </div>
      ) : null}
    </div>
  );
}
