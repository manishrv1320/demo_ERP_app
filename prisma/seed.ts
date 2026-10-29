/**
 * Platform defaults: the Terms and Privacy Policy, and the (empty, email-off)
 * platform settings row. Safe to run again — existing rows are left alone.
 *
 *   npm run db:seed
 *
 * Organizations seed themselves at sign-up (src/server/db/provision.ts).
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { DEFAULT_POLICIES } from "../src/server/policies-content";

const prisma = new PrismaClient();

async function main() {
  for (const policy of DEFAULT_POLICIES) {
    await prisma.policy.upsert({ where: { slug: policy.slug }, create: policy, update: {} });
  }
  await prisma.platformSettings.upsert({ where: { id: "platform" }, create: { id: "platform" }, update: {} });
  console.log("Seeded policies and platform settings.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
