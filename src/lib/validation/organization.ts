import { z } from "zod";
import { checkSeries } from "@/lib/numbering";
import { MAX_RANK, MIN_CUSTOM_RANK } from "@/lib/rbac";
import {
  dateOnlyField,
  emailField,
  optionalEmail,
  optionalGstin,
  optionalPan,
  optionalText,
  phoneField,
  pincodeField,
  requiredText,
  stateCodeField,
  urlField,
} from "./common";

export const companyProfileSchema = z.object({
  legalName: requiredText("Legal name", 160),
  tradeName: optionalText(160),
  addressLine1: optionalText(200),
  addressLine2: optionalText(200),
  city: optionalText(80),
  pincode: pincodeField,
  phone: phoneField,
  email: optionalEmail,
  website: urlField,
  version: z.number().int(),
});

export const gstSettingsSchema = z
  .object({
    gstRegistration: z.enum(["REGULAR", "COMPOSITION", "UNREGISTERED"]),
    gstin: optionalGstin,
    pan: optionalPan,
    stateCode: stateCodeField,
    version: z.number().int(),
  })
  .superRefine((value, ctx) => {
    if (value.gstRegistration !== "UNREGISTERED" && !value.gstin) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["gstin"],
        message: "A registered business needs its GSTIN.",
      });
    }
    if (value.gstin && value.gstin.slice(0, 2) !== value.stateCode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["stateCode"],
        message: "The state must match the GSTIN's first two digits.",
      });
    }
    if (value.gstin && value.pan && value.gstin.slice(2, 12) !== value.pan) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pan"],
        message: "The PAN must match characters 3 to 12 of the GSTIN.",
      });
    }
  });

const codeText = requiredText("Code", 12).regex(/^[A-Za-z0-9-]+$/, "Letters, digits and - only.");

export const branchSchema = z
  .object({
    id: z.string().optional(),
    name: requiredText("Name", 120),
    code: codeText,
    gstin: optionalGstin,
    stateCode: stateCodeField,
    addressLine1: optionalText(200),
    addressLine2: optionalText(200),
    city: optionalText(80),
    pincode: pincodeField,
    phone: phoneField,
    isActive: z.boolean(),
    version: z.number().int().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.gstin && value.gstin.slice(0, 2) !== value.stateCode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["stateCode"],
        message: "The state must match the GSTIN's first two digits.",
      });
    }
  });

export const warehouseSchema = z.object({
  id: z.string().optional(),
  branchId: z.string().min(1, "Choose a branch."),
  name: requiredText("Name", 120),
  code: codeText,
  address: optionalText(300),
  isActive: z.boolean(),
  version: z.number().int().optional(),
});

export const financialYearSchema = z.object({
  startDate: dateOnlyField("Start date").refine(
    (value) => value.slice(5) === "04-01",
    "A financial year starts on 1 April.",
  ),
});

export const numberSeriesSchema = z
  .object({
    id: z.string().min(1),
    prefix: z.string().trim().max(16),
    padding: z.coerce.number().int(),
    nextNumber: z.coerce.number().int().min(1, "The next number must be at least 1.").max(99_999_999),
    mode: z.enum(["AUTO", "MANUAL"]),
    version: z.number().int(),
  })
  .superRefine((value, ctx) => {
    const check = checkSeries(value.prefix, value.padding);
    if (!check.ok) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["prefix"], message: check.message });
  });

const hexColor = z
  .string()
  .trim()
  .regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/, "Use a colour like #5b8cff.")
  .transform((value) => value.toLowerCase());

export const brandingSchema = z.object({
  accentColor: hexColor,
  accentColor2: hexColor,
});

export const smtpSchema = z
  .object({
    smtpEnabled: z.boolean(),
    smtpHost: optionalText(200),
    smtpPort: z.coerce.number().int().min(1).max(65535).optional().nullable(),
    smtpSecure: z.boolean(),
    smtpUser: optionalText(200),
    /** Empty keeps the stored password. */
    smtpPassword: z.string().max(500).optional(),
    smtpFromName: optionalText(120),
    smtpFromEmail: optionalEmail,
  })
  .superRefine((value, ctx) => {
    if (!value.smtpEnabled) return;
    if (!value.smtpHost) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["smtpHost"], message: "Enter the SMTP server." });
    }
    if (!value.smtpPort) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["smtpPort"],
        message: "Enter the port (usually 587 or 465).",
      });
    }
    if (!value.smtpFromEmail) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["smtpFromEmail"],
        message: "Enter the address mail is sent from.",
      });
    }
  });
export type SmtpInput = z.input<typeof smtpSchema>;

export const notificationSettingsSchema = z.object({
  notificationRetentionDays: z.coerce
    .number()
    .int()
    .min(7, "Keep notifications for at least 7 days.")
    .max(3650, "At most 3650 days."),
});

export const inviteSchema = z.object({
  email: emailField,
  roleId: z.string().min(1, "Choose a role."),
});

export const roleSchema = z.object({
  id: z.string().optional(),
  name: requiredText("Name", 60),
  description: optionalText(300),
  rank: z.coerce
    .number()
    .int()
    .min(MIN_CUSTOM_RANK, `Rank must be at least ${MIN_CUSTOM_RANK}.`)
    .max(MAX_RANK, `Rank must be at most ${MAX_RANK}.`),
  capabilities: z.array(z.string()).max(100),
  version: z.number().int().optional(),
});

export const createOrganizationSchema = z.object({
  organizationName: requiredText("Business name", 160),
  stateCode: stateCodeField,
});
