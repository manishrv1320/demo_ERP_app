/**
 * Creates (or resets) a Hyperzen staff account for the platform console.
 *
 *   npm run platform:create-admin -- --email you@hyperzen.in --name "Your Name"
 *
 * A strong password is generated on the machine this runs on and written to a
 * file readable only by you (mode 600). It is never printed, so it can't end
 * up in a chat or a terminal log. Open the file yourself, sign in at
 * /platform/login, then delete the file.
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { chmodSync, writeFileSync } from "node:fs";
import path from "node:path";
import { hashPassword } from "@/server/auth/passwords";
import { raw } from "@/server/db/raw";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const email = argument("email")?.trim().toLowerCase();
  const name = argument("name")?.trim() || "Hyperzen admin";
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error('Usage: npm run platform:create-admin -- --email you@hyperzen.in --name "Your Name"');
    process.exit(1);
  }

  const password = randomBytes(18).toString("base64url");
  const passwordHash = await hashPassword(password);
  const existing = await raw.platformAdmin.findUnique({ where: { email } });
  await raw.platformAdmin.upsert({
    where: { email },
    create: { email, name, passwordHash },
    update: { name, passwordHash, passwordChangedAt: new Date(), isActive: true },
  });
  if (existing) await raw.platformSession.deleteMany({ where: { platformAdminId: existing.id } });

  const file = path.resolve(argument("out") ?? `platform-admin-${Date.now()}.txt`);
  writeFileSync(file, `Hyperzen ERP platform console\nSign in at /platform/login\nEmail: ${email}\nPassword: ${password}\n\nDelete this file after signing in.\n`, { mode: 0o600 });
  try {
    chmodSync(file, 0o600);
  } catch {
    // Windows ignores POSIX modes.
  }
  console.log(`${existing ? "Reset" : "Created"} platform admin ${email}.`);
  console.log(`The password is in ${file} (readable only by you). It was not printed.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => raw.$disconnect());
