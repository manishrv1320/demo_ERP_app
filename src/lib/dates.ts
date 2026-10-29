/**
 * Dates, Indian style: IST time zone, "28 Oct 2026", financial year 1 April – 31 March.
 *
 * Document dates are Postgres `date` columns, which Prisma hands back as a Date
 * at UTC midnight. Keep them as "YYYY-MM-DD" strings in forms and convert with
 * the helpers below — never through local time.
 */

export const TIME_ZONE = "Asia/Kolkata";

const dateFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: TIME_ZONE,
});

const dateTimeFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: TIME_ZONE,
});

const isoParts = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: TIME_ZONE,
});

/** "28 Oct 2026". Works for timestamps and for date-only values (UTC midnight is the same day in IST). */
export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  return dateFormat.format(date).replace(/(\w{3})\.? /, "$1 ");
}

/** "28 Oct 2026, 3:45 pm" in IST. */
export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  return dateTimeFormat.format(date);
}

/** Today's date in India as "YYYY-MM-DD". */
export function todayIST(now: Date = new Date()): string {
  return isoParts.format(now);
}

/** "2026-10-28" → Date at UTC midnight, for a Postgres `date` column. Throws on bad input. */
export function parseDateOnly(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Not a date: ${value}`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`Not a date: ${value}`);
  }
  return date;
}

export function isDateOnly(value: string): boolean {
  try {
    parseDateOnly(value);
    return true;
  } catch {
    return false;
  }
}

/** A `date` column value back to "YYYY-MM-DD". */
export function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export type FinancialYearInfo = {
  /** "2026-27" */
  label: string;
  /** "26-27" — the {FY} token in number series */
  short: string;
  startDate: string;
  endDate: string;
};

/** The Indian financial year (1 April – 31 March) that contains a date. */
export function financialYearFor(dateOnly: string): FinancialYearInfo {
  const [year, month] = dateOnly.split("-").map(Number) as [number, number];
  const startYear = month >= 4 ? year : year - 1;
  const endYear = startYear + 1;
  return {
    label: `${startYear}-${String(endYear).slice(-2)}`,
    short: `${String(startYear).slice(-2)}-${String(endYear).slice(-2)}`,
    startDate: `${startYear}-04-01`,
    endDate: `${endYear}-03-31`,
  };
}

/** Adds whole days to a timestamp. */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/** "in 3 days", "2 hours ago" — for notifications and the activity log. */
export function relativeTime(value: Date | string, now: Date = new Date()): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(seconds);
  const format = new Intl.RelativeTimeFormat("en-IN", { numeric: "auto" });
  if (abs < 60) return format.format(Math.round(seconds), "second");
  if (abs < 3600) return format.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return format.format(Math.round(seconds / 3600), "hour");
  if (abs < 30 * 86400) return format.format(Math.round(seconds / 86400), "day");
  return formatDate(date);
}
