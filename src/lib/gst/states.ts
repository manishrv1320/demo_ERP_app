/**
 * GST state codes. Copied from Hyperzen's src/lib/invoice-shared.ts.
 */
export const GST_STATES: { code: string; name: string }[] = [
  { code: "35", name: "Andaman and Nicobar Islands" },
  { code: "37", name: "Andhra Pradesh" },
  { code: "12", name: "Arunachal Pradesh" },
  { code: "18", name: "Assam" },
  { code: "10", name: "Bihar" },
  { code: "04", name: "Chandigarh" },
  { code: "22", name: "Chhattisgarh" },
  { code: "26", name: "Dadra and Nagar Haveli and Daman and Diu" },
  { code: "07", name: "Delhi" },
  { code: "30", name: "Goa" },
  { code: "24", name: "Gujarat" },
  { code: "06", name: "Haryana" },
  { code: "02", name: "Himachal Pradesh" },
  { code: "01", name: "Jammu and Kashmir" },
  { code: "20", name: "Jharkhand" },
  { code: "29", name: "Karnataka" },
  { code: "32", name: "Kerala" },
  { code: "38", name: "Ladakh" },
  { code: "31", name: "Lakshadweep" },
  { code: "23", name: "Madhya Pradesh" },
  { code: "27", name: "Maharashtra" },
  { code: "14", name: "Manipur" },
  { code: "17", name: "Meghalaya" },
  { code: "15", name: "Mizoram" },
  { code: "13", name: "Nagaland" },
  { code: "21", name: "Odisha" },
  { code: "34", name: "Puducherry" },
  { code: "03", name: "Punjab" },
  { code: "08", name: "Rajasthan" },
  { code: "11", name: "Sikkim" },
  { code: "33", name: "Tamil Nadu" },
  { code: "36", name: "Telangana" },
  { code: "16", name: "Tripura" },
  { code: "09", name: "Uttar Pradesh" },
  { code: "05", name: "Uttarakhand" },
  { code: "19", name: "West Bengal" },
  { code: "97", name: "Other Territory" },
  { code: "96", name: "Outside India (export)" },
];

export const OUTSIDE_INDIA = "96";

/** Indian states and territories an organization or branch can be registered in. */
export const REGISTRATION_STATES = GST_STATES.filter((state) => state.code !== OUTSIDE_INDIA);

/** Union territories without a legislature charge UTGST instead of SGST. */
const UTGST_TERRITORIES = new Set(["04", "26", "31", "35", "38"]);

export function chargesUtgst(stateCode: string): boolean {
  return UTGST_TERRITORIES.has(stateCode);
}

export function isStateCode(code: string): boolean {
  return GST_STATES.some((state) => state.code === code);
}

export function stateName(code: string | null | undefined): string {
  if (!code) return "";
  return GST_STATES.find((state) => state.code === code)?.name ?? code;
}

/** Accepts a code ("29"), a name ("Karnataka") or "29-Karnataka" and returns the code. */
export function stateCodeFrom(value: string | null | undefined): string {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const leading = text.match(/^(\d{1,2})\b/);
  if (leading) {
    const code = leading[1]!.padStart(2, "0");
    if (isStateCode(code)) return code;
  }
  const lower = text.toLowerCase();
  return GST_STATES.find((state) => state.name.toLowerCase() === lower)?.code ?? "";
}
