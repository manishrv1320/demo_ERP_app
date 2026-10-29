/**
 * Local development database — no Docker, no install.
 *
 *   npm run db:dev        # keep this running in its own terminal
 *   npm run db:migrate    # in another terminal (creates / applies migrations)
 *   npm run db:seed
 *   npm run dev
 *
 * Serves two embedded PostgreSQL (PGlite) databases:
 *   • 127.0.0.1:5443 — the development database, kept in ./.pgdata
 *   • 127.0.0.1:5444 — an in-memory "shadow" database that `prisma migrate dev`
 *     uses to check migrations. It's thrown away when this script stops.
 *
 * The ports differ from Hyperzen's 5433, so both projects can run side by side.
 */
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { startPgliteServer } from "./pglite-server.mjs";

const PORT = Number(process.env.DEV_DB_PORT || 5443);
const SHADOW_PORT = Number(process.env.DEV_DB_SHADOW_PORT || 5444);
const HOST = process.env.DEV_DB_HOST || "127.0.0.1";
const DATA_DIR = resolve(process.cwd(), process.env.DEV_DB_DIR || ".pgdata");
// A client that has to wait longer than this gets a clean connection error
// instead of hanging — a stuck migration is much easier to diagnose that way.
const QUEUE_TIMEOUT = Number(process.env.DEV_DB_QUEUE_TIMEOUT || 15_000);
const DEBUG = process.env.DEV_DB_DEBUG === "1";

mkdirSync(DATA_DIR, { recursive: true });

console.log("┌────────────────────────────────────────────────────────────┐");
console.log("│  Hyperzen ERP — embedded PostgreSQL (development only)      │");
console.log("└────────────────────────────────────────────────────────────┘");
console.log(`  data directory : ${DATA_DIR}`);

function attachLogging(server, port) {
  server.addEventListener("error", (event) => {
    const error = event.detail;
    if (["ECONNRESET", "EPIPE"].includes(error?.code)) return;
    console.warn(`  [db:${port}] ${error?.message ?? error}`);
  });
  server.addEventListener("queueTimeout", () => {
    console.warn(
      `  [db:${port}] a client waited ${QUEUE_TIMEOUT / 1000}s for the database and gave up.` +
        " Something else is still holding the connection.",
    );
  });
}

// A client that disappears mid-query surfaces as a socket-level error. Keep the
// database running rather than taking the whole session down.
process.on("uncaughtException", (error) => {
  if (["ECONNRESET", "EPIPE", "ERR_STREAM_WRITE_AFTER_END"].includes(error?.code)) {
    console.warn(`  [db] client disconnected (${error.code}) — continuing.`);
    return;
  }
  throw error;
});

let main;
let shadow;
try {
  main = await startPgliteServer({ dataDir: DATA_DIR, host: HOST, port: PORT, queueTimeout: QUEUE_TIMEOUT, debug: DEBUG });
  shadow = await startPgliteServer({ host: HOST, port: SHADOW_PORT, queueTimeout: QUEUE_TIMEOUT, debug: DEBUG });
} catch (error) {
  if (error?.code === "EADDRINUSE") {
    console.error(`\n  Port ${PORT} or ${SHADOW_PORT} is already in use — is another db:dev running?\n`);
    process.exit(1);
  }
  throw error;
}
attachLogging(main.server, PORT);
attachLogging(shadow.server, SHADOW_PORT);

const url = (port) =>
  `postgresql://postgres:postgres@${HOST}:${port}/postgres?sslmode=disable&connection_limit=1&pgbouncer=true`;
console.log(`  listening on   : postgresql://${HOST}:${PORT}  (shadow: ${SHADOW_PORT})`);
console.log(`  DATABASE_URL        : ${url(PORT)}`);
console.log(`  SHADOW_DATABASE_URL : ${url(SHADOW_PORT)}`);
console.log("\n  Press Ctrl+C to stop.\n");

let stopping = false;
const shutdown = async (signal) => {
  if (stopping) return;
  stopping = true;
  console.log(`\n${signal} received — shutting the database down...`);
  try {
    await shadow.stop();
    await main.stop();
  } catch (error) {
    console.error(error);
  }
  process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
