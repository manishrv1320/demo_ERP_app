import { readFileSync } from "node:fs";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { GLOBAL_MODELS, ORGANIZATION_MODEL, TENANT_MODELS } from "@/server/db/models";

/**
 * Schema lint: the conventions tenant isolation depends on (docs/phase-0-plan.md,
 * section 2). A new model that breaks one fails the build.
 */

const models = Prisma.dmmf.datamodel.models;
const schema = readFileSync(path.resolve(import.meta.dirname, "../../prisma/schema.prisma"), "utf8");

/** Fields that are looked up before a person belongs to the organization, so they're globally unique. */
const GLOBALLY_UNIQUE_TOKENS = new Set(["Invitation.tokenHash"]);

describe("schema conventions", () => {
  it("classifies every model", () => {
    for (const model of models) {
      const classified =
        TENANT_MODELS.has(model.name) || GLOBAL_MODELS.has(model.name) || model.name === ORGANIZATION_MODEL;
      expect(classified, model.name).toBe(true);
    }
    expect(TENANT_MODELS.size).toBeGreaterThan(5);
  });

  it("never names a global column organizationId", () => {
    for (const name of GLOBAL_MODELS) {
      const model = models.find((item) => item.name === name)!;
      expect(model.fields.some((field) => field.name === "organizationId"), name).toBe(false);
    }
  });

  describe.each([...TENANT_MODELS].sort())("%s", (name) => {
    const model = models.find((item) => item.name === name)!;

    it("has a required organizationId and @@unique([organizationId, id])", () => {
      const field = model.fields.find((item) => item.name === "organizationId")!;
      expect(field.isRequired).toBe(true);
      expect(model.uniqueFields.some((fields) => fields.join(",") === "organizationId,id")).toBe(true);
    });

    it("keeps organizationId in every unique constraint", () => {
      for (const fields of model.uniqueFields) {
        expect(fields[0], `${name} @@unique(${fields.join(", ")})`).toBe("organizationId");
      }
      for (const field of model.fields) {
        if (!field.isUnique) continue;
        const allowed = field.name === "organizationId" || GLOBALLY_UNIQUE_TOKENS.has(`${name}.${field.name}`);
        expect(allowed, `${name}.${field.name} is @unique without organizationId`).toBe(true);
      }
    });

    it("links to other tenant models only through composite (organizationId, id) keys", () => {
      for (const field of model.fields) {
        if (field.kind !== "object" || !field.relationFromFields?.length) continue;
        if (field.type === ORGANIZATION_MODEL) {
          expect(field.relationFromFields).toEqual(["organizationId"]);
          expect(field.relationOnDelete, `${name}.${field.name}`).toBe("Restrict");
          continue;
        }
        if (!TENANT_MODELS.has(field.type)) continue;
        expect(field.relationFromFields[0], `${name}.${field.name}`).toBe("organizationId");
        expect(field.relationToFields, `${name}.${field.name}`).toEqual(["organizationId", "id"]);
      }
    });

    it("has an index or unique constraint that starts with organizationId", () => {
      const block = schema.match(new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? "";
      expect(/@@(unique|index)\(\[organizationId\b/.test(block)).toBe(true);
    });
  });
});
