"use client";

import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

/** Label + control + hint/error, wired up for screen readers. */
export function Field({
  label,
  hint,
  error,
  className,
  children,
  htmlFor,
  required,
}: {
  label: string;
  hint?: React.ReactNode;
  error?: string;
  className?: string;
  children: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <label className="a-label" htmlFor={htmlFor}>
        {label}
        {required ? <span className="text-[var(--a-danger)]"> *</span> : null}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-[12.5px] text-[var(--a-danger)]" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-[12.5px] text-[var(--a-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className, invalid, ...props }, ref) {
    return <input ref={ref} className={cn("a-input", className)} aria-invalid={invalid || undefined} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(
  function Select({ className, invalid, children, ...props }, ref) {
    return (
      <select ref={ref} className={cn("a-input pr-8", className)} aria-invalid={invalid || undefined} {...props}>
        {children}
      </select>
    );
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ className, invalid, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn("a-input min-h-24 py-2.5 leading-relaxed", className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
});

/** A checkbox with its label, sized for touch. */
export const Checkbox = forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & { label: React.ReactNode; description?: React.ReactNode }
>(function Checkbox({ label, description, className, id, ...props }, ref) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <label htmlFor={inputId} className={cn("flex min-h-12 cursor-pointer items-start gap-3 py-2 md:min-h-0", className)}>
      <input
        ref={ref}
        id={inputId}
        type="checkbox"
        className="mt-0.5 size-5 shrink-0 accent-[var(--accent)] md:size-4"
        {...props}
      />
      <span className="min-w-0 text-[14px] leading-snug md:text-[13.5px]">
        <span className="text-[var(--a-fg)]">{label}</span>
        {description ? <span className="mt-0.5 block text-[12.5px] text-[var(--a-muted)]">{description}</span> : null}
      </span>
    </label>
  );
});
