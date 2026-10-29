import Link from "next/link";

export default function NotFound() {
  return (
    <div className="pt-safe flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="text-[13px] font-medium text-[var(--accent)]">404</p>
      <h1 className="mt-2 text-[24px] font-semibold">This page isn&apos;t here</h1>
      <p className="mt-2 max-w-sm text-[14px] text-[var(--a-muted)]">
        It may have moved, or your role may not include it. Ask an Owner of your organization if you need access.
      </p>
      <Link href="/app" className="mt-6 inline-flex min-h-11 items-center text-[14px] text-[var(--accent)]">
        Go to the dashboard
      </Link>
    </div>
  );
}
