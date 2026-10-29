// A Prisma config file turns off the CLI's own .env loading, so load it here —
// otherwise DATABASE_URL is missing for migrate and studio.
import "dotenv/config";

import path from "node:path";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
});
