import { LogoutButton } from "@/app/(auth)/logout-button";
import { Brand } from "@/components/shell/brand";

export const dynamic = "force-dynamic";

/** Pages that work before an organization is chosen: select, create, unavailable. */
export default function BareLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pt-safe flex min-h-dvh flex-col px-4">
      <header className="mx-auto flex w-full max-w-lg items-center justify-between py-5">
        <Brand href="/app" />
        <LogoutButton />
      </header>
      <main className="pb-safe mx-auto w-full max-w-lg flex-1 pb-10">{children}</main>
    </div>
  );
}
