import Link from "next/link";
import { Brand } from "@/components/shell/brand";
import { buttonClass } from "@/components/ui/button";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pt-safe flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-[var(--a-border)] bg-[color-mix(in_oklab,var(--a-bg)_88%,transparent)] backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
          <Brand />
          <nav className="flex items-center gap-1">
            <Link href="/login" className={buttonClass("ghost")}>
              Sign in
            </Link>
            <Link href="/signup" className={buttonClass("primary")}>
              Get started
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="pb-safe border-t border-[var(--a-border)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-[13px] text-[var(--a-muted)] md:flex-row md:items-center md:justify-between md:px-6">
          <p>© {new Date().getFullYear()} Hyperzen Innovation Pvt Ltd</p>
          <nav className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/terms" className="hover:text-[var(--a-fg)]">Terms</Link>
            <Link href="/privacy" className="hover:text-[var(--a-fg)]">Privacy</Link>
            <Link href="/delete-account" className="hover:text-[var(--a-fg)]">Delete an account</Link>
            <a href="https://hyperzen.in" className="hover:text-[var(--a-fg)]">hyperzen.in</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
