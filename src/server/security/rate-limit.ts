import "server-only";

/**
 * Fixed-window in-memory rate limiter. From Hyperzen's src/lib/rate-limit.ts.
 * The ERP runs as one Node process on one server, so memory is enough.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 50_000;

/**
 * Once the map is full, drop expired buckets, then ones seen only once, and
 * only then the oldest. Never clear everything: flooding the limiter with junk
 * keys must not reset the busy counters that protect sign-in and reset.
 */
function sweep(now: number) {
  if (buckets.size < MAX_KEYS) return;
  const target = MAX_KEYS * 0.9;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  for (const [key, bucket] of buckets) {
    if (buckets.size < target) return;
    if (bucket.count <= 1) buckets.delete(key);
  }
  for (const key of buckets.keys()) {
    if (buckets.size < target) return;
    buckets.delete(key);
  }
}

export type RateLimitResult = { success: boolean; remaining: number; retryAfterSeconds: number };

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  bucket.count += 1;
  const success = bucket.count <= limit;
  return {
    success,
    remaining: Math.max(0, limit - bucket.count),
    retryAfterSeconds: success ? 0 : Math.ceil((bucket.resetAt - now) / 1000),
  };
}

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
