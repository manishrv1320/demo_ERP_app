import "server-only";

import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

/**
 * Compared against when an email has no account, so a wrong email takes as
 * long as a wrong password and response times don't reveal who has an account.
 */
let dummyHash: Promise<string> | null = null;

export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= bcrypt.hash("no-account-placeholder", BCRYPT_ROUNDS);
  await verifyPassword(password, await dummyHash);
}
