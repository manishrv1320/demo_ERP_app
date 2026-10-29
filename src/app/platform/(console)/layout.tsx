import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/shell/brand";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { requirePlatformAdmin } from "@/server/platform/session";
import { platformLogoutAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { default: "Platform console", template: "%s · Platform console" }, robots: { index: false, follow: false } };

const LINKS = [
  { href: "/platform", label: "Organizations" },
  { href: "/platform/policies", label: "Policies" },
  { href: "/platform/email", label: "Email" },
  { href: "/platform/audit", label: "Audit log" },
];

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const admin = await requirePlatformAdmin();
  return (
    <div className="min-h-dvh">
      <header className="pt-safe sticky top-0 z-40 border-b border-[var(--a-border)] bg-[color-mix(in_oklab,var(--a-bg)_90%,transparent)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 md:px-6">
          <Link href="/platform" className="flex min-h-11 items-center gap-2">
            <BrandMark className="size-7" />
            <span className="text-[14px] font-semibold">Platform</span>
          </Link>
          <nav className="order-3 flex w-full gap-1 overflow-x-auto md:order-none md:w-auto">
            {LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="inline-flex min-h-10 items-center whitespace-nowrap rounded-lg px-3 text-[13.5px] text-[var(--a-muted)] hover:bg-[var(--a-hover)] hover:text-[var(--a-fg)]">
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <span className="hidden text-[12.5px] text-[var(--a-muted)] sm:inline">{admin.name}</span>
            <ThemeToggle />
            <form action={platformLogoutAction}>
              <button type="submit" className="min-h-10 rounded-lg px-3 text-[13px] hover:bg-[var(--a-hover)]">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 md:px-6">{children}</main>
    </div>
  );
}
