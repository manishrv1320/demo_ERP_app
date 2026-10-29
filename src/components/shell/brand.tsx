import Link from "next/link";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn("accent-gradient inline-flex size-8 items-center justify-center rounded-lg text-[15px] font-bold text-white", className)}
      aria-hidden
    >
      H
    </span>
  );
}

export function Brand({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex min-h-11 items-center gap-2.5", className)}>
      <BrandMark />
      <span className="text-[15px] font-semibold tracking-tight text-[var(--a-fg-strong)]">Hyperzen ERP</span>
    </Link>
  );
}
