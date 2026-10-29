import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Encryption at rest for private files (logos, receipts, statements) and
 * stored secrets (SMTP passwords). From Hyperzen's src/lib/data-encryption.ts.
 *
 * AES-256-GCM with the key in DATA_ENCRYPTION_KEY: 32 random bytes, base64.
 * Every file and secret gets its own random IV, and GCM's tag means a changed
 * byte fails to decrypt rather than returning altered data.
 *
 * Losing the key loses every file and secret encrypted with it. Keep a copy
 * somewhere safe that is NOT next to the database backups.
 */

/** "HZERP" + format version 1 + two reserved bytes. */
const MAGIC = Buffer.from([0x48, 0x5a, 0x45, 0x52, 0x50, 0x01, 0x00, 0x00]);
const IV_BYTES = 12;
const TAG_BYTES = 16;
const HEADER_BYTES = MAGIC.length + IV_BYTES + TAG_BYTES;
const TEXT_PREFIX = "hzerp:v1:";

let cachedKey: Buffer | null = null;

function encryptionKey(): Buffer {
  if (cachedKey) return cachedKey;
  const value = process.env.DATA_ENCRYPTION_KEY?.trim();
  if (!value) throw new Error("DATA_ENCRYPTION_KEY is not set. Run `npm run setup:env` locally.");
  const key = Buffer.from(value, "base64");
  if (key.length !== 32) throw new Error("DATA_ENCRYPTION_KEY must be 32 bytes, base64-encoded.");
  cachedKey = key;
  return key;
}

export function isEncrypted(data: Buffer): boolean {
  return data.length >= HEADER_BYTES && data.subarray(0, MAGIC.length).equals(MAGIC);
}

export function encryptBytes(plain: Buffer): Buffer {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), body]);
}

export function decryptBytes(data: Buffer): Buffer {
  if (!isEncrypted(data)) throw new Error("Refused to read a file that isn't encrypted.");
  const iv = data.subarray(MAGIC.length, MAGIC.length + IV_BYTES);
  const tag = data.subarray(MAGIC.length + IV_BYTES, HEADER_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data.subarray(HEADER_BYTES)), decipher.final()]);
}

/** For a database column: the encrypted bytes as one prefixed base64 string. */
export function encryptText(plain: string): string {
  return TEXT_PREFIX + encryptBytes(Buffer.from(plain, "utf8")).toString("base64");
}

export function decryptText(stored: string): string {
  if (!stored.startsWith(TEXT_PREFIX)) throw new Error("Refused to read a secret that isn't encrypted.");
  return decryptBytes(Buffer.from(stored.slice(TEXT_PREFIX.length), "base64")).toString("utf8");
}
