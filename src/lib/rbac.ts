/**
 * Capabilities and roles. Same model as Hyperzen's src/lib/rbac.ts.
 *
 * Capabilities are fixed in code — each one gates something real on the
 * server. Roles are data, per organization: an Owner can create roles such as
 * "Counter staff" and pick exactly which capabilities each carries.
 *
 * Two rules keep that safe:
 *   • nobody can grant a capability they don't hold themselves, and
 *   • nobody can create, edit, assign or remove a role at or above their own rank.
 *
 * Deleting the organization and transferring ownership belong to the system
 * Owner role itself, not to a grantable capability.
 */

export type Capability =
  | "sales.read"
  | "sales.write"
  | "sales.approve"
  | "purchases.read"
  | "purchases.write"
  | "purchases.approve"
  | "inventory.read"
  | "inventory.write"
  | "inventory.approve"
  | "inventory.valuation"
  | "accounts.read"
  | "accounts.write"
  | "accounts.approve"
  | "accounts.lock"
  | "reports.read"
  | "data.export"
  | "hr.read"
  | "hr.write"
  | "hr.approve"
  | "payroll.read"
  | "payroll.write"
  | "payroll.approve"
  | "activity.read"
  | "settings.write"
  | "users.manage"
  | "roles.manage";

export type CapabilityGroup =
  | "Sales"
  | "Purchases"
  | "Inventory"
  | "Accounts and reports"
  | "HR and payroll"
  | "Administration";

export const CAPABILITIES: {
  key: Capability;
  label: string;
  description: string;
  group: CapabilityGroup;
}[] = [
  { key: "sales.read", label: "View sales", description: "Customers, quotations, orders, delivery notes, invoices, credit notes, receipts, statements and receivables.", group: "Sales" },
  { key: "sales.write", label: "Create sales", description: "Draft and issue quotations, orders and invoices, record receipts, edit customers.", group: "Sales" },
  { key: "sales.approve", label: "Approve sales", description: "Cancel posted sales documents, issue credit notes, sell over a credit limit or below the price list.", group: "Sales" },

  { key: "purchases.read", label: "View purchases", description: "Suppliers, purchase orders, goods receipts, bills, debit notes, payments and payables.", group: "Purchases" },
  { key: "purchases.write", label: "Create purchases", description: "Draft and issue purchase orders, record bills and supplier payments, edit suppliers.", group: "Purchases" },
  { key: "purchases.approve", label: "Approve purchases", description: "Cancel posted purchase documents and issue debit notes.", group: "Purchases" },

  { key: "inventory.read", label: "View stock", description: "Items, stock levels, movements, low stock and barcode lookup.", group: "Inventory" },
  { key: "inventory.write", label: "Manage stock", description: "Items, units, price lists, warehouses, transfers, adjustment drafts, deliveries and goods receipts against open orders.", group: "Inventory" },
  { key: "inventory.approve", label: "Approve stock changes", description: "Post and cancel adjustments and opening stock; override negative-stock blocking.", group: "Inventory" },
  { key: "inventory.valuation", label: "See costs and stock value", description: "Purchase costs and stock valuation. Without it, people see quantities only.", group: "Inventory" },

  { key: "accounts.read", label: "View accounts", description: "Chart of accounts, ledgers, day book, journals, cash and bank books.", group: "Accounts and reports" },
  { key: "accounts.write", label: "Record accounting entries", description: "Manual journals, contra entries, expenses, bank statement import and matching, opening balances.", group: "Accounts and reports" },
  { key: "accounts.approve", label: "Approve accounting changes", description: "Cancel accounting documents and edit the chart of accounts.", group: "Accounts and reports" },
  { key: "accounts.lock", label: "Lock periods", description: "Set or move the period lock date.", group: "Accounts and reports" },
  { key: "reports.read", label: "View reports", description: "Trial balance, profit & loss, balance sheet, cash flow, GST summaries and registers.", group: "Accounts and reports" },
  { key: "data.export", label: "Export data", description: "CSV and Excel exports, and the full data export.", group: "Accounts and reports" },

  { key: "hr.read", label: "View employees", description: "Employees, departments, attendance and leave.", group: "HR and payroll" },
  { key: "hr.write", label: "Manage employees", description: "Add and edit employees and departments, correct attendance.", group: "HR and payroll" },
  { key: "hr.approve", label: "Approve leave", description: "Approve or reject leave requests.", group: "HR and payroll" },
  { key: "payroll.read", label: "View payroll", description: "Payroll runs and payslips.", group: "HR and payroll" },
  { key: "payroll.write", label: "Prepare payroll", description: "Salary components and payroll drafts.", group: "HR and payroll" },
  { key: "payroll.approve", label: "Post payroll", description: "Post and cancel payroll runs.", group: "HR and payroll" },

  { key: "activity.read", label: "View activity log", description: "The audit trail of who changed what.", group: "Administration" },
  { key: "settings.write", label: "Change settings", description: "Company profile, GST, branches, warehouses, financial years, number series, branding and email.", group: "Administration" },
  { key: "users.manage", label: "Manage members", description: "Invite and remove members, and assign roles below your own.", group: "Administration" },
  { key: "roles.manage", label: "Manage roles", description: "Create and edit roles within your own capabilities.", group: "Administration" },
];

export const ALL_CAPABILITIES: Capability[] = CAPABILITIES.map((item) => item.key);

export const CAPABILITY_GROUPS: CapabilityGroup[] = [
  "Sales",
  "Purchases",
  "Inventory",
  "Accounts and reports",
  "HR and payroll",
  "Administration",
];

/** The key of the one role that always holds everything. */
export const OWNER_KEY = "OWNER";

/** What the request context carries so permission checks stay synchronous. */
export type ActorRole = {
  id: string;
  key: string;
  name: string;
  rank: number;
  capabilities: Capability[];
};

export function can(role: ActorRole | null | undefined, capability: Capability): boolean {
  if (!role) return false;
  if (role.key === OWNER_KEY) return true;
  return role.capabilities.includes(capability);
}

export function isOwner(role: ActorRole | null | undefined): boolean {
  return role?.key === OWNER_KEY;
}

/**
 * Seniority. A lower rank is more senior, and you may only act on roles below
 * your own — so an Accountant can never edit, assign or remove an Owner.
 */
export function outranks(actor: ActorRole | null | undefined, targetRank: number): boolean {
  if (!actor) return false;
  if (isOwner(actor)) return true;
  return actor.rank < targetRank;
}

/** Keep only the capabilities the actor is allowed to hand out. */
export function grantableCapabilities(actor: ActorRole | null | undefined): Capability[] {
  if (!actor) return [];
  if (isOwner(actor)) return ALL_CAPABILITIES;
  return ALL_CAPABILITIES.filter((capability) => actor.capabilities.includes(capability));
}

export function normaliseCapabilities(value: unknown): Capability[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<string>(ALL_CAPABILITIES);
  return [...new Set(value.map((item) => String(item)))].filter((item): item is Capability =>
    allowed.has(item),
  );
}

/** The lowest rank a non-system role may take — only the Owner sits at 0. */
export const MIN_CUSTOM_RANK = 1;
export const MAX_RANK = 99;

// ---------------------------------------------------------------------------
// The roles every organization starts with
// ---------------------------------------------------------------------------

export type SystemRoleSeed = {
  key: string;
  name: string;
  description: string;
  rank: number;
  capabilities: Capability[];
};

const READ_ALL: Capability[] = ALL_CAPABILITIES.filter((capability) => capability.endsWith(".read"));

export const SYSTEM_ROLES: SystemRoleSeed[] = [
  {
    key: OWNER_KEY,
    name: "Owner",
    description: "Full access to everything, including deleting the organization. Can never be restricted.",
    rank: 0,
    capabilities: ALL_CAPABILITIES,
  },
  {
    key: "ACCOUNTANT",
    name: "Accountant",
    description: "Sales, purchases, accounts, reports and exports; can post payroll.",
    rank: 10,
    capabilities: [
      "sales.read", "sales.write", "sales.approve",
      "purchases.read", "purchases.write", "purchases.approve",
      "inventory.read", "inventory.valuation",
      "accounts.read", "accounts.write", "accounts.approve", "accounts.lock",
      "reports.read", "data.export",
      "payroll.read", "payroll.approve",
      "activity.read",
    ],
  },
  {
    key: "SALES",
    name: "Sales",
    description: "Customers, quotations, orders, invoices and receipts. Sees stock levels.",
    rank: 40,
    capabilities: ["sales.read", "sales.write", "inventory.read"],
  },
  {
    key: "PURCHASE",
    name: "Purchase",
    description: "Suppliers, purchase orders, bills and payments. Sees stock and costs.",
    rank: 40,
    capabilities: ["purchases.read", "purchases.write", "inventory.read", "inventory.valuation"],
  },
  {
    key: "STOREKEEPER",
    name: "Storekeeper",
    description: "Items, warehouses, transfers, deliveries and goods receipts. Quantities only, no prices.",
    rank: 40,
    capabilities: ["inventory.read", "inventory.write"],
  },
  {
    key: "HR",
    name: "HR",
    description: "Employees, attendance, leave and payroll preparation.",
    rank: 40,
    capabilities: ["hr.read", "hr.write", "hr.approve", "payroll.read", "payroll.write"],
  },
  {
    key: "VIEWER",
    name: "Viewer",
    description: "Read-only access to every area and report. Can't export.",
    rank: 80,
    capabilities: READ_ALL,
  },
];

/** What a support session (Hyperzen staff, read-only) may look at. */
export const SUPPORT_ROLE: ActorRole = {
  id: "support",
  key: "SUPPORT",
  name: "Hyperzen support (read-only)",
  rank: 999,
  capabilities: READ_ALL,
};
