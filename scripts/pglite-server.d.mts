import type { PGlite } from "@electric-sql/pglite";

export function startPgliteServer(options: {
  dataDir?: string;
  host?: string;
  port: number;
  queueTimeout?: number;
  debug?: boolean;
}): Promise<{ db: PGlite; server: unknown; stop(): Promise<void> }>;
