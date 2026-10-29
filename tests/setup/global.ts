import { readdirSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { startPgliteServer } from "../../scripts/pglite-server.mjs";

/**
 * Starts an in-memory PostgreSQL (PGlite) for the test run, applies every
 * migration in prisma/migrations in order, and points DATABASE_URL at it.
 * `npm test` needs no database running.
 */
async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

export default async function setup() {
  const port = await freePort();
  const database = await startPgliteServer({ port });

  const migrationsDir = path.resolve(__dirname, "../../prisma/migrations");
  const folders = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  for (const folder of folders) {
    await database.db.exec(readFileSync(path.join(migrationsDir, folder, "migration.sql"), "utf8"));
  }

  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${port}/postgres?sslmode=disable&connection_limit=1&pgbouncer=true`;
  process.env.DATA_ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString("base64");
  process.env.FILE_STORAGE_ROOT ??= path.resolve(__dirname, "../../.testdb-storage");

  return async () => {
    await database.stop();
  };
}
