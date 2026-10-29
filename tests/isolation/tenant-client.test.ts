import { Prisma } from "@prisma/client";
import { beforeAll, describe, expect, it } from "vitest";
import { raw } from "@/server/db/raw";
import { forOrg, ReadOnlyViolation, TenantViolation, type TenantDb } from "@/server/db/tenant";
import { TENANT_MODELS } from "@/server/db/models";
import { buildData, createOrganization, createRow, delegate } from "../setup/fixtures";

/**
 * Tenant isolation, layer 4. For EVERY tenant model (taken from Prisma's
 * metadata, so new models are covered automatically), records exist in
 * organizations A and B, and every operation through forOrg(A) is tried
 * against B's record. None may read, change or delete it.
 */

type Delegate = Record<string, (args?: unknown) => Promise<unknown>>;
const tenantDelegate = (db: TenantDb, model: string) =>
  (db as unknown as Record<string, Delegate>)[model[0]!.toLowerCase() + model.slice(1)]!;

let orgA: { id: string };
let orgB: { id: string };

beforeAll(async () => {
  orgA = await createOrganization("Alpha");
  orgB = await createOrganization("Beta");
});

const models = [...TENANT_MODELS].sort();

describe.each(models)("%s", (model) => {
  let recordB: Record<string, unknown> & { id: string };
  let snapshotB: string;

  beforeAll(async () => {
    await createRow(model, orgA.id);
    recordB = await createRow(model, orgB.id);
    snapshotB = JSON.stringify(await delegate(model).findUnique!({ where: { id: recordB.id } }), (_k, v) =>
      typeof v === "bigint" ? v.toString() : v,
    );
  });

  const db = () => tenantDelegate(forOrg(orgA.id), model);

  it("can't read B's record", async () => {
    expect(await db().findUnique!({ where: { id: recordB.id } })).toBeNull();
    expect(await db().findFirst!({ where: { id: recordB.id } })).toBeNull();
    expect(await db().findMany!({ where: { id: recordB.id } })).toEqual([]);
    expect(await db().count!({ where: { id: recordB.id } })).toBe(0);
    const aggregate = (await db().aggregate!({ where: { id: recordB.id }, _count: { _all: true } })) as {
      _count: { _all: number };
    };
    expect(aggregate._count._all).toBe(0);
    await expect(db().findUniqueOrThrow!({ where: { id: recordB.id } })).rejects.toThrow();
    await expect(db().findFirstOrThrow!({ where: { id: recordB.id } })).rejects.toThrow();
  });

  it("lists and groups only A's rows", async () => {
    const rows = (await db().findMany!()) as { organizationId: string }[];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.organizationId === orgA.id)).toBe(true);
    const groups = (await db().groupBy!({ by: ["organizationId"], _count: { _all: true } })) as {
      organizationId: string;
    }[];
    expect(groups.map((group) => group.organizationId)).toEqual([orgA.id]);
  });

  it("can't update or delete B's record", async () => {
    await expect(db().update!({ where: { id: recordB.id }, data: {} })).rejects.toThrow();
    expect(await db().updateMany!({ where: { id: recordB.id }, data: {} })).toEqual({ count: 0 });
    await expect(db().delete!({ where: { id: recordB.id } })).rejects.toThrow();
    expect(await db().deleteMany!({ where: { id: recordB.id } })).toEqual({ count: 0 });
  });

  it("upsert against B's record never touches it", async () => {
    try {
      const created = (await db().upsert!({
        where: { id: recordB.id },
        create: await buildData(model, orgA.id),
        update: {},
      })) as { id: string; organizationId: string };
      expect(created.organizationId).toBe(orgA.id);
      expect(created.id).not.toBe(recordB.id);
    } catch {
      // A unique constraint inside A may refuse the create — also fine.
    }
  });

  it("refuses to create or move rows into B", async () => {
    const data = await buildData(model, orgA.id);
    await expect(db().create!({ data: { ...data, organizationId: orgB.id } })).rejects.toBeInstanceOf(TenantViolation);
    await expect(db().createMany!({ data: [{ ...data, organizationId: orgB.id }] })).rejects.toBeInstanceOf(
      TenantViolation,
    );
    await expect(db().updateMany!({ where: {}, data: { organizationId: orgB.id } })).rejects.toBeInstanceOf(
      TenantViolation,
    );
    await expect(db().findMany!({ where: { organizationId: orgB.id } })).rejects.toBeInstanceOf(TenantViolation);
  });

  it("refuses compound unique keys naming B", async () => {
    const compound = Prisma.dmmf.datamodel.models
      .find((item) => item.name === model)!
      .uniqueFields.find((fields) => fields[0] === "organizationId" && fields.length > 1);
    if (!compound) return;
    const key = compound.join("_");
    const value = Object.fromEntries(compound.map((field) => [field, recordB[field]]));
    await expect(db().findUnique!({ where: { [key]: value } })).rejects.toBeInstanceOf(TenantViolation);
  });

  it("left B's record exactly as it was", async () => {
    const after = JSON.stringify(await delegate(model).findUnique!({ where: { id: recordB.id } }), (_k, v) =>
      typeof v === "bigint" ? v.toString() : v,
    );
    expect(after).toBe(snapshotB);
  });

  it("database foreign keys refuse links to B's rows", async () => {
    const definition = Prisma.dmmf.datamodel.models.find((item) => item.name === model)!;
    const tenantRelation = definition.fields.find(
      (field) =>
        field.kind === "object" &&
        field.isRequired &&
        TENANT_MODELS.has(field.type) &&
        field.relationFromFields?.[0] === "organizationId" &&
        field.relationFromFields.length === 2,
    );
    if (!tenantRelation) return;
    const parentB = await createRow(tenantRelation.type, orgB.id);
    const data = await buildData(model, orgA.id);
    data[tenantRelation.relationFromFields![1]!] = parentB.id;
    // Straight through the raw client: this is the database itself refusing.
    await expect(delegate(model).create!({ data })).rejects.toMatchObject({ code: "P2003" });
  });
});

describe("the tenant client", () => {
  it("reaches only its own Organization row", async () => {
    const db = forOrg(orgA.id);
    expect((await db.organization.findFirst())?.id).toBe(orgA.id);
    await expect(db.organization.findUnique({ where: { id: orgB.id } })).rejects.toBeInstanceOf(TenantViolation);
    await expect(db.organization.update({ where: { id: orgB.id }, data: { legalName: "x" } })).rejects.toBeInstanceOf(
      TenantViolation,
    );
    await expect(
      (db.organization as unknown as Delegate).findMany!(),
    ).rejects.toBeInstanceOf(TenantViolation);
    await expect(
      (db.organization as unknown as Delegate).deleteMany!(),
    ).rejects.toBeInstanceOf(TenantViolation);
  });

  it("has no access to global tables", async () => {
    const db = forOrg(orgA.id) as unknown as Record<string, Delegate>;
    await expect(db.user!.findMany!()).rejects.toBeInstanceOf(TenantViolation);
    await expect(db.session!.findMany!()).rejects.toBeInstanceOf(TenantViolation);
    await expect(db.platformAdmin!.findMany!()).rejects.toBeInstanceOf(TenantViolation);
  });

  it("doesn't expose raw SQL", () => {
    const db = forOrg(orgA.id) as unknown as Record<string, unknown>;
    expect(() => db.$queryRaw).toThrow(TenantViolation);
    expect(() => db.$executeRaw).toThrow(TenantViolation);
    expect(() => db.$queryRawUnsafe).toThrow(TenantViolation);
    expect(() => db.$executeRawUnsafe).toThrow(TenantViolation);
  });

  it("stays scoped inside transactions", async () => {
    const branches = await forOrg(orgA.id).$transaction((tx) => tx.branch.findMany());
    expect(branches.length).toBeGreaterThan(0);
    expect(branches.every((branch) => branch.organizationId === orgA.id)).toBe(true);
    await expect(
      forOrg(orgA.id).$transaction((tx) => tx.branch.findMany({ where: { organizationId: orgB.id } })),
    ).rejects.toBeInstanceOf(TenantViolation);
    expect(() => (forOrg(orgA.id).$transaction as unknown as (x: unknown[]) => unknown)([])).toThrow(TenantViolation);
  });

  it("is read-only for support sessions", async () => {
    const db = forOrg(orgA.id, { readOnly: true });
    expect((await db.branch.findMany()).length).toBeGreaterThan(0);
    await expect(
      db.branch.create({ data: { organizationId: orgA.id, name: "X", code: "RO1", stateCode: "29" } }),
    ).rejects.toBeInstanceOf(ReadOnlyViolation);
    await expect(db.branch.updateMany({ data: { name: "Y" } })).rejects.toBeInstanceOf(ReadOnlyViolation);
    await expect(db.branch.deleteMany()).rejects.toBeInstanceOf(ReadOnlyViolation);
    expect(() => db.$transaction(async () => 1)).toThrow(ReadOnlyViolation);
  });

  it("refuses organization.connect on create", async () => {
    await expect(
      forOrg(orgA.id).branch.create({
        data: { name: "X", code: "CN1", stateCode: "29", organization: { connect: { id: orgB.id } } } as never,
      }),
    ).rejects.toBeInstanceOf(TenantViolation);
  });

  it("still counts B's data through the raw client (sanity check)", async () => {
    expect(await raw.branch.count({ where: { organizationId: orgB.id } })).toBeGreaterThan(0);
  });
});
