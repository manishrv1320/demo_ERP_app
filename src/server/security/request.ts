import "server-only";

import { headers } from "next/headers";

/**
 * The visitor's IP address.
 *
 * Cloudflare sets CF-Connecting-IP itself and overwrites anything a client
 * sends, so it's the one header a script can't fake. (Hyperzen reads the first
 * X-Forwarded-For entry, which a client controls — see docs/phase-0-plan.md.)
 * Without Cloudflare in front (local dev), fall back to the socket-level
 * address Next puts last in X-Forwarded-For.
 */
export function clientIpFrom(headerList: Headers): string | null {
  const cloudflare = headerList.get("cf-connecting-ip");
  if (cloudflare) return cloudflare.trim().slice(0, 64);
  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((part) => part.trim()).filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) return last.slice(0, 64);
  }
  return headerList.get("x-real-ip")?.slice(0, 64) ?? null;
}

export async function requestMeta(): Promise<{ ip: string | null; userAgent: string | null; isApp: boolean }> {
  const headerList = await headers();
  const userAgent = headerList.get("user-agent")?.slice(0, 400) ?? null;
  return {
    ip: clientIpFrom(headerList),
    userAgent,
    // The Android app appends this to its user agent. UI hint only.
    isApp: Boolean(userAgent?.includes("HyperzenERPApp/")),
  };
}

/**
 * Reject cross-site writes to JSON route handlers. Server actions already
 * carry Next's own origin check.
 */
export async function isSameOrigin(): Promise<boolean> {
  const headerList = await headers();
  const origin = headerList.get("origin");
  if (!origin) return true;
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
