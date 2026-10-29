import Link from "next/link";
import { Brand } from "@/components/shell/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pt-safe flex min-h-dvh flex-col px-4">
      <header className="mx-auto flex w-full max-w-md items-center justify-between py-5">
        <Brand />
      </header>
      <main className="mx-auto w-full max-w-md flex-1 pb-10">{children}</main>
      <footer className="pb-safe mx-auto flex w-full max-w-md flex-wrap gap-x-4 gap-y-1 py-6 text-[12.5px] text-[var(--a-muted)]">
        <Link href="/terms" className="hover:text-[var(--a-fg)]">Terms</Link>
        <Link href="/privacy" className="hover:text-[var(--a-fg)]">Privacy</Link>
        <Link href="/delete-account" className="hover:text-[var(--a-fg)]">Delete an account</Link>
      </footer>
    </div>
  );
}
