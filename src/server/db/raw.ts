import "server-only";

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { hzerpPrisma?: PrismaClient };

/**
 * The only PrismaClient in the app. It sees every organization's rows, so the
 * ESLint rule in eslint.config.mjs lets only src/server/db, the platform
 * console's server code, scripts and tests import it. Everything else uses the
 * tenant client from `forOrg()` (via the request context) or `globalDb`.
 *
 * Cached on globalThis in every environment so Next's server chunks share one
 * connection pool (the reason is in Hyperzen's src/lib/db.ts).
 */
export const raw =
  globalForPrisma.hzerpPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

globalForPrisma.hzerpPrisma = raw;
