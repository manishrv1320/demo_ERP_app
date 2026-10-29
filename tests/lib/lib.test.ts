import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "@/lib/csv";
import { financialYearFor, formatDate, parseDateOnly, todayIST } from "@/lib/dates";
import { checkGstin, gstinCheckCharacter, stateFromGstin } from "@/lib/gst/gstin";
import { chargesUtgst } from "@/lib/gst/states";
import { checkSeries, formatDocumentNumber, resolvePrefix } from "@/lib/numbering";
import { DOCUMENT_TYPES, defaultPrefix } from "@/lib/numbering-defaults";
import { ALL_CAPABILITIES, can, grantableCapabilities, outranks, SYSTEM_ROLES, type ActorRole } from "@/lib/rbac";
import { safeNextPath, sanitizeColor } from "@/lib/utils";

describe("GSTIN", () => {
  it("accepts the GSTN's published sample and reads state and PAN from it", () => {
    expect(checkGstin("27aapfu0939f1zv")).toEqual({ ok: true, gstin: "27AAPFU0939F1ZV", stateCode: "27", pan: "AAPFU0939F" });
    expect(stateFromGstin("27AAPFU0939F1ZV")).toBe("27");
  });

  it("catches a single-character typo through the check character", () => {
    expect(checkGstin("27AAPFU0939F1ZW").ok).toBe(false);
    expect(checkGstin("27AAPFU0938F1ZV").ok).toBe(false);
  });

  it("round-trips the check character", () => {
    const base = "29ABCDE1234F1Z";
    expect(checkGstin(base + gstinCheckCharacter(base)).ok).toBe(true);
  });

  it("rejects bad shapes and unknown state codes", () => {
    expect(checkGstin("").ok).toBe(false);
    expect(checkGstin("99AAPFU0939F1ZV").ok).toBe(false);
    expect(checkGstin("27AAPFU0939F1XV").ok).toBe(false);
  });

  it("knows which territories charge UTGST", () => {
    expect(["04", "26", "31", "35", "38"].every(chargesUtgst)).toBe(true);
    expect(chargesUtgst("07")).toBe(false); // Delhi charges SGST
    expect(chargesUtgst("34")).toBe(false); // Puducherry too
  });
});

describe("document numbers", () => {
  it("resolves tokens from the document date", () => {
    expect(resolvePrefix("INV/{FY}/", "2026-10-28")).toBe("INV/26-27/");
    expect(resolvePrefix("INV/{FY}/", "2027-03-31")).toBe("INV/26-27/");
    expect(resolvePrefix("INV/{FY}/", "2027-04-01")).toBe("INV/27-28/");
    expect(resolvePrefix("{YYYY}{MM}-", "2026-10-28")).toBe("202610-");
    expect(formatDocumentNumber("INV/26-27/", 4, 1)).toBe("INV/26-27/0001");
  });

  it("enforces GST's 16 characters and allowed characters", () => {
    expect(checkSeries("INV/{FY}/", 4)).toEqual({ ok: true });
    expect(checkSeries("INVOICE/{FY}/", 4).ok).toBe(false);
    expect(checkSeries("INV {FY}", 4).ok).toBe(false);
    expect(checkSeries("INV/{DAY}/", 4).ok).toBe(false);
  });

  it("gives every default series a valid prefix, for head office and branches", () => {
    for (const entry of DOCUMENT_TYPES) {
      expect(checkSeries(defaultPrefix(entry.type, { code: "HO", isHeadOffice: true }), 4)).toEqual({ ok: true });
      expect(checkSeries(defaultPrefix(entry.type, { code: "BANGALORE", isHeadOffice: false }), 4)).toEqual({ ok: true });
    }
  });
});

describe("dates", () => {
  it("formats Indian style", () => {
    expect(formatDate(parseDateOnly("2026-10-28"))).toBe("28 Oct 2026");
  });

  it("uses IST for today", () => {
    // 20:00 UTC on 28 Oct is 01:30 IST on 29 Oct.
    expect(todayIST(new Date("2026-10-28T20:00:00Z"))).toBe("2026-10-29");
  });

  it("knows the financial year", () => {
    expect(financialYearFor("2026-04-01")).toMatchObject({ label: "2026-27", short: "26-27", startDate: "2026-04-01", endDate: "2027-03-31" });
    expect(financialYearFor("2026-03-31").label).toBe("2025-26");
  });

  it("refuses impossible dates", () => {
    expect(() => parseDateOnly("2026-02-30")).toThrow();
  });
});

describe("CSV", () => {
  it("neutralises spreadsheet formulas but keeps negative numbers", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("+91 98450")).toBe("'+91 98450");
    expect(csvCell("-1500")).toBe("-1500");
    expect(csvCell("a,b")).toBe('"a,b"');
  });

  it("starts with a BOM so Excel reads ₹ correctly", () => {
    expect(toCsv(["Amount"], [["₹100"]]).startsWith("﻿")).toBe(true);
  });
});

describe("roles", () => {
  const role = (key: string): ActorRole => {
    const seed = SYSTEM_ROLES.find((item) => item.key === key)!;
    return { id: key, key, name: seed.name, rank: seed.rank, capabilities: seed.capabilities };
  };

  it("gives the Owner everything", () => {
    expect(ALL_CAPABILITIES.every((capability) => can(role("OWNER"), capability))).toBe(true);
  });

  it("keeps storekeepers away from prices and accounts", () => {
    const storekeeper = role("STOREKEEPER");
    expect(can(storekeeper, "inventory.write")).toBe(true);
    expect(can(storekeeper, "inventory.valuation")).toBe(false);
    expect(can(storekeeper, "sales.read")).toBe(false);
    expect(can(storekeeper, "accounts.read")).toBe(false);
  });

  it("gives viewers every read and no export", () => {
    const viewer = role("VIEWER");
    expect(ALL_CAPABILITIES.filter((capability) => capability.endsWith(".read")).every((capability) => can(viewer, capability))).toBe(true);
    expect(can(viewer, "data.export")).toBe(false);
  });

  it("only lets people act below their own rank and grant what they hold", () => {
    expect(outranks(role("ACCOUNTANT"), 40)).toBe(true);
    expect(outranks(role("ACCOUNTANT"), 10)).toBe(false);
    expect(outranks(role("SALES"), 0)).toBe(false);
    expect(grantableCapabilities(role("SALES"))).toEqual(role("SALES").capabilities);
  });
});

describe("small guards", () => {
  it("allows only same-site redirect targets", () => {
    expect(safeNextPath("/app/settings")).toBe("/app/settings");
    expect(safeNextPath("//evil.example")).toBe("/app");
    expect(safeNextPath("https://evil.example")).toBe("/app");
    expect(safeNextPath("/\\evil.example")).toBe("/app");
  });

  it("only lets real colours into CSS", () => {
    expect(sanitizeColor("#5B8CFF")).toBe("#5b8cff");
    expect(sanitizeColor("red;}body{display:none")).toBeNull();
  });
});
