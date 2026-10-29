import "server-only";

import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/** 32 random bytes as hex — session, invitation and reset tokens. */
export function newToken(): string {
  return randomBytes(32).toString("hex");
}

/** Only this hash is stored, so a database leak doesn't hand out live sessions. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Cryptographically random, so a code can never be guessed from the clock. */
export function newSixDigitCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function sameHash(a: string, b: string): boolean {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}
