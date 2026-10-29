"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { logoutAction } from "@/app/(auth)/actions";
import { initials } from "@/lib/utils";

export function UserMenu({ name, email, readOnly }: { name: string; email: string; readOnly: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => !ref.current?.contains(event.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex size-11 items-center justify-center rounded-full md:size-9"
        aria-label="Your account"
        aria-expanded={open}
      >
        <span className="accent-gradient flex size-8 items-center justify-center rounded-full text-[12px] font-semibold text-white">
          {initials(name)}
        </span>
      </button>
      {open ? (
        <div className="absolute right-0 z-50 mt-1.5 w-64 overflow-hidden rounded-xl border border-[var(--a-border-strong)] bg-[var(--a-elevated)] shadow-xl">
          <div className="border-b border-[var(--a-border)] px-4 py-3">
            <p className="truncate text-[13.5px] font-medium text-[var(--a-fg-strong)]">{name}</p>
            <p className="truncate text-[12.5px] text-[var(--a-muted)]">{email}</p>
          </div>
          {readOnly ? null : (
            <>
              <Link href="/app/account" onClick={() => setOpen(false)} className="flex min-h-12 items-center px-4 text-[13.5px] hover:bg-[var(--a-hover)] md:min-h-10">
                Your account
              </Link>
              <form action={logoutAction}>
                <button type="submit" className="flex min-h-12 w-full items-center px-4 text-left text-[13.5px] hover:bg-[var(--a-hover)] md:min-h-10">
                  Sign out
                </button>
              </form>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
