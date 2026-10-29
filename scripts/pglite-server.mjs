/**
 * Embedded PostgreSQL (PGlite) served over the real PostgreSQL wire protocol,
 * so Prisma, psql and the app talk to it exactly like a normal server.
 *
 * Used by `npm run db:dev` (scripts/dev-db.mjs) and by the test suite
 * (tests/setup/global.ts). DEVELOPMENT AND TESTS ONLY — production runs the
 * postgres:16-alpine container.
 *
 * Taken from Hyperzen's scripts/dev-db.mjs, including its message-framing fix.
 */
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { PGLiteSocketHandler, PGLiteSocketServer } from "@electric-sql/pglite-socket";

let patched = false;

/**
 * pglite-socket 0.0.x hands every TCP chunk to PGlite as if it were whole
 * protocol messages. A query larger than one chunk (~64 KB) then arrives in
 * pieces and aborts the WASM engine ("RuntimeError: unreachable"), taking the
 * database down. This buffers each connection's bytes and forwards only
 * complete messages, one batch at a time and in order.
 */
function patchMessageFraming() {
  if (patched) return;
  patched = true;
  const original = PGLiteSocketHandler.prototype.handleData;
  const attach = PGLiteSocketHandler.prototype.attach;

  // Framing state belongs to one connection; start clean on every attach.
  PGLiteSocketHandler.prototype.attach = function (...args) {
    this._pending = null;
    this._startedUp = false;
    this._queue = Promise.resolve(0);
    return attach.apply(this, args);
  };
  // A client that simply goes away (a test worker exiting, a dev server
  // restarting) shows up as ECONNRESET. The stock handler rejects its database
  // lock, which nobody awaits — an unhandled rejection. Release it normally.
  const handleError = PGLiteSocketHandler.prototype.handleError;
  const DISCONNECTS = new Set(["ECONNRESET", "EPIPE"]);
  PGLiteSocketHandler.prototype.handleError = function (error) {
    if (!DISCONNECTS.has(error?.code)) return handleError.call(this, error);
    this.resolveLock?.();
    this.resolveLock = undefined;
    this.rejectLock = undefined;
    this.detach(true);
  };

  // Untyped requests a client may send before the real startup message.
  const PRE_STARTUP_CODES = new Set([80877103 /* SSL */, 80877104 /* GSSENC */]);

  PGLiteSocketHandler.prototype.handleData = function handleData(chunk) {
    this._pending = this._pending ? Buffer.concat([this._pending, chunk]) : Buffer.from(chunk);
    this._queue ??= Promise.resolve(0);

    let offset = 0;
    for (;;) {
      const rest = this._pending.length - offset;
      if (this._startedUp) {
        // Type byte + Int32 length (the length counts itself, not the type).
        if (rest < 5) break;
        const size = 1 + this._pending.readInt32BE(offset + 1);
        if (rest < size) break;
        offset += size;
      } else {
        // Startup-phase messages have no type byte: Int32 length, Int32 code.
        if (rest < 8) break;
        const size = this._pending.readInt32BE(offset);
        if (rest < size) break;
        const code = this._pending.readInt32BE(offset + 4);
        if (!PRE_STARTUP_CODES.has(code)) this._startedUp = true;
        offset += size;
      }
    }

    if (offset === 0) return this._queue;
    const complete = this._pending.subarray(0, offset);
    this._pending = offset < this._pending.length ? Buffer.from(this._pending.subarray(offset)) : null;
    this._queue = this._queue.then(
      () => original.call(this, complete),
      () => original.call(this, complete),
    );
    return this._queue;
  };
}

/**
 * Start one PGlite database and serve it on host:port.
 *
 * PGlite is a single database instance, so exactly one client is served at a
 * time; the rest queue and are served in order as each client disconnects.
 *
 * @param {{ dataDir?: string, host?: string, port: number, queueTimeout?: number, debug?: boolean }} options
 *   Leave dataDir out for an in-memory database that disappears on exit.
 */
export async function startPgliteServer(options) {
  patchMessageFraming();

  const db = await PGlite.create({
    ...(options.dataDir ? { dataDir: options.dataDir } : {}),
    extensions: { pg_trgm },
  });
  await db.waitReady;

  const server = new PGLiteSocketServer({
    db,
    port: options.port,
    host: options.host ?? "127.0.0.1",
    connectionQueueTimeout: options.queueTimeout ?? 15_000,
    debug: Boolean(options.debug),
  });

  await server.start();

  return {
    db,
    server,
    async stop() {
      await server.stop();
      await db.close();
    },
  };
}
