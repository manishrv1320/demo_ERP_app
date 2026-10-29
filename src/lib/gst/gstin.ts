import { isStateCode, stateCodeFrom } from "./states";

/**
 * GSTIN: 2-digit state code, 10-character PAN, entity number, "Z", check character.
 *
 * Hyperzen checks the pattern only. This also verifies the check character
 * (the GSTN's mod-36 Luhn variant), which catches almost every typo.
 */
const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function normalizeGstin(value: string | null | undefined): string {
  return String(value ?? "").replace(/\s+/g, "").toUpperCase();
}

export function gstinCheckCharacter(first14: string): string {
  let sum = 0;
  for (let index = 0; index < 14; index += 1) {
    const value = CHARSET.indexOf(first14[index]!);
    const product = value * (index % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return CHARSET[(36 - (sum % 36)) % 36]!;
}

export type GstinCheck = { ok: true; gstin: string; stateCode: string; pan: string } | { ok: false; message: string };

export function checkGstin(value: string | null | undefined): GstinCheck {
  const gstin = normalizeGstin(value);
  if (gstin.length !== 15) return { ok: false, message: "A GSTIN has 15 characters." };
  if (!GSTIN_PATTERN.test(gstin)) return { ok: false, message: "That doesn't look like a GSTIN." };
  const stateCode = gstin.slice(0, 2);
  if (!isStateCode(stateCode)) return { ok: false, message: "The first two digits aren't a GST state code." };
  if (gstinCheckCharacter(gstin.slice(0, 14)) !== gstin[14]) {
    return { ok: false, message: "The GSTIN's last character doesn't match — check for a typo." };
  }
  return { ok: true, gstin, stateCode, pan: gstin.slice(2, 12) };
}

export function isValidGstin(value: string | null | undefined): boolean {
  return checkGstin(value).ok;
}

/** The first two digits of a valid GSTIN are the registration state. */
export function stateFromGstin(value: string | null | undefined): string {
  const result = checkGstin(value);
  return result.ok ? stateCodeFrom(result.stateCode) : "";
}

const PAN_PATTERN = /^[A-Z]{5}\d{4}[A-Z]$/;

export function isValidPan(value: string | null | undefined): boolean {
  return PAN_PATTERN.test(String(value ?? "").trim().toUpperCase());
}
