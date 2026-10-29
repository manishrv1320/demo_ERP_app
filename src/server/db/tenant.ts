import "server-only";

import { raw } from "./raw";
import { ORGANIZATION_MODEL, TENANT_MODELS } from "./models";

/**
 * Tenant isolation, layer 2: `forOrg(orgId)`.
 *
 * Returns a Prisma client that, for every tenant model and every operation,
 * adds `organizationId = orgId` to the `where` and sets it on every created
 * row. If a caller passes a different organizationId — at the top level or
 * inside a compound unique key — it throws instead of overriding, so a bug
 * shows up loudly rather than silently reading the wrong company.
 *
 * Global models (users, sessions, platform tables) aren't reachable through it,
 * the Organization row is reachable only as the caller's own, and raw SQL
 * (`$queryRaw` and friends) isn't exposed at all.
 *
 * Layer 1 sits underneath: composite foreign keys mean even a row created here
 * can't point at another organization's rows.
 */

export class TenantViolation extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantViolation";
  }
}

export class ReadOnlyViolation extends Error {
  constructor(message = "This session is read-only.") {
    super(message);
    this.name = "ReadOnlyViolation";
  }
}

const READ_OPERATIONS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
]);

const WHERE_OPERATIONS = new Set([
  ...READ_OPERATIONS,
  "update",
  "updateMany",
  "updateManyAndReturn",
  "delete",
  "deleteMany",
  "upsert",
]);

const UPDATE_OPERATIONS = new Set(["update", "updateMany", "updateManyAndReturn"]);
const CREATE_OPERATIONS = new Set(["create", "createMany", "createManyAndReturn"]);

/** The Organization row: read it and update it, nothing else. */
const ORGANIZATION_OPERATIONS = new Set(["findUnique", "findUniqueOrThrow", "findFirst", "findFirstOrThrow", "update"]);

type Args = Record<string, unknown>;

function isRecord(value: unknown): value is Args {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function scopeWhere(model: string, where: unknown, orgId: string): Args {
  const scoped: Args = isRecord(where) ? { ...where } : {};
  if ("organizationId" in scoped && scoped.organizationId !== orgId) {
    throw new TenantViolation(`${model}: a query asked for another organization's rows.`);
  }
  // Compound unique keys such as organizationId_code: { organizationId, code }.
  for (const [key, value] of Object.entries(scoped)) {
    if (key.startsWith("organizationId_") && isRecord(value) && value.organizationId !== orgId) {
      throw new TenantViolation(`${model}: a unique key named another organization.`);
    }
  }
  scoped.organizationId = orgId;
  return scoped;
}

function scopeCreateData(model: string, data: unknown, orgId: string): Args {
  if (!isRecord(data)) throw new TenantViolation(`${model}: create without data.`);
  if ("organization" in data) {
    throw new TenantViolation(`${model}: set organizationId through the tenant client, not organization.connect.`);
  }
  if ("organizationId" in data && data.organizationId !== orgId) {
    throw new TenantViolation(`${model}: tried to create a row for another organization.`);
  }
  return { ...data, organizationId: orgId };
}

function guardUpdateData(model: string, data: unknown, orgId: string): void {
  if (!isRecord(data)) return;
  if ("organization" in data) {
    throw new TenantViolation(`${model}: rows can't move between organizations.`);
  }
  if ("organizationId" in data && data.organizationId !== orgId) {
    throw new TenantViolation(`${model}: rows can't move between organizations.`);
  }
}

function scopeOrganizationWhere(where: unknown, orgId: string): Args {
  const scoped: Args = isRecord(where) ? { ...where } : {};
  if ("id" in scoped && scoped.id !== orgId) {
    throw new TenantViolation("Organization: only the current organization is reachable.");
  }
  scoped.id = orgId;
  return scoped;
}

export type TenantOptions = {
  /** Support sessions: every write throws. */
  readOnly?: boolean;
};

function scopeArgs(model: string, operation: string, args: Args, orgId: string, readOnly: boolean): Args {
  if (readOnly && !READ_OPERATIONS.has(operation)) throw new ReadOnlyViolation();

  if (model === ORGANIZATION_MODEL) {
    if (!ORGANIZATION_OPERATIONS.has(operation)) {
      throw new TenantViolation(`Organization.${operation} isn't available to the tenant client.`);
    }
    const next: Args = { ...args, where: scopeOrganizationWhere(args.where, orgId) };
    if (operation === "update" && isRecord(args.data) && "id" in args.data) {
      throw new TenantViolation("Organization: the id can't change.");
    }
    return next;
  }

  if (!TENANT_MODELS.has(model)) {
    throw new TenantViolation(
      `${model} is not tenant data. Use globalDb or a named function in src/server/db for it.`,
    );
  }

  const next: Args = { ...args };
  if (WHERE_OPERATIONS.has(operation)) next.where = scopeWhere(model, args.where, orgId);
  if (UPDATE_OPERATIONS.has(operation)) guardUpdateData(model, args.data, orgId);

  if (CREATE_OPERATIONS.has(operation)) {
    next.data = Array.isArray(args.data)
      ? args.data.map((row) => scopeCreateData(model, row, orgId))
      : scopeCreateData(model, args.data, orgId);
  }

  if (operation === "upsert") {
    next.create = scopeCreateData(model, args.create, orgId);
    guardUpdateData(model, args.update, orgId);
  }

  return next;
}

function extend(orgId: string, readOnly: boolean) {
  return raw.$extends({
    name: readOnly ? "tenant-read-only" : "tenant",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          return query(scopeArgs(model, operation, (args ?? {}) as Args, orgId, readOnly) as typeof args);
        },
      },
    },
  });
}

type Extended = ReturnType<typeof extend>;

const BLOCKED = [
  "$queryRaw",
  "$executeRaw",
  "$queryRawUnsafe",
  "$executeRawUnsafe",
  "$runCommandRaw",
  "$extends",
  "$connect",
  "$disconnect",
  "$on",
] as const;
type Blocked = (typeof BLOCKED)[number];
const BLOCKED_SET = new Set<string>(BLOCKED);

/** The tenant client's type: the extended client without raw SQL or lifecycle methods. */
export type TenantDb = Omit<Extended, Blocked | "$transaction"> & {
  $transaction<R>(
    fn: (tx: TenantTx) => Promise<R>,
    options?: { maxWait?: number; timeout?: number; isolationLevel?: "ReadCommitted" | "RepeatableRead" | "Serializable" },
  ): Promise<R>;
};
export type TenantTx = Omit<TenantDb, "$transaction">;

function guard<T extends object>(client: T, readOnly: boolean): T {
  return new Proxy(client, {
    get(target, property, receiver) {
      if (typeof property === "string" && BLOCKED_SET.has(property)) {
        throw new TenantViolation(`${property} isn't available on the tenant client.`);
      }
      if (property === "$transaction") {
        const original = Reflect.get(target, property, receiver) as (...args: unknown[]) => Promise<unknown>;
        return (fn: unknown, options?: unknown) => {
          if (typeof fn !== "function") {
            throw new TenantViolation("Use an interactive transaction: db.$transaction(async (tx) => …).");
          }
          if (readOnly) throw new ReadOnlyViolation();
          return original.call(target, (tx: object) => (fn as (tx: object) => unknown)(guard(tx, readOnly)), options);
        };
      }
      return Reflect.get(target, property, receiver);
    },
  });
}

const cache = new Map<string, TenantDb>();
const CACHE_LIMIT = 1000;

/** The tenant-scoped client for one organization. Cheap: clients are cached and share one pool. */
export function forOrg(orgId: string, options: TenantOptions = {}): TenantDb {
  if (!orgId || typeof orgId !== "string") throw new TenantViolation("forOrg needs an organization id.");
  const readOnly = Boolean(options.readOnly);
  const key = `${readOnly ? "ro" : "rw"}:${orgId}`;
  const hit = cache.get(key);
  if (hit) return hit;
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
  const client = guard(extend(orgId, readOnly), readOnly) as unknown as TenantDb;
  cache.set(key, client);
  return client;
}
