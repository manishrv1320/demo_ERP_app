"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="pt-safe flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <h1 className="text-[22px] font-semibold">Something went wrong</h1>
      <p className="mt-2 max-w-sm text-[14px] text-[var(--a-muted)]">Nothing was lost. Try again, and if it keeps happening, let us know what you were doing.</p>
      <Button className="mt-6" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
