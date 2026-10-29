"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Bell, Ellipsis, Home, Settings, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark } from "./brand";
import type { IconName, NavItem } from "./nav";
import { NotificationBell } from "./notification-bell";
import { OrgSwitcher, type SwitcherOrganization } from "./org-switcher";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

const ICONS: Record<IconName, React.ComponentType<{ className?: string }>> = {
  home: Home,
  bell: Bell,
  activity: Activity,
  settings: Settings,
  user: UserRound,
  more: Ellipsis,
};

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export type ShellProps = {
  organization: { id: string; name: string; logoUrl: string | null };
  organizations: SwitcherOrganization[];
  user: { name: string; email: string };
  sidebar: NavItem[];
  tabs: NavItem[];
  readOnly: boolean;
  banner?: React.ReactNode;
  children: React.ReactNode;
};

/**
 * Desktops get a sidebar; phones get a top bar and a bottom tab bar (Home ·
 * … · More), with safe-area padding for the edge-to-edge Android app.
 */
export function AppShell({ organization, organizations, user, sidebar, tabs, readOnly, banner, children }: ShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh md:flex">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-[var(--a-border)] bg-[var(--a-panel)] md:flex">
        <div className="flex h-16 items-center gap-2.5 border-b border-[var(--a-border)] px-4">
          <BrandMark />
          <span className="text-[14.5px] font-semibold tracking-tight text-[var(--a-fg-strong)]">Hyperzen ERP</span>
        </div>
        <div className="p-3">
          <OrgSwitcher current={organization} organizations={organizations} disabled={readOnly} />
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4" aria-label="Main">
          {sidebar.map((item) => {
            const Icon = ICONS[item.icon];
            const active = isActive(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] transition-colors",
                  active
                    ? "bg-[var(--a-active)] font-medium text-[var(--a-fg-strong)]"
                    : "text-[var(--a-muted)] hover:bg-[var(--a-hover)] hover:text-[var(--a-fg)]",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {banner}
        <header className="pt-safe sticky top-0 z-40 border-b border-[var(--a-border)] bg-[color-mix(in_oklab,var(--a-bg)_88%,transparent)] backdrop-blur">
          <div className="flex h-14 items-center gap-2 px-3 md:h-16 md:px-6">
            <div className="min-w-0 flex-1 md:hidden">
              <OrgSwitcher current={organization} organizations={organizations} disabled={readOnly} compact />
            </div>
            <div className="hidden flex-1 md:block" />
            {readOnly ? null : <NotificationBell />}
            <ThemeToggle />
            <UserMenu name={user.name} email={user.email} readOnly={readOnly} />
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-[calc(var(--tabbar-height)+24px)] md:px-6 md:pt-7 md:pb-10">
          {children}
        </main>
      </div>

      <nav
        className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-[var(--a-border)] bg-[color-mix(in_oklab,var(--a-panel)_94%,transparent)] backdrop-blur md:hidden"
        aria-label="Tabs"
      >
        <div className="grid h-16" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
          {tabs.map((item) => {
            const Icon = ICONS[item.icon];
            const active = isActive(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 text-[11.5px]",
                  active ? "font-medium text-[var(--accent)]" : "text-[var(--a-muted)]",
                )}
              >
                <Icon className="size-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
