import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** The result every server action returns. Same shape as Hyperzen's. */
export type ActionResult<T = unknown> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; message: string; errors?: Record<string, string> };

/** Only same-site relative paths are allowed as a post-sign-in destination. */
export function safeNextPath(value: string | null | undefined, fallback = "/app"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  return value;
}

/** "Asha Rao" → "AR" */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0]![0]! + (parts.length > 1 ? parts[parts.length - 1]![0]! : "")).toUpperCase();
}

/** Accept only #rgb / #rrggbb colours, as Hyperzen's root layout does before writing CSS variables. */
export function sanitizeColor(value: string | null | undefined): string | null {
  const text = String(value ?? "").trim();
  return /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(text) ? text.toLowerCase() : null;
}
