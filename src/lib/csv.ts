/**
 * CSV writing (RFC 4180) with spreadsheet formula-injection protection: a cell
 * that starts with = + - @ (or a tab/return) is prefixed with an apostrophe so
 * Excel and Sheets show it as text instead of running it.
 */

const DANGEROUS_START = /^[=+\-@\t\r]/;

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (DANGEROUS_START.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  // The BOM makes Excel open UTF-8 (₹, Indian names) correctly.
  return "﻿" + [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
