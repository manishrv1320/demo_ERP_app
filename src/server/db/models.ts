import { Prisma } from "@prisma/client";

/**
 * Which models are tenant data. A model is a tenant model exactly when it has
 * an `organizationId` field — the schema convention guarantees global models
 * never use that name (platform tables say `targetOrganizationId`), and
 * tests/isolation/schema.test.ts fails the build if that ever drifts.
 */
const models = Prisma.dmmf.datamodel.models;

export const TENANT_MODELS: ReadonlySet<string> = new Set(
  models.filter((model) => model.fields.some((field) => field.name === "organizationId")).map((model) => model.name),
);

/** The tenant root. Reachable through the tenant client only as the caller's own organization. */
export const ORGANIZATION_MODEL = "Organization";

export const GLOBAL_MODELS: ReadonlySet<string> = new Set(
  models
    .map((model) => model.name)
    .filter((name) => !TENANT_MODELS.has(name) && name !== ORGANIZATION_MODEL),
);
