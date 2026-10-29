import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { decryptBytes, encryptBytes } from "@/server/security/encryption";

/**
 * Private files on the server's own disk. From Hyperzen's src/lib/file-storage.ts.
 *
 * Files live outside the repo under FILE_STORAGE_ROOT, encrypted, under
 * random server-generated names, and are served only through authenticated,
 * capability-checked routes. Every path starts with orgs/<organizationId>/,
 * so one organization's files can't be addressed from another's.
 */
const STORAGE_ROOT = path.resolve(
  process.env.FILE_STORAGE_ROOT || path.join(process.cwd(), "..", ".hyperzen-erp-storage"),
);

/** Resolve a stored relative path and refuse anything that escapes the root. */
function resolveWithin(relativePath: string): string {
  const resolved = path.resolve(STORAGE_ROOT, relativePath);
  if (resolved !== STORAGE_ROOT && !resolved.startsWith(STORAGE_ROOT + path.sep)) {
    throw new Error("Refused to resolve a storage path outside the storage root.");
  }
  return resolved;
}

function organizationFolder(organizationId: string): string {
  if (!/^[a-z0-9]+$/i.test(organizationId)) throw new Error("Invalid organization id.");
  return `orgs/${organizationId}`;
}

export function sha256Hex(bytes: Buffer | Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function writeOrganizationFile(options: {
  organizationId: string;
  /** e.g. "logo", "receipts". Letters, digits and dashes. */
  category: string;
  bytes: Buffer;
  /** Without the dot, e.g. "png". */
  extension: string;
}): Promise<{ relativePath: string; hash: string }> {
  const ext = options.extension.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
  const category = options.category.replace(/[^a-z0-9-]/gi, "") || "files";
  const relativePath = `${organizationFolder(options.organizationId)}/${category}/${randomUUID()}.${ext}`;
  const absolutePath = resolveWithin(relativePath);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, encryptBytes(options.bytes));
  return { relativePath, hash: sha256Hex(options.bytes) };
}

/**
 * Read and decrypt a file that belongs to the organization. The path must sit
 * inside that organization's folder, whatever the database row says.
 */
export async function readOrganizationFile(organizationId: string, relativePath: string): Promise<Buffer | null> {
  if (!relativePath.startsWith(`${organizationFolder(organizationId)}/`)) return null;
  try {
    return decryptBytes(await readFile(resolveWithin(relativePath)));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

/** Best-effort delete — a missing file is not an error. */
export async function deleteOrganizationFile(organizationId: string, relativePath: string): Promise<void> {
  if (!relativePath.startsWith(`${organizationFolder(organizationId)}/`)) return;
  await unlink(resolveWithin(relativePath)).catch(() => undefined);
}

/** When an organization is finally deleted. */
export async function deleteOrganizationFolder(organizationId: string): Promise<void> {
  await rm(resolveWithin(organizationFolder(organizationId)), { recursive: true, force: true });
}

/** Sniff the real type of an uploaded image instead of trusting its name. */
export function detectImageType(bytes: Buffer): { mime: string; extension: string } | null {
  if (bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mime: "image/png", extension: "png" };
  }
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: "image/jpeg", extension: "jpg" };
  }
  if (bytes.length > 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") {
    return { mime: "image/webp", extension: "webp" };
  }
  return null;
}
