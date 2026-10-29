import { z } from "zod";
import { checkGstin, isValidPan, normalizeGstin } from "@/lib/gst/gstin";
import { isStateCode } from "@/lib/gst/states";
import { isDateOnly } from "@/lib/dates";

/** Trimmed text; empty becomes null. */
export const optionalText = (max = 200) =>
  z
    .string()
    .trim()
    .max(max, `At most ${max} characters.`)
    .optional()
    .nullable()
    .transform((value) => (value ? value : null));

export const requiredText = (label: string, max = 200) =>
  z.string().trim().min(1, `${label} is required.`).max(max, `At most ${max} characters.`);

export const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Email is required.")
  .max(254, "That email address is too long.")
  .email("Enter a valid email address.");

export const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .optional()
  .nullable()
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || z.string().email().safeParse(value).success, "Enter a valid email address.");

export const phoneField = z
  .string()
  .trim()
  .max(20)
  .optional()
  .nullable()
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || /^\+?[\d\s-]{6,20}$/.test(value), "Enter a valid phone number.");

export const stateCodeField = z
  .string()
  .trim()
  .refine((value) => isStateCode(value) && value !== "96", "Choose a state.");

export const optionalGstin = z
  .string()
  .optional()
  .nullable()
  .transform((value) => normalizeGstin(value) || null)
  .superRefine((value, ctx) => {
    if (value === null) return;
    const result = checkGstin(value);
    if (!result.ok) ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.message });
  });

export const optionalPan = z
  .string()
  .optional()
  .nullable()
  .transform((value) => (value ? value.trim().toUpperCase() : null))
  .refine((value) => value === null || isValidPan(value), "A PAN looks like ABCDE1234F.");

export const pincodeField = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || /^\d{6}$/.test(value), "A PIN code has 6 digits.");

export const dateOnlyField = (label = "Date") =>
  z.string().trim().refine((value) => isDateOnly(value), `${label} must be a valid date.`);

export const passwordField = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(200, "That password is too long.");

export const urlField = z
  .string()
  .trim()
  .max(200)
  .optional()
  .nullable()
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || /^https?:\/\/[^\s]+$/i.test(value), "Start the address with https://");

export const codeField = z
  .string()
  .transform((value) => value.replace(/\D/g, ""))
  .refine((value) => value.length === 6, "Enter the 6-digit code.");

/** Flatten a Zod error into { field: message } for the form. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}
