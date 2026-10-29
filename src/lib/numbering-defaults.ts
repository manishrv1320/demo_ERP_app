import type { DocumentType } from "@prisma/client";

/** Default series per document type. Head office: "INV/{FY}/" → INV/26-27/0001. */
export const DOCUMENT_TYPES: { type: DocumentType; label: string; prefix: string; short: string }[] = [
  { type: "QUOTATION", label: "Quotation", prefix: "QT/{FY}/", short: "QT" },
  { type: "SALES_ORDER", label: "Sales order", prefix: "SO/{FY}/", short: "SO" },
  { type: "DELIVERY_NOTE", label: "Delivery note", prefix: "DN/{FY}/", short: "DN" },
  { type: "SALES_INVOICE", label: "Tax invoice", prefix: "INV/{FY}/", short: "IN" },
  { type: "CREDIT_NOTE", label: "Credit note", prefix: "CN/{FY}/", short: "CN" },
  { type: "RECEIPT", label: "Receipt", prefix: "RCT/{FY}/", short: "RC" },
  { type: "PURCHASE_ORDER", label: "Purchase order", prefix: "PO/{FY}/", short: "PO" },
  { type: "GOODS_RECEIPT", label: "Goods receipt", prefix: "GRN/{FY}/", short: "GR" },
  { type: "PURCHASE_BILL", label: "Purchase bill", prefix: "PB/{FY}/", short: "PB" },
  { type: "DEBIT_NOTE", label: "Debit note", prefix: "DBN/{FY}/", short: "DB" },
  { type: "PAYMENT", label: "Supplier payment", prefix: "PAY/{FY}/", short: "PY" },
  { type: "EXPENSE", label: "Expense", prefix: "EXP/{FY}/", short: "EX" },
  { type: "JOURNAL", label: "Journal", prefix: "JV/{FY}/", short: "JV" },
  { type: "CONTRA", label: "Contra", prefix: "CON/{FY}/", short: "CO" },
  { type: "STOCK_TRANSFER", label: "Stock transfer", prefix: "ST/{FY}/", short: "ST" },
  { type: "STOCK_ADJUSTMENT", label: "Stock adjustment", prefix: "SA/{FY}/", short: "SA" },
  { type: "OPENING_STOCK", label: "Opening stock", prefix: "OS/{FY}/", short: "OS" },
];

export function documentTypeLabel(type: DocumentType): string {
  return DOCUMENT_TYPES.find((item) => item.type === type)?.label ?? type;
}

/**
 * Other branches need their own series, or two branches under one GSTIN would
 * issue the same number. "IN" + first three characters of the branch code:
 * INBLR/26-27/0001 is exactly 16 characters.
 */
export function defaultPrefix(type: DocumentType, branch: { code: string; isHeadOffice: boolean }): string {
  const entry = DOCUMENT_TYPES.find((item) => item.type === type)!;
  if (branch.isHeadOffice) return entry.prefix;
  const code = branch.code.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase();
  return `${entry.short}${code}/{FY}/`;
}
