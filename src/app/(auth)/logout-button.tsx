import { logoutAction } from "./actions";

export function LogoutButton({ label = "Sign out", className }: { label?: string; className?: string }) {
  return (
    <form action={logoutAction}>
      <button type="submit" className={className ?? "min-h-11 text-[13.5px] text-[var(--a-muted)] hover:text-[var(--a-fg)]"}>
        {label}
      </button>
    </form>
  );
}
