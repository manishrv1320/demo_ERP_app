"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm, type DefaultValues, type FieldValues, type Path } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import type { ActionResult } from "@/lib/utils";
import { cn } from "@/lib/utils";

/**
 * react-hook-form + the same Zod schema the server action re-checks. The
 * server's field errors land on the matching inputs; the result's message
 * shows as a toast.
 */
export function useActionForm<S extends z.ZodTypeAny, R>(options: {
  schema: S;
  defaultValues: DefaultValues<z.input<S> & FieldValues>;
  action: (input: z.input<S>) => Promise<ActionResult<R>>;
  onSuccess?: (result: { message?: string; data?: R }) => void;
  /** Refresh server components after a successful save (default true). */
  refresh?: boolean;
  successMessage?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<z.input<S> & FieldValues>({
    resolver: zodResolver(options.schema),
    defaultValues: options.defaultValues,
  });

  const submit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await options.action(values as z.input<S>);
      if (!result.ok) {
        setFormError(result.message);
        for (const [field, message] of Object.entries(result.errors ?? {})) {
          form.setError(field as Path<z.input<S> & FieldValues>, { message });
        }
        toast.error(result.message);
        return;
      }
      const message = result.message ?? options.successMessage;
      if (message) toast.success(message);
      if (options.refresh !== false) router.refresh();
      options.onSuccess?.(result);
    });
  });

  return { form, submit, pending, formError };
}

/** The error message react-hook-form holds for a field, if any. */
export function errorOf(errors: Record<string, unknown>, name: string): string | undefined {
  const value = name.split(".").reduce<unknown>((acc, key) => (acc as Record<string, unknown> | undefined)?.[key], errors);
  return (value as { message?: string } | undefined)?.message;
}

/**
 * Save / cancel buttons. On phones they stick to the bottom of the screen,
 * above the tab bar, so the primary action is always in reach.
 */
export function StickyActions({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <>
      <div className="h-20 md:hidden" aria-hidden />
      <div
        className={cn(
          "fixed inset-x-0 z-30 flex items-center justify-end gap-2 border-t border-[var(--a-border)] bg-[color-mix(in_oklab,var(--a-bg)_92%,transparent)] px-4 py-3 backdrop-blur",
          "bottom-[var(--tabbar-height)]",
          "md:static md:mt-6 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none",
          className,
        )}
      >
        {children}
      </div>
    </>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-lg border border-[color-mix(in_oklab,var(--a-danger)_35%,transparent)] bg-[color-mix(in_oklab,var(--a-danger)_10%,transparent)] px-3 py-2 text-[13px] text-[var(--a-danger)]"
    >
      {message}
    </p>
  );
}
