import type { Metadata } from "next";
import { Activity, Bell, Settings, UserRound } from "lucide-react";
import { logoutAction } from "@/app/(auth)/actions";
import { navigationFor } from "@/components/shell/nav";
import { NavList, NavRow, PageHeader } from "@/components/ui/surface";
import { requirePage } from "@/server/auth/context";

export const metadata: Metadata = { title: "More" };

const ICONS = { activity: Activity, bell: Bell, settings: Settings, user: UserRound } as const;

/** The phone's "More" tab: everything the tab bar doesn't hold. */
export default async function MorePage() {
  const ctx = await requirePage();
  const { more } = navigationFor(ctx.role);
  return (
    <>
      <PageHeader title="More" description={ctx.org.name} />
      <NavList>
        {more.map((item) => {
          const Icon = ICONS[item.icon as keyof typeof ICONS] ?? Settings;
          return <NavRow key={item.href} href={item.href} title={item.label} icon={<Icon className="size-5" />} />;
        })}
      </NavList>
      {ctx.readOnly ? null : (
        <form action={logoutAction} className="mt-4">
          <button
            type="submit"
            className="min-h-12 w-full rounded-xl border border-[var(--a-border)] bg-[var(--a-panel)] text-[14.5px] text-[var(--a-danger)]"
          >
            Sign out
          </button>
        </form>
      )}
    </>
  );
}
