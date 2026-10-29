import { financialYearFor } from "./dates";

/**
 * Document numbers, e.g. INV/26-27/0001.
 *
 * GST rules: at most 16 characters, only letters, digits, "/" and "-", unique
 * within a financial year. The prefix template can use {FY} (26-27), {YYYY},
 * {YY} and {MM}, resolved from the document date.
 */

export const MAX_DOCUMENT_NUMBER_LENGTH = 16;
const ALLOWED = /^[A-Za-z0-9/-]*$/;
const TOKENS = /\{(FY|YYYY|YY|MM)\}/g;

export function resolvePrefix(template: string, dateOnly: string): string {
  const [year, month] = dateOnly.split("-") as [string, string];
  const fy = financialYearFor(dateOnly);
  return template.replace(TOKENS, (_, token: string) => {
    switch (token) {
      case "FY":
        return fy.short;
      case "YYYY":
        return year;
      case "YY":
        return year.slice(-2);
      default:
        return month;
    }
  });
}

export function formatDocumentNumber(prefix: string, padding: number, sequence: number): string {
  return `${prefix}${String(sequence).padStart(padding, "0")}`;
}

/** The longest a prefix can become once tokens are filled in ({FY} → 5 characters, {YYYY} → 4…). */
function longestResolvedLength(template: string): number {
  return template.replace(TOKENS, (_, token: string) => (token === "FY" ? "00-00" : token === "YYYY" ? "0000" : "00")).length;
}

/**
 * Checks a series before it's saved: the prefix's characters, and that the
 * full number stays within 16 characters up to `padding` digits.
 */
export function checkSeries(template: string, padding: number): { ok: true } | { ok: false; message: string } {
  const literal = template.replace(TOKENS, "");
  if (/[{}]/.test(literal)) {
    return { ok: false, message: "Only {FY}, {YYYY}, {YY} and {MM} can be used in braces." };
  }
  if (!ALLOWED.test(literal)) {
    return { ok: false, message: "GST allows only letters, digits, / and - in document numbers." };
  }
  if (!Number.isInteger(padding) || padding < 1 || padding > 8) {
    return { ok: false, message: "Digits must be between 1 and 8." };
  }
  const length = longestResolvedLength(template) + padding;
  if (length > MAX_DOCUMENT_NUMBER_LENGTH) {
    return {
      ok: false,
      message: `Numbers would be ${length} characters long. GST allows at most ${MAX_DOCUMENT_NUMBER_LENGTH}.`,
    };
  }
  return { ok: true };
}
