import "server-only";

import { Prisma } from "@prisma/client";
import { Zip, ZipDeflate } from "fflate";
import { csvCell } from "@/lib/csv";
import { readOrganizationFile } from "@/server/files/storage";
import { TENANT_MODELS } from "./models";
import { forOrg } from "./tenant";

/**
 * The full organization export, offered before deletion and on demand: one CSV
 * per tenant table (taken from Prisma's metadata, so tables added in later
 * phases are included automatically) plus every uploaded file, streamed as a
 * zip so memory stays flat however large the books get.
 *
 * Secrets never leave: encrypted columns (*Enc) and token hashes are dropped,
 * and storage paths are replaced by the files themselves.
 */
const EXCLUDED_FIELD = /(Enc|tokenHash|storagePath)$/;
const BATCH = 1000;

type Delegate = { findMany(args: unknown): Promise<Record<string, unknown>[]> };

function columnsOf(modelName: string): string[] {
  const model = Prisma.dmmf.datamodel.models.find((item) => item.name === modelName)!;
  return model.fields
    .filter((field) => field.kind !== "object" && !EXCLUDED_FIELD.test(field.name))
    .map((field) => field.name);
}

function cell(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (value !== null && typeof value === "object") return csvCell(JSON.stringify(value));
  return csvCell(value);
}

export function organizationExportStream(organizationId: string): ReadableStream<Uint8Array> {
  const db = forOrg(organizationId, { readOnly: true });
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const zip = new Zip((error, chunk, final) => {
        if (error) return controller.error(error);
        controller.enqueue(chunk);
        if (final) controller.close();
      });

      try {
        const readme = new ZipDeflate("README.txt", { level: 6 });
        zip.add(readme);
        readme.push(
          encoder.encode(
            "Hyperzen ERP — full data export\r\n\r\nOne CSV per table (UTF-8, comma-separated). Amounts are in paise (divide by 100 for rupees), quantities in thousandths of a unit, rates in basis points (1800 = 18%).\r\nUploaded files are in files/.\r\n",
          ),
          true,
        );

        // The organization's own record first: company details, GSTIN, address.
        const orgColumns = columnsOf("Organization");
        const organization = (await db.organization.findFirst({
          select: Object.fromEntries(orgColumns.map((column) => [column, true])),
        })) as Record<string, unknown> | null;
        const orgEntry = new ZipDeflate("Organization.csv", { level: 6 });
        zip.add(orgEntry);
        orgEntry.push(
          encoder.encode(`﻿${orgColumns.join(",")}\r\n${orgColumns.map((column) => cell(organization?.[column])).join(",")}\r\n`),
          true,
        );

        for (const model of [...TENANT_MODELS].sort()) {
          const delegate = (db as unknown as Record<string, Delegate>)[model[0]!.toLowerCase() + model.slice(1)]!;
          const columns = columnsOf(model);
          const entry = new ZipDeflate(`${model}.csv`, { level: 6 });
          zip.add(entry);
          entry.push(encoder.encode(`﻿${columns.join(",")}\r\n`));
          let cursor: string | undefined;
          for (;;) {
            const rows = await delegate.findMany({
              orderBy: { id: "asc" },
              take: BATCH,
              ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
              select: Object.fromEntries(columns.map((column) => [column, true])),
            });
            if (rows.length === 0) break;
            entry.push(encoder.encode(rows.map((row) => columns.map((column) => cell(row[column])).join(",")).join("\r\n") + "\r\n"));
            cursor = rows[rows.length - 1]!.id as string;
            if (rows.length < BATCH) break;
          }
          entry.push(new Uint8Array(), true);
        }

        const files = await db.storedFile.findMany({ select: { id: true, storagePath: true, originalName: true } });
        for (const file of files) {
          const bytes = await readOrganizationFile(organizationId, file.storagePath);
          if (!bytes) continue;
          const safeName = file.originalName.replace(/[^\w.\- ]+/g, "_").slice(0, 100) || "file";
          const entry = new ZipDeflate(`files/${file.id}-${safeName}`, { level: 6 });
          zip.add(entry);
          entry.push(new Uint8Array(bytes), true);
        }
        zip.end();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}
