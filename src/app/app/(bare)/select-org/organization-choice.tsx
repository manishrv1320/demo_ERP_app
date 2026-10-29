"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { switchOrganizationAction } from "@/app/app/actions";

export function OrganizationChoice({ id, children }: { id: string; children: React.ReactNode }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await switchOrganizationAction(id);
          if (result && !result.ok) toast.error(result.message);
        })
      }
      className="flex min-h-16 w-full items-center gap-3 rounded-xl border border-[var(--a-border)] bg-[var(--a-panel)] px-4 text-left transition-colors hover:border-[var(--a-border-strong)] disabled:opacity-60"
    >
      {children}
    </button>
  );
}
