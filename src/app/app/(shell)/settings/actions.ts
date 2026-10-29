"use server";

import { z } from "zod";
import { financialYearFor, parseDateOnly } from "@/lib/dates";
import { stateName } from "@/lib/gst/states";
import type { ActionResult } from "@/lib/utils";
import {
  branchSchema,
  brandingSchema,
  companyProfileSchema,
  financialYearSchema,
  gstSettingsSchema,
  notificationSettingsSchema,
  numberSeriesSchema,
  smtpSchema,
  warehouseSchema,
} from "@/lib/validation/organization";
import { describeChanges, logActivity } from "@/server/activity";
import { action, actionContext } from "@/server/auth/action";
import { seriesRows } from "@/server/db/provision";
import { emailLayout, sendWithSmtp } from "@/server/email/transport";
import { StaleVersionError, UserError, describeError } from "@/server/errors";
import { detectImageType, deleteOrganizationFile, writeOrganizationFile } from "@/server/files/storage";
import { saveRevision } from "@/server/revisions";
import { decryptText, encryptText } from "@/server/security/encryption";
import { MINUTE, rateLimit } from "@/server/security/rate-limit";

/** Prisma's "record not found" on a versioned update means someone else saved first. */
async function versioned<T>(work: Promise<T>): Promise<T> {
  try {
    return await work;
  } catch (error) {
    if ((error as { code?: string }).code === "P2025") throw new StaleVersionError();
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Company profile and GST
// ---------------------------------------------------------------------------

const PROFILE_LABELS = {
  legalName: "Legal name",
  tradeName: "Trade name",
  addressLine1: "Address",
  addressLine2: "Address line 2",
  city: "City",
  pincode: "PIN code",
  phone: "Phone",
  email: "Email",
  website: "Website",
};

export const saveCompanyProfileAction = action(
  { capability: "settings.write", schema: companyProfileSchema },
  async (ctx, { version, ...data }) => {
    await ctx.db.$transaction(async (tx) => {
      const before = await tx.organization.findFirstOrThrow();
      await saveRevision(ctx, tx, { entityType: "Organization", entityId: before.id, label: "Company profile", data: before });
      await versioned(tx.organization.update({ where: { id: ctx.org.id, version }, data: { ...data, version: { increment: 1 } } }));
      await logActivity(
        ctx,
        {
          action: "settings.company",
          entityType: "Organization",
          entityId: ctx.org.id,
          summary: `Company profile updated${describeChanges(before, data, PROFILE_LABELS) ? ` — ${describeChanges(before, data, PROFILE_LABELS)}` : ""}`,
        },
        tx,
      );
    });
    return { ok: true, message: "Company profile saved." };
  },
);

export const saveGstSettingsAction = action(
  { capability: "settings.write", schema: gstSettingsSchema },
  async (ctx, { version, ...data }) => {
    await ctx.db.$transaction(async (tx) => {
      const before = await tx.organization.findFirstOrThrow();
      await saveRevision(ctx, tx, { entityType: "Organization", entityId: before.id, label: "GST settings", data: before });
      await versioned(tx.organization.update({ where: { id: ctx.org.id, version }, data: { ...data, version: { increment: 1 } } }));
      // The head office follows the organization's registration.
      await tx.branch.updateMany({
        where: { isHeadOffice: true },
        data: { gstin: data.gstin, stateCode: data.stateCode, version: { increment: 1 } },
      });
      await logActivity(
        ctx,
        {
          action: "settings.gst",
          entityType: "Organization",
          entityId: ctx.org.id,
          summary: `GST settings updated — ${data.gstRegistration.toLowerCase()}, ${stateName(data.stateCode)}${data.gstin ? `, GSTIN ${data.gstin}` : ""}`,
        },
        tx,
      );
    });
    return { ok: true, message: "GST settings saved." };
  },
);

// ---------------------------------------------------------------------------
// Branches and warehouses
// ---------------------------------------------------------------------------

export const saveBranchAction = action({ capability: "settings.write", schema: branchSchema }, async (ctx, input) => {
  const { id, version, ...data } = input;
  const code = data.code.toUpperCase();
  await ctx.db.$transaction(async (tx) => {
    if (id) {
      const before = await tx.branch.findUniqueOrThrow({ where: { id } });
      if (before.isHeadOffice && !data.isActive) throw new UserError("The head office can't be deactivated.", "isActive");
      await saveRevision(ctx, tx, { entityType: "Branch", entityId: id, label: `Branch ${before.name}`, data: before });
      // The head office takes its GSTIN and state from Settings → GST.
      const registration = before.isHeadOffice ? { gstin: before.gstin, stateCode: before.stateCode, isActive: true } : {};
      await versioned(
        tx.branch.update({ where: { id, version }, data: { ...data, ...registration, code, version: { increment: 1 } } }),
      );
      await logActivity(ctx, { action: "branch.update", entityType: "Branch", entityId: id, summary: `Branch ${data.name} updated` }, tx);
      return;
    }
    const branch = await tx.branch.create({ data: { ...data, code, organizationId: ctx.org.id } });
    const years = await tx.financialYear.findMany({ select: { id: true } });
    await tx.numberSeries.createMany({
      data: seriesRows(ctx.org.id, [branch], years.map((year) => year.id)),
      skipDuplicates: true,
    });
    await logActivity(ctx, { action: "branch.create", entityType: "Branch", entityId: branch.id, summary: `Branch ${branch.name} (${code}) added` }, tx);
  });
  return { ok: true, message: id ? "Branch saved." : "Branch added with its own number series." };
});

export const saveWarehouseAction = action({ capability: "settings.write", schema: warehouseSchema }, async (ctx, input) => {
  const { id, version, ...data } = input;
  const code = data.code.toUpperCase();
  await ctx.db.$transaction(async (tx) => {
    // The composite foreign key would refuse another organization's branch anyway; this gives a clear message.
    const branch = await tx.branch.findUnique({ where: { id: data.branchId }, select: { id: true } });
    if (!branch) throw new UserError("Choose a branch.", "branchId");
    if (id) {
      const before = await tx.warehouse.findUniqueOrThrow({ where: { id } });
      if (!data.isActive) {
        const active = await tx.warehouse.count({ where: { isActive: true, id: { not: id } } });
        if (active === 0) throw new UserError("Keep at least one active warehouse.", "isActive");
      }
      await saveRevision(ctx, tx, { entityType: "Warehouse", entityId: id, label: `Warehouse ${before.name}`, data: before });
      await versioned(tx.warehouse.update({ where: { id, version }, data: { ...data, code, version: { increment: 1 } } }));
      await logActivity(ctx, { action: "warehouse.update", entityType: "Warehouse", entityId: id, summary: `Warehouse ${data.name} updated` }, tx);
      return;
    }
    const warehouse = await tx.warehouse.create({ data: { ...data, code, organizationId: ctx.org.id } });
    await logActivity(ctx, { action: "warehouse.create", entityType: "Warehouse", entityId: warehouse.id, summary: `Warehouse ${warehouse.name} (${code}) added` }, tx);
  });
  return { ok: true, message: "Warehouse saved." };
});

// ---------------------------------------------------------------------------
// Financial years and number series
// ---------------------------------------------------------------------------

export const addFinancialYearAction = action({ capability: "settings.write", schema: financialYearSchema }, async (ctx, input) => {
  const fy = financialYearFor(input.startDate);
  await ctx.db.$transaction(async (tx) => {
    const exists = await tx.financialYear.findFirst({ where: { startDate: parseDateOnly(fy.startDate) } });
    if (exists) throw new UserError(`Financial year ${fy.label} already exists.`, "startDate");
    const year = await tx.financialYear.create({
      data: {
        organizationId: ctx.org.id,
        label: fy.label,
        startDate: parseDateOnly(fy.startDate),
        endDate: parseDateOnly(fy.endDate),
      },
    });
    // New series copy each branch's latest prefixes, starting again at 1.
    const branches = await tx.branch.findMany({ select: { id: true, code: true, isHeadOffice: true } });
    const latest = await tx.numberSeries.findMany({
      orderBy: { financialYear: { startDate: "desc" } },
      select: { branchId: true, documentType: true, prefix: true, padding: true, mode: true },
    });
    const rows = seriesRows(ctx.org.id, branches, [year.id]).map((row) => {
      const previous = latest.find((series) => series.branchId === row.branchId && series.documentType === row.documentType);
      return previous ? { ...row, prefix: previous.prefix, padding: previous.padding, mode: previous.mode } : row;
    });
    await tx.numberSeries.createMany({ data: rows, skipDuplicates: true });
    await logActivity(ctx, { action: "financial-year.create", entityType: "FinancialYear", entityId: year.id, summary: `Financial year ${fy.label} added` }, tx);
  });
  return { ok: true, message: `Financial year ${fy.label} added.` };
});

export const saveNumberSeriesAction = action({ capability: "settings.write", schema: numberSeriesSchema }, async (ctx, input) => {
  const { id, version, ...data } = input;
  await ctx.db.$transaction(async (tx) => {
    const before = await tx.numberSeries.findUniqueOrThrow({ where: { id } });
    // Two series of the same kind in one year can't share a prefix, or they'd issue the same numbers.
    const clash = await tx.numberSeries.findFirst({
      where: { id: { not: id }, documentType: before.documentType, financialYearId: before.financialYearId, prefix: data.prefix },
      select: { id: true },
    });
    if (clash) throw new UserError("Another branch already uses this prefix for the same document in this year.", "prefix");
    await saveRevision(ctx, tx, { entityType: "NumberSeries", entityId: id, label: `Series ${before.prefix}`, data: before });
    await versioned(tx.numberSeries.update({ where: { id, version }, data: { ...data, version: { increment: 1 } } }));
    await logActivity(
      ctx,
      {
        action: "number-series.update",
        entityType: "NumberSeries",
        entityId: id,
        summary: `Number series ${before.documentType} changed — ${describeChanges(before, data, { prefix: "prefix", padding: "digits", nextNumber: "next number", mode: "mode" }) || "no change"}`,
      },
      tx,
    );
  });
  return { ok: true, message: "Number series saved." };
});

// ---------------------------------------------------------------------------
// Branding
// ---------------------------------------------------------------------------

export const saveBrandingAction = action({ capability: "settings.write", schema: brandingSchema }, async (ctx, input) => {
  await ctx.db.organization.update({ where: { id: ctx.org.id }, data: input });
  await logActivity(ctx, { action: "settings.branding", entityType: "Organization", entityId: ctx.org.id, summary: `Brand colours set to ${input.accentColor} and ${input.accentColor2}` });
  return { ok: true, message: "Colours saved." };
});

export const resetBrandingAction = action({ capability: "settings.write", schema: z.object({}) }, async (ctx) => {
  await ctx.db.organization.update({ where: { id: ctx.org.id }, data: { accentColor: null, accentColor2: null } });
  return { ok: true, message: "Colours reset to Hyperzen's defaults." };
});

const MAX_LOGO_BYTES = 1024 * 1024;

export async function uploadLogoAction(formData: FormData): Promise<ActionResult> {
  const context = await actionContext("settings.write");
  if (!context.ok) return context.result;
  const { ctx } = context;
  try {
    const file = formData.get("logo");
    if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose an image." };
    if (file.size > MAX_LOGO_BYTES) return { ok: false, message: "The logo must be 1 MB or smaller." };
    const bytes = Buffer.from(await file.arrayBuffer());
    const type = detectImageType(bytes);
    if (!type) return { ok: false, message: "Use a PNG, JPEG or WebP image." };

    const previous = await ctx.db.organization.findFirstOrThrow({ select: { logoFileId: true } });
    const stored = await writeOrganizationFile({ organizationId: ctx.org.id, category: "logo", bytes, extension: type.extension });
    const record = await ctx.db.storedFile.create({
      data: {
        organizationId: ctx.org.id,
        category: "LOGO",
        storagePath: stored.relativePath,
        originalName: file.name.slice(0, 200) || `logo.${type.extension}`,
        mimeType: type.mime,
        size: bytes.length,
        sha256: stored.hash,
        uploadedById: ctx.user.id,
      },
    });
    await ctx.db.organization.update({ where: { id: ctx.org.id }, data: { logoFileId: record.id } });

    if (previous.logoFileId) {
      const old = await ctx.db.storedFile.findUnique({ where: { id: previous.logoFileId } });
      if (old) {
        await ctx.db.storedFile.delete({ where: { id: old.id } });
        await deleteOrganizationFile(ctx.org.id, old.storagePath);
      }
    }
    await logActivity(ctx, { action: "settings.logo", entityType: "Organization", entityId: ctx.org.id, summary: "Logo updated" });
    return { ok: true, message: "Logo saved." };
  } catch (error) {
    return { ok: false, message: describeError(error).message };
  }
}

export const removeLogoAction = action({ capability: "settings.write", schema: z.object({}) }, async (ctx) => {
  const organization = await ctx.db.organization.findFirstOrThrow({ select: { logoFileId: true } });
  if (!organization.logoFileId) return { ok: true };
  await ctx.db.organization.update({ where: { id: ctx.org.id }, data: { logoFileId: null } });
  const file = await ctx.db.storedFile.findUnique({ where: { id: organization.logoFileId } });
  if (file) {
    await ctx.db.storedFile.delete({ where: { id: file.id } });
    await deleteOrganizationFile(ctx.org.id, file.storagePath);
  }
  await logActivity(ctx, { action: "settings.logo", entityType: "Organization", entityId: ctx.org.id, summary: "Logo removed" });
  return { ok: true, message: "Logo removed." };
});

// ---------------------------------------------------------------------------
// Email (the organization's own SMTP, for sending documents)
// ---------------------------------------------------------------------------

export const saveSmtpAction = action({ capability: "settings.write", schema: smtpSchema }, async (ctx, input) => {
  const { smtpPassword, ...data } = input;
  const settings = await ctx.db.organizationSettings.findFirstOrThrow({ select: { id: true, smtpPasswordEnc: true } });
  const passwordEnc = smtpPassword ? encryptText(smtpPassword) : settings.smtpPasswordEnc;
  await ctx.db.organizationSettings.update({
    where: { id: settings.id },
    data: { ...data, smtpPort: data.smtpPort ?? null, smtpPasswordEnc: passwordEnc, version: { increment: 1 } },
  });
  await logActivity(ctx, {
    action: "settings.email",
    entityType: "OrganizationSettings",
    entityId: settings.id,
    summary: `Email sending ${data.smtpEnabled ? `turned on (${data.smtpHost})` : "turned off"}${smtpPassword ? "; password changed" : ""}`,
  });
  return { ok: true, message: "Email settings saved." };
});

export const sendTestEmailAction = action({ capability: "settings.write", schema: z.object({}) }, async (ctx) => {
  if (!rateLimit(`smtp-test:${ctx.org.id}`, 5, 10 * MINUTE).success) {
    return { ok: false, message: "Please wait a few minutes before sending another test." };
  }
  const settings = await ctx.db.organizationSettings.findFirstOrThrow();
  if (!settings.smtpEnabled || !settings.smtpHost || !settings.smtpPort || !settings.smtpFromEmail) {
    return { ok: false, message: "Turn email sending on and save the settings first." };
  }
  const message = emailLayout("Test email from Hyperzen ERP", [
    `This is a test from ${ctx.org.name}. If you can read it, documents can be emailed from Hyperzen ERP.`,
  ]);
  const result = await sendWithSmtp(
    {
      host: settings.smtpHost,
      port: settings.smtpPort,
      secure: settings.smtpSecure,
      user: settings.smtpUser,
      password: settings.smtpPasswordEnc ? decryptText(settings.smtpPasswordEnc) : null,
      fromName: settings.smtpFromName ?? ctx.org.name,
      fromEmail: settings.smtpFromEmail,
    },
    { to: ctx.user.email, subject: "Test email from Hyperzen ERP", ...message },
  );
  return result.sent ? { ok: true, message: `Test email sent to ${ctx.user.email}.` } : { ok: false, message: result.error };
});

// ---------------------------------------------------------------------------
// Notification retention
// ---------------------------------------------------------------------------

export const saveNotificationSettingsAction = action(
  { capability: "settings.write", schema: notificationSettingsSchema },
  async (ctx, input) => {
    const settings = await ctx.db.organizationSettings.findFirstOrThrow({ select: { id: true } });
    await ctx.db.organizationSettings.update({ where: { id: settings.id }, data: input });
    await logActivity(ctx, {
      action: "settings.notifications",
      entityType: "OrganizationSettings",
      entityId: settings.id,
      summary: `Notifications are now kept for ${input.notificationRetentionDays} days`,
    });
    return { ok: true, message: "Saved." };
  },
);
