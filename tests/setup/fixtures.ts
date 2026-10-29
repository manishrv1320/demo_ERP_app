import { Prisma } from "@prisma/client";
import { raw } from "@/server/db/raw";
import { provisionOrganization } from "@/server/db/provision";
import { TENANT_MODELS } from "@/server/db/models";

/**
 * Test data generated from Prisma's model metadata, so a new model is covered
 * by the isolation tests automatically: required fields get unique dummy
 * values and required relations get a freshly created parent in the same
 * organization. Models with special needs get an override below.
 */

type Row = Record<string, unknown> & { id: string };
type Model = (typeof Prisma.dmmf.datamodel.models)[number];

const MODELS = new Map(Prisma.dmmf.datamodel.models.map((model) => [model.name, model]));
const ENUMS = new Map(Prisma.dmmf.datamodel.enums.map((item) => [item.name, item.values.map((value) => value.name)]));

let counter = 0;
const next = () => (counter += 1);

export function delegate(model: string) {
  const key = model[0]!.toLowerCase() + model.slice(1);
  return (raw as unknown as Record<string, Record<string, (args?: unknown) => Promise<unknown>>>)[key]!;
}

export async function createUser(): Promise<Row> {
  const n = next();
  return (await raw.user.create({
    data: { email: `user${n}-${Date.now()}@example.test`, name: `User ${n}`, passwordHash: "x" },
  })) as unknown as Row;
}

export async function createOrganization(name = "Org"): Promise<{ id: string; ownerId: string }> {
  const owner = await createUser();
  const { organizationId } = await raw.$transaction((tx) =>
    provisionOrganization(tx, { ownerUserId: owner.id, legalName: `${name} ${next()}`, stateCode: "29" }),
  );
  return { id: organizationId, ownerId: owner.id };
}

/** Rows that exist exactly once per organization: reuse the provisioned one. */
const SINGLETONS = new Set(["OrganizationSettings"]);

function dummyScalar(model: Model, field: Model["fields"][number]): unknown {
  const n = next();
  if (field.kind === "enum") return ENUMS.get(field.type)![0];
  switch (field.type) {
    case "String":
      return `${field.name.slice(0, 6)}${n}`;
    case "Int":
      return 1;
    case "BigInt":
      return BigInt(1);
    case "Boolean":
      return false;
    case "Float":
      return 1;
    case "DateTime":
      // Distinct dates, so date-based unique keys (financial year start) don't collide.
      return new Date(Date.UTC(2000, 0, 1) + n * 86_400_000);
    case "Json":
      return model.name === "Role" && field.name === "capabilities" ? [] : {};
    default:
      throw new Error(`fixtures: no dummy value for ${model.name}.${field.name} (${field.type})`);
  }
}

/** Build valid create data for a tenant model in an organization, creating parents as needed. */
export async function buildData(modelName: string, organizationId: string): Promise<Record<string, unknown>> {
  const model = MODELS.get(modelName)!;
  const data: Record<string, unknown> = { organizationId };
  const foreignKeys = new Set<string>();

  for (const field of model.fields) {
    if (field.kind !== "object" || !field.relationFromFields?.length) continue;
    field.relationFromFields.forEach((name) => foreignKeys.add(name));
    if (!field.isRequired) continue;
    if (field.type === "Organization") continue;

    const parent = TENANT_MODELS.has(field.type)
      ? await createRow(field.type, organizationId)
      : field.type === "User"
        ? await createUser()
        : null;
    if (!parent) throw new Error(`fixtures: no factory for required relation ${modelName}.${field.name} → ${field.type}`);
    field.relationFromFields.forEach((from, index) => {
      const to = field.relationToFields![index]!;
      if (from !== "organizationId") data[from] = parent[to];
    });
  }

  for (const field of model.fields) {
    if (field.kind === "object" || field.isId || field.isUpdatedAt || field.hasDefaultValue) continue;
    if (!field.isRequired || field.name in data || foreignKeys.has(field.name)) continue;
    data[field.name] = dummyScalar(model, field);
  }
  return data;
}

export async function createRow(modelName: string, organizationId: string): Promise<Row> {
  if (SINGLETONS.has(modelName)) {
    return (await delegate(modelName).findFirst!({ where: { organizationId } })) as Row;
  }
  return (await delegate(modelName).create!({ data: await buildData(modelName, organizationId) })) as Row;
}
