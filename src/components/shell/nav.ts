import { can, type ActorRole, type Capability } from "@/lib/rbac";

/**
 * Navigation, filtered on the server by the role's capabilities. (Filtering is
 * for tidiness only — every page checks its own capability and 404s.)
 * Areas appear here as each phase ships them.
 */
export type IconName = "home" | "bell" | "activity" | "settings" | "user" | "more";

export type NavItem = { href: string; label: string; icon: IconName; exact?: boolean };

type Entry = NavItem & { capability?: Capability | Capability[] };

const SIDEBAR: Entry[] = [
  { href: "/app", label: "Home", icon: "home", exact: true },
  { href: "/app/notifications", label: "Notifications", icon: "bell" },
  { href: "/app/activity", label: "Activity log", icon: "activity", capability: "activity.read" },
  { href: "/app/settings", label: "Settings", icon: "settings", capability: ["settings.write", "users.manage", "roles.manage"] },
];

/** Phone tab bar: the brief's Home · Sales · Items · Reports · More, as those areas ship. */
const TABS: Entry[] = [
  { href: "/app", label: "Home", icon: "home", exact: true },
  { href: "/app/notifications", label: "Alerts", icon: "bell" },
  { href: "/app/more", label: "More", icon: "more" },
];

function allowed(role: ActorRole, entry: Entry): boolean {
  if (!entry.capability) return true;
  const list = Array.isArray(entry.capability) ? entry.capability : [entry.capability];
  return list.some((capability) => can(role, capability));
}

const strip = ({ capability: _capability, ...item }: Entry): NavItem => item;

export function navigationFor(role: ActorRole): { sidebar: NavItem[]; tabs: NavItem[]; more: NavItem[] } {
  const sidebar = SIDEBAR.filter((entry) => allowed(role, entry)).map(strip);
  return {
    sidebar,
    tabs: TABS.filter((entry) => allowed(role, entry)).map(strip),
    // The "More" screen on phones lists what the tab bar doesn't hold.
    more: [...sidebar.filter((item) => !TABS.some((tab) => tab.href === item.href)), { href: "/app/account", label: "Your account", icon: "user" }],
  };
}
