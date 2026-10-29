/**
 * Creates the local `.env` from `.env.example` with a fresh DATA_ENCRYPTION_KEY.
 *
 *   npm run setup:env
 *
 * The key is written straight into the file (mode 600 where the OS supports
 * it) and never printed. An existing `.env` is left alone.
 */
import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";

if (existsSync(".env")) {
  console.log(".env already exists — left unchanged.");
  process.exit(0);
}

const template = readFileSync(".env.example", "utf8");
const key = randomBytes(32).toString("base64");
const contents = template.replace(/^DATA_ENCRYPTION_KEY=""$/m, `DATA_ENCRYPTION_KEY="${key}"`);

writeFileSync(".env", contents, { mode: 0o600 });
try {
  chmodSync(".env", 0o600);
} catch {
  // Windows ignores POSIX modes; the file is still git-ignored.
}
console.log("Created .env with a new DATA_ENCRYPTION_KEY (not shown).");
