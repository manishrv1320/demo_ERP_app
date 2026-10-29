"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { markAllNotificationsReadAction } from "@/app/app/(shell)/notifications/actions";
import { relativeTime } from "@/lib/dates";
import { cn } from "@/lib/utils";

type Item = { id: string; title: string; body: string | null; href: string | null; level: string; createdAt: string; readAt: string | null };

const POLL_MS = 30_000;

/**
 * Live updates by polling (rule 1: no push services needed): a small JSON
 * endpoint every 30 seconds while the page is visible.
 */
export function NotificationBell() {
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  const poll = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications/poll", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { unread: number; items: Item[] };
      setUnread(data.unread);
      setItems(data.items);
    } catch {
      // Offline or the server restarting — the next poll will catch up.
    }
  }, []);

  useEffect(() => {
    void poll();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void poll();
    }, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void poll();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [poll]);

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
        className="relative flex size-11 items-center justify-center rounded-lg text-[var(--a-muted)] hover:bg-[var(--a-hover)] hover:text-[var(--a-fg)] md:size-9"
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
      >
        <Bell className="size-5 md:size-[18px]" />
        {unread ? (
          <span className="absolute right-1.5 top-1.5 flex min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-semibold leading-4 text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-50 mt-1.5 w-[min(92vw,360px)] overflow-hidden rounded-xl border border-[var(--a-border-strong)] bg-[var(--a-elevated)] shadow-xl">
          <div className="flex items-center justify-between border-b border-[var(--a-border)] px-4 py-3">
            <p className="text-[14px] font-medium text-[var(--a-fg-strong)]">Notifications</p>
            {unread ? (
              <button
                type="button"
                className="min-h-9 text-[12.5px] text-[var(--accent)]"
                onClick={() =>
                  start(async () => {
                    await markAllNotificationsReadAction({});
                    await poll();
                  })
                }
              >
                Mark all read
              </button>
            ) : null}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-[var(--a-muted)]">You&apos;re all caught up.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-[var(--a-border)] overflow-y-auto">
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href ?? "/app/notifications"}
                    onClick={() => setOpen(false)}
                    className={cn("block px-4 py-3 hover:bg-[var(--a-hover)]", !item.readAt && "bg-[color-mix(in_oklab,var(--accent)_6%,transparent)]")}
                  >
                    <p className="text-[13.5px] text-[var(--a-fg-strong)]">{item.title}</p>
                    {item.body ? <p className="mt-0.5 line-clamp-2 text-[12.5px] text-[var(--a-muted)]">{item.body}</p> : null}
                    <p className="mt-1 text-[11.5px] text-[var(--a-subtle)]">{relativeTime(item.createdAt)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/app/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-[var(--a-border)] px-4 py-3 text-center text-[13px] text-[var(--a-fg)] hover:bg-[var(--a-hover)]"
          >
            See all
          </Link>
        </div>
      ) : null}
    </div>
  );
}
