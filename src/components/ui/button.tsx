import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "sm";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-[opacity,background-color,border-color] disabled:pointer-events-none disabled:opacity-60 select-none";

// 48px on phones (touch targets), 40px / 32px on desktop.
const sizes: Record<Size, string> = {
  md: "min-h-12 px-4 text-[15px] md:min-h-10 md:px-3.5 md:text-[13.5px]",
  sm: "min-h-11 px-3 text-[14px] md:min-h-8 md:px-2.5 md:text-[12.5px]",
};

const variants: Record<Variant, string> = {
  primary: "accent-gradient text-white hover:opacity-90",
  secondary:
    "border border-[var(--a-border)] bg-[var(--a-panel)] text-[var(--a-fg)] hover:border-[var(--a-border-strong)] hover:bg-[var(--a-hover)]",
  ghost: "text-[var(--a-fg)] hover:bg-[var(--a-hover)]",
  danger: "bg-[var(--a-danger)] text-white hover:opacity-90",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, sizes[size], variants[variant], className);
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button
      type={type}
      className={buttonClass(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: React.ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)} {...props}>
      {children}
    </Link>
  );
}
