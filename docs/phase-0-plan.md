# Hyperzen ERP — Phase 0 plan

Status: **waiting for approval** (written 29 Oct 2026). No application code exists yet.

This is the design for every later phase: what is reused from `D:\Hyperzen`, the data model, the
capability list, the route map, the folder structure, and the decisions I need from you (section 9).

Placeholders still open: `[ERP_DOMAIN]`, `[PACKAGE_ID]`, `[FOLDER]`, `[SHORT_NAME]`. Below I write the
suggested values (`erp.hyperzen.in`, `in.hyperzen.erp`, `hyperzen-erp`, `hzerp`) so the plan reads
concretely. They change everywhere once you confirm or replace them.

---

## 1. What I'll reuse from D:\Hyperzen

Copied across and renamed where needed (`hz_` cookies → `hzerp_`, `HZENC` → `HZERP`, storage folder
`.hyperzen-storage` → `.hyperzen-erp-storage`). Nothing in `D:\Hyperzen` is changed.

| From Hyperzen | Reused as | Changes |
| --- | --- | --- |
| `package.json` scripts, `tsconfig.json`, `postcss.config.mjs` | Same | Adds `test` (Vitest); `db:migrate` / `db:deploy` replace `db:push` |
| `eslint.config.mjs` | Same base | Adds `no-restricted-imports`: only the db module and platform code may import `@prisma/client` values or the raw client |
| `next.config.ts` | Same canonical-https redirect via `CF-Visitor`, same security headers, HSTS without includeSubDomains | `Permissions-Policy` allows `geolocation=(self)` for attendance; `X-Frame-Options: DENY` (nothing embeds the ERP) |
| `globals.css` | Same `@theme` tokens: Inter, `ink-950…ink-50`, `--accent #5b8cff`, `--accent-2 #8b5cf6`, radius and shadow tokens, and the `--a-*` admin surface tokens with their light variant | Theme follows the system setting (`next-themes`, `defaultTheme="system"`); per-organization accents set as CSS variables (same `sanitizeColor` guard as Hyperzen's root layout) |
| `prisma.config.ts` | Same | Seed path changes |
| `scripts/dev-db.mjs` (PGlite + message-framing patch) | Same, verbatim | Port 5443 (so Hyperzen's 5433 can run beside it), loads `pg_trgm`, and starts a second throwaway PGlite on 5444 as Prisma's shadow database, which `prisma migrate dev` needs |
| `scripts/db-preflight.ts`, `scripts/copy-database.ts` | Same | — |
| `scripts/create-admin.ts` | `scripts/create-platform-admin.ts` | Creates a platform (Hyperzen staff) account; prints a generated password only on the machine it runs on |
| `lib/auth.ts` | `src/server/auth/session.ts` | Same model: 32 random bytes, SHA-256 hash stored, `httpOnly` + `sameSite=lax` + `secure` cookie, `cache()` per request. 30-day sessions; the session holds the active organization; every session is deleted when the password changes |
| `lib/portal-auth.ts` | The pattern for the separate platform session | Separate table, separate cookie (`hzerp_platform`, path `/platform`) |
| `login/reset-actions.ts` | Password reset | Same three steps (code → verify → new password), hashed codes, 10-minute expiry, 5 guesses, per-address and per-network limits, identical reply whether or not an account exists, code printed to the terminal in development |
| `middleware.ts` | Presence-only cookie gate for `/app` and `/platform` | Maintenance and page-visibility logic dropped |
| `lib/rbac.ts` + `settings/roles/actions.ts` | `src/lib/rbac.ts` + role actions | Same rules: capabilities fixed in code, roles are data, `grantableCapabilities`, `outranks`, rank floor. Roles become per-organization; `OWNER` replaces `GLOBAL_ADMIN` |
| `lib/data-encryption.ts` | Same | Header `HZERP` + version byte; text prefix `hzerp:v1:` |
| `lib/file-storage.ts` | Same | Every path starts `orgs/<organizationId>/` so one company's files can never be addressed from another's |
| `lib/rate-limit.ts`, `lib/sanitize.ts`, `lib/sms.ts`, `lib/csv.ts` (parser) | Same | CSV export adds formula-injection protection (cells starting `= + - @` are prefixed) |
| `lib/email.ts` | SMTP transport + template helpers | Two levels: platform SMTP for sign-up, reset and invite mail; optional per-organization SMTP for sending documents, password encrypted at rest |
| `lib/policies.ts` + `(portal)/accept-policies` | Same version-based acceptance with fingerprint | Policies are platform-wide (Terms, Privacy), accepted per user |
| `lib/notifications.ts` | Same best-effort `notify()`, opportunistic hourly purge, `describeChanges()` | Per organization and per recipient (each user has their own read state) |
| `components/admin/revision-history.tsx` + revision actions | Same component | Revisions per organization; restore re-validates through the module's Zod schema |
| `lib/invoice-shared.ts` | `src/lib/gst/*` | `GST_STATES`, UTGST territories, `stateCodeFrom`, `stateFromGstin`, Indian `amountInWords`, `{FY}` token. The arithmetic is rewritten for integer quantities and rates (section 4) |
| `components/invoice/*`, `(print)/layout.tsx`, `print-toolbar.tsx` | Document layout and the `(print)` route group | See decision D2 |
| `components/admin/admin-shell.tsx`, `ui.tsx`, `charts.tsx`, `confirm-dialog.tsx`, `list-controls.tsx`, `field-input.tsx`, `notification-bell.tsx` | App shell and UI kit | Org switcher in the top bar; bottom tab bar on phones; CSS transitions instead of framer-motion (lighter on phones); 48 dp touch targets on mobile |
| `components/admin/auto-refresh.tsx` | Polling pattern | The bell polls a small JSON endpoint every 30 s while visible, instead of re-rendering the page |
| `Dockerfile`, `docker-compose.yml`, `.env.example`, `.dockerignore` | Same structure | Compose project `hzerp`, ports `127.0.0.1:3200` and `:5435`, data in `/home/dev2/hzerp-data`. The tunnel uses the same pinned `cloudflare/cloudflared:2026.10.2` tag Hyperzen uses, so the image is already on the server and costs no disk |

**Not reused:** the CMS (pages, blocks, TipTap), public media uploads, chat, analytics, client portal
screens, `MEDIA_STORAGE=db`, the Vercel notes and `db push`.

### Things I noticed in Hyperzen (not changed — for you to decide separately)

1. **Per-IP rate limits can be bypassed on the live site.** `clientIpFrom()` trusts the first entry of
   `X-Forwarded-For`. Cloudflare appends to whatever the client sent, so a script can send a fresh fake
   IP with every request. The per-network limits on sign-in, sign-up, contact, apply and newsletter
   are affected. The per-account limits still hold. Fix: read `CF-Connecting-IP` first. The ERP does this.
2. `nextInvoiceNumber()` reads the highest number and adds one, so two invoices saved at the same
   moment can get the same number. The ERP uses a counter row incremented inside the posting transaction.
3. GSTIN validation checks the pattern but not the check digit. The ERP validates the check digit too.
4. Invoice quantities and tax rates are JavaScript floats there. The ERP uses integers throughout.
5. `formatDate()` formats in UTC. The ERP formats in IST.

---

## 2. Tenant isolation (the most important part)

Four layers, so that one forgotten `where` clause can't leak data:

1. **Database foreign keys include `organizationId`.** Every tenant table has `@@unique([organizationId, id])`,
   and every link between tenant tables is a composite key `(organizationId, xId) → (organizationId, id)`.
   An invoice in company A *cannot* point at company B's customer, item, warehouse or ledger. Postgres
   refuses the row. (Verified with Prisma 6.19: required, optional and self-referencing composite keys
   all validate and generate real constraints.) Relations use `onDelete: Restrict`.
2. **One data-access helper.** `forOrg(orgId)` returns a Prisma client extension that, for every tenant
   model and every operation (`findUnique/First/Many`, `count`, `aggregate`, `groupBy`, `create/Many`,
   `update/Many`, `upsert`, `delete/Many`), adds `organizationId` to the `where` and sets it on every
   created row. If a caller passes a different `organizationId` it throws instead of overriding.
   `$queryRaw` is not exposed. Reports that need raw SQL use one vetted `tenantSql()` helper that
   always binds the organization as a parameter.
3. **Lint rule.** Only `src/server/db/**` (and the platform console code it serves) may import the raw
   client or `@prisma/client` values; type-only imports are allowed everywhere. Cross-tenant reads the
   app genuinely needs (look up a user by email at sign-in, list a user's memberships for the
   switcher) are named functions inside the db module, not open access.
4. **Tests.** Generated from Prisma's model metadata, so a new model is covered automatically:
   - for every tenant model, records are created in company A and company B, and every operation
     through `forOrg(A)` is tried against B's records. Reads return nothing, counts are 0, and
     updates, upserts and deletes fail or touch 0 rows;
   - creating a row with B's `organizationId` through `forOrg(A)` throws;
   - creating an A document that references a B customer fails at the foreign key;
   - a schema test fails the build if any tenant model lacks the composite unique, an
     `organizationId`-first index, or an `organizationId` in each unique constraint.

**Session context.** Each request resolves `session → user → membership(user, activeOrg) → role`,
checks that the user, the membership and the organization are all active, and returns
`{ user, org, role, db: forOrg(org.id) }`. Server actions go through one wrapper,
`action(capability, schema, fn)`, which checks the session and the capability, runs Zod validation,
checks the period lock and returns Hyperzen's `ActionResult` shape. Pages call
`requirePage(capability)`, which gives `notFound()` when the capability is missing.

**Postgres row-level security** is the other way to do this. I'm not using it: it would need a
transaction around every query to set the organization, which costs time on the shared server and
fights Prisma's connection pool. Layers 1–4 give the same guarantee without that cost.

**Platform console.** Hyperzen staff use separate `PlatformAdmin` accounts, created only by a CLI
script, with their own session table and a cookie scoped to `/platform`. A tenant session can't
satisfy that check, because it's a different table. **Support view:** a platform admin enters a
reason and opens a company read-only. That creates a short-lived `SupportSession`. While it's active,
`/app` renders that company with a read-only role, under a banner, and every page visit is written to
`SupportAccessLog`. Writes are blocked twice: the action wrapper refuses them, and the db extension
throws on any mutation.

---

## 3. Data model

**Conventions (they apply to every model below and aren't repeated):**
- `id String @id @default(cuid())`, `createdAt`, `updatedAt`.
- Tenant models have an indexed `organizationId` and `@@unique([organizationId, id])`; each unique
  constraint and index starts with `organizationId`.
- Money is `BigInt` paise. `Int` would cap amounts at ₹2.14 crore. Quantities are `BigInt` thousandths
  of a unit (`qtyMilli`). Rates and percentages are `Int` basis points (18% = `1800`).
- Document dates are `@db.Date` (no timezone drift). Timestamps are `timestamptz`.
- Editable records carry `version Int` for optimistic locking.
- `→` means a composite tenant foreign key.

### 3.1 Identity and platform (global, not tenant)

| Model | Key fields | Keys / indexes |
| --- | --- | --- |
| **User** | email (lowercased), phone?, name, passwordHash, passwordChangedAt, emailVerifiedAt?, status `ACTIVE/PENDING_DELETION/DELETED`, deletionScheduledFor?, lastLoginAt | unique email; idx phone, status |
| **Session** | tokenHash, userId, activeOrganizationId?, isApp (UI hint only), ip, userAgent, lastSeenAt, expiresAt | unique tokenHash; idx userId, expiresAt |
| **PasswordResetCode** | userId, purpose `RESET/VERIFY_EMAIL`, channel `EMAIL/SMS`, destination, codeHash, attempts, expiresAt, consumedAt, resetToken?, resetExpiresAt | unique resetToken; idx (userId, createdAt), expiresAt |
| **PlatformAdmin** | email, name, passwordHash, passwordChangedAt, isActive, lastLoginAt | unique email |
| **PlatformSession** | tokenHash, platformAdminId, ip, userAgent, expiresAt (12 h) | unique tokenHash |
| **SupportSession** | platformAdminId, organizationId, reason, tokenHash, expiresAt (60 min), endedAt | idx organizationId, platformAdminId |
| **SupportAccessLog** | supportSessionId, organizationId, path, at | idx (organizationId, at) |
| **PlatformAuditLog** | platformAdminId, action (suspend, reactivate, support-open, policy-edit…), organizationId?, detail Json | idx (organizationId, createdAt) |
| **PlatformSettings** | singleton: system SMTP (password encrypted), support email | — |
| **Policy** | slug (`terms`, `privacy`), title, content (sanitised HTML), version, versionAt, isActive | unique slug |
| **PolicyAcceptance** | policyId, version, userId, ip, userAgent, acceptedAt | unique (policyId, version, userId) |
| **PushDevice** | userId, fcmToken, platform, appVersion, lastSeenAt | unique fcmToken; idx userId |

### 3.2 Organization, members, roles, settings

| Model | Key fields | Keys / indexes |
| --- | --- | --- |
| **Organization** (tenant root) | legalName, tradeName, gstin?, pan?, gstRegistration `REGULAR/COMPOSITION/UNREGISTERED`, stateCode, address, city, pincode, phone, email, website, logoFileId?, accentColor, accentColor2, booksStartDate, lockDate?, status `ACTIVE/SUSPENDED/PENDING_DELETION/DELETED`, suspendedReason?, deletionScheduledFor?, isDemo | idx status |
| **OrganizationSettings** (1:1) | roundOffTotals, negativeStock `BLOCK/ALLOW`, defaultDueDays, invoiceTerms, invoiceNotes, upiId?, upiPayeeName?, SMTP (host, port, user, passwordEnc, secure, fromName, fromEmail, enabled), notificationRetentionDays, lastNotificationPurgeAt, attendanceLocationEnabled | unique organizationId |
| **Membership** | → user (global FK), → role, status `ACTIVE/REMOVED`, joinedAt | unique (organizationId, userId); idx userId; idx (organizationId, roleId) |
| **Invitation** | email, → role, tokenHash, invitedById, expiresAt, acceptedAt?, revokedAt? | unique tokenHash; idx (organizationId, email) |
| **Role** | key, name, description, capabilities Json (string[]), rank, isSystem | unique (organizationId, key); idx (organizationId, rank) |
| **Branch** | name, code, gstin?, stateCode, address, isHeadOffice, isActive | unique (organizationId, code) |
| **Warehouse** | → branch, name, code, isActive | unique (organizationId, code) |
| **FinancialYear** | label `2026-27`, startDate, endDate, isClosed | unique (organizationId, startDate) |
| **NumberSeries** | documentType, → financialYear, → branch, prefix template (`INV/{FY}/`), padding, nextNumber, mode `AUTO/MANUAL` | unique (organizationId, documentType, financialYearId, branchId) |

Number rules: GST allows at most 16 characters, made of letters, digits, `/` and `-`. The series form
rejects a prefix and padding that could exceed that. Drafts have no number. The number is taken when
the document is posted, by incrementing the counter row inside the same transaction. A rollback
returns the number, so the series has no gaps. Cancelled documents keep their number.
`INV/{FY}/` + 4 digits = `INV/26-27/0001` (14 characters).

### 3.3 Activity, notifications, revisions, files

| Model | Key fields | Keys / indexes |
| --- | --- | --- |
| **ActivityLog** | actorUserId?, actorName, action, entityType, entityId, summary, ip | idx (organizationId, createdAt); idx (organizationId, entityType, entityId) |
| **Notification** | recipientUserId, kind, level, title, body, href, entityType, entityId, readAt? | idx (organizationId, recipientUserId, readAt, createdAt) |
| **Revision** | entityType, entityId, data Json, label, authorUserId | idx (organizationId, entityType, entityId, createdAt) |
| **StoredFile** | category (LOGO, RECEIPT, ATTACHMENT, BANK_STATEMENT, PAYSLIP), storagePath (random), originalName, mimeType, size, sha256, uploadedById | idx (organizationId, category) |
| **Attachment** | → file, entityType, entityId | idx (organizationId, entityType, entityId) |
| **IdempotencyKey** | key, action, resultId | unique (organizationId, key) — stops a flaky phone connection from saving a receipt twice; purged after 7 days |

**Retention vs audit trail:** the Companies (Accounts) Rules require accounting software to keep an
audit trail of every change to the books, which can't be switched off, for 8 years. So retention
applies to **notifications** (and login records) only. The activity log entries for accounting
records are never purged.

### 3.4 Masters

| Model | Key fields | Keys / indexes |
| --- | --- | --- |
| **Unit** | code (GST UQC: NOS, KGS, LTR, BOX…), name, decimals 0–3 | unique (organizationId, code) — seeded |
| **ItemCategory** | name, → parent? | idx (organizationId, name) |
| **Item** | type `GOODS/SERVICE`, sku, name, description, hsnSac, → category?, → unit (base), gstTreatment `TAXABLE/NIL_RATED/EXEMPT/NON_GST`, gstRateBp, cessRateBp, salePrice, purchasePrice, mrp?, pricesIncludeTax, trackStock, reorderLevelMilli?, → salesAccount?, → purchaseAccount?, isActive | unique (organizationId, sku); idx (organizationId, isActive, name); trigram idx on name (fast `contains` search) |
| **ItemBarcode** | → item, barcode, → unit? (pack barcode) | unique (organizationId, barcode) |
| **ItemUnit** (alternate units) | → item, → unit, factorMilli (1 BOX = 12 PCS → 12000) | unique (organizationId, itemId, unitId) |
| **PriceList** | name, kind `SALES/PURCHASE`, isDefault, isActive | unique (organizationId, name) |
| **PriceListItem** | → priceList, → item, → unit?, price | unique (organizationId, priceListId, itemId, unitId) |
| **Party** (customers and suppliers in one table) | isCustomer, isSupplier, name, code?, gstin?, gstRegistration `REGULAR/COMPOSITION/UNREGISTERED/CONSUMER/SEZ/OVERSEAS/DEEMED_EXPORT`, pan?, stateCode (filled from GSTIN), phone, email, contactPerson, creditLimit?, paymentTermsDays?, → priceList?, isActive | unique (organizationId, code); idx (organizationId, isCustomer, name), (organizationId, isSupplier, name), (organizationId, gstin); trigram idx on name |
| **PartyAddress** | → party, kind `BILLING/SHIPPING`, line1, line2, city, stateCode, pincode, country, isDefault | idx (organizationId, partyId) |
| **OpeningBalanceBill** | → party, side `RECEIVABLE/PAYABLE`, refNumber, date, dueDate, amount | idx (organizationId, partyId) — bill-wise opening balances, so ageing and allocation work from day one |

One `Party` table lets a business that both buys from and sells to someone keep a single record.
Party ledgers are journal lines carrying `partyId` on the Trade Receivables / Trade Payables control
accounts.

### 3.5 Sales and purchase documents

One document table covers all nine trade document types. They share lines, totals, numbering, PDF,
conversion and list screens, which avoids nine copies of the same code.

| Model | Key fields | Keys / indexes |
| --- | --- | --- |
| **TradeDocument** | type `QUOTATION/SALES_ORDER/DELIVERY_NOTE/SALES_INVOICE/CREDIT_NOTE/PURCHASE_ORDER/GOODS_RECEIPT/PURCHASE_BILL/DEBIT_NOTE`; status `DRAFT/OPEN/POSTED/CLOSED/CANCELLED`; → branch, → warehouse?, → financialYear, number?, date, dueDate?, validUntil?; → party, partySnapshot Json, billingAddress Json, shippingAddress Json; sellerGstin, sellerStateCode, placeOfSupply, supplyType `B2B/B2C/SEZ_WITH_TAX/SEZ_WITHOUT_TAX/EXPORT_WITH_TAX/EXPORT_WITHOUT_TAX/DEEMED_EXPORT`, reverseCharge, taxKind `INTRA/INTER/NONE`, stateTaxLabel `SGST/UTGST`; supplierInvoiceNumber?, supplierInvoiceDate? (bills); → originalInvoice? + noteReason (credit/debit notes); → source? (converted from); customer PO ref, e-way bill no., vehicle no. (manual fields); pricesIncludeTax; subtotal, discountTotal, taxableTotal, cgst, sgst, igst, cess, roundOff (signed), grandTotal, amountSettled; affectsStock; → journalEntry?, → cancellationJournal?; postedAt/By, cancelledAt/By, cancelReason | unique (organizationId, type, financialYearId, number); idx (organizationId, type, date), (organizationId, type, status, date), (organizationId, partyId, type, date), (organizationId, type, dueDate), (organizationId, sourceId) |
| **TradeDocumentLine** | → document, lineNo, → item?, description, hsnSac, → unit, qtyMilli, unitFactorMilli, baseQtyMilli, rate, discountBp, discountAmount, amount, taxable, gstRateBp, cgst, sgst, igst, cessRateBp, cess, lineTotal, → warehouse?, → sourceLine?, qtyFulfilledMilli (orders: how much has been delivered or billed) | idx (organizationId, documentId), (organizationId, itemId), (organizationId, sourceLineId) |
| **Payment** | type `RECEIPT/PAYMENT`, status `DRAFT/POSTED/CANCELLED`, → branch, → financialYear, number, date, → party, amount, mode `CASH/BANK_TRANSFER/UPI/CHEQUE/CARD/OTHER`, → account (cash/bank ledger), reference (UTR / cheque no.), chequeDate?, tdsAmount (customer deducted TDS), unallocated, → journalEntry, → cancellationJournal? | unique (organizationId, type, financialYearId, number); idx (organizationId, partyId, date), (organizationId, type, date) |
| **Allocation** | → party, date, amount; source: → payment? / → creditDocument? (credit or debit note) / → sourceOpening?; target: → targetDocument? (invoice or bill) / → targetOpening?; reversedAt? | idx (organizationId, targetDocumentId), (organizationId, paymentId), (organizationId, partyId); a CHECK constraint requires exactly one source and one target |

**Conversions:** quotation → sales order → delivery note → invoice, and PO → goods receipt → bill.
Each is one click: it creates a draft with the lines copied, linked through `sourceLineId`. The source
closes when it's fully fulfilled. Stock moves exactly once: an invoice made from a delivery note
doesn't move stock again, and an invoice made directly does.

### 3.6 Inventory

| Model | Key fields | Keys / indexes |
| --- | --- | --- |
| **StockDocument** | type `TRANSFER/ADJUSTMENT/OPENING_STOCK`, status, → branch, → financialYear, number, date, → fromWarehouse?, → toWarehouse?, reason `DAMAGE/EXPIRY/THEFT/COUNT_CORRECTION/SAMPLE/CONSUMPTION/OTHER`, notes, cancel fields | unique (organizationId, type, financialYearId, number); idx (organizationId, type, date) |
| **StockDocumentLine** | → stockDocument, lineNo, → item, → unit, qtyMilli (signed for adjustments), baseQtyMilli, unitCost? (opening stock / additions) | idx (organizationId, stockDocumentId) |
| **StockMovement** (the stock ledger) | → item, → warehouse, date, qtyMilli (signed, base unit), inwardValue? (paise, inward only), sourceType, → tradeDocument?/line?, → stockDocument?/line?, → reversalOf? | idx (organizationId, itemId, warehouseId, date), (organizationId, warehouseId, date), (organizationId, tradeDocumentId), (organizationId, stockDocumentId) |
| **StockBalance** (derived cache, never edited) | → item, → warehouse, qtyMilli | unique (organizationId, itemId, warehouseId) |

Rows are only ever inserted. Cancelling a document inserts reversal movements. `StockBalance` is
updated in the same transaction as each movement. With negative stock set to `BLOCK` (the default),
the update fails if quantity would go below zero. A rebuild script and a test check that the cache
equals the sum of the ledger. Transfers are allowed only between warehouses under the same GSTIN.
Moving goods to a branch with a different GSTIN is a taxable supply and needs an invoice.

Weighted-average cost is **computed from the ledger in date order** when a report needs it. It's not
posted as journal entries (decision D3).

### 3.7 Accounts

| Model | Key fields | Keys / indexes |
| --- | --- | --- |
| **AccountGroup** | name, code, → parent?, nature `ASSET/LIABILITY/EQUITY/INCOME/EXPENSE`, isGrossProfit (trading section), scheduleIIIHead, isSystem, sortOrder | unique (organizationId, code) |
| **LedgerAccount** | → group, name, code, systemKey? (CASH, TRADE_RECEIVABLES, TRADE_PAYABLES, SALES, PURCHASES, CGST/SGST/UTGST/IGST/CESS output and input, RCM payable, ROUND_OFF, TDS_RECEIVABLE, OPENING_DIFFERENCE…), kind `GENERAL/CASH/BANK/CONTROL`, openingBalance (signed, Dr +), bank name / IFSC / account number (encrypted), allowManual, isActive | unique (organizationId, code); unique (organizationId, systemKey); idx (organizationId, groupId) |
| **JournalEntry** | type `SALES_INVOICE/CREDIT_NOTE/PURCHASE_BILL/DEBIT_NOTE/RECEIPT/PAYMENT/CONTRA/EXPENSE/JOURNAL/PAYROLL/REVERSAL`, status `DRAFT/POSTED`, → branch?, → financialYear, number? (manual journals and contras), date, narration, total, → reverses? | unique (organizationId, type, financialYearId, number); idx (organizationId, date), (organizationId, type, date) |
| **JournalLine** | → entry, lineNo, → account, → party?, debit, credit, date (copied from the entry for fast ledgers), narration? | idx (organizationId, accountId, date) covering debit/credit; (organizationId, partyId, date); (organizationId, journalEntryId) |
| **Expense** | number, status, date, → branch, → payee party?, payeeName, supplierGstin?, placeOfSupply, paidFrom → account (cash/bank) or on credit, reference, total, → journalEntry, → cancellationJournal? | unique (organizationId, financialYearId, number); idx (organizationId, date) |
| **ExpenseLine** | → expense, → account, description, taxable, gstRateBp, itcEligible, cgst, sgst, igst | idx (organizationId, expenseId) |
| **BankStatementImport** | → account, → file, columnMapping Json, periodFrom, periodTo, rowCount, importedById | idx (organizationId, accountId) |
| **BankStatementLine** | → import, → account, date, description, reference, debit, credit, balance?, hash, status `UNMATCHED/MATCHED/IGNORED` | unique (organizationId, accountId, hash) (re-importing the same statement adds nothing); idx (organizationId, accountId, status, date) |
| **BankReconciliation** | → journalLine, → statementLine?, clearedDate, by | unique (organizationId, journalLineId) — kept apart so journal lines stay untouched |

**Guarantees, enforced at three levels:**
- *Balanced:* the posting function rejects any entry whose debits don't equal its credits, that has
  zero lines, or that has a line with both a debit and a credit. A deferred Postgres constraint
  trigger checks the same at commit. Tests cover every posting rule.
- *Immutable:* a trigger blocks `UPDATE`/`DELETE` on a `POSTED` journal entry and on its lines.
  Cancelling inserts a `REVERSAL` entry with every line swapped, dated the same as the original.
- *Period lock:* nothing can be posted, cancelled or reversed on or before `Organization.lockDate`.
  To correct a locked period, issue a credit or debit note dated today.

### 3.8 HR and payroll (phase 8)

| Model | Key fields | Keys / indexes |
| --- | --- | --- |
| **Department** | name, code | unique (organizationId, code) |
| **Employee** | code, name, → user? (self-service login), → department, → branch, designation, joinedOn, leftOn?, phone, email, PAN (encrypted), UAN, ESIC no., bank account and IFSC (encrypted), pfApplicable, esiApplicable, ptMonthly, locationConsentAt?, locationConsentWithdrawnAt?, status | unique (organizationId, code); unique (organizationId, userId) |
| **AttendanceRecord** | → employee, date, checkInAt, checkOutAt?, latitude/longitude/accuracy? (stored only when the company turns location on **and** the employee has consented), source `APP/WEB/MANUAL`, correctedById? | unique (organizationId, employeeId, date) |
| **LeaveType** | name, code, annualHalfDays, paid, carryForward | unique (organizationId, code) |
| **LeaveAllocation** | → employee, → leaveType, year, halfDays | unique (organizationId, employeeId, leaveTypeId, year) |
| **LeaveRequest** | → employee, → leaveType, fromDate, toDate, halfDays, reason, status `PENDING/APPROVED/REJECTED/CANCELLED`, decidedById?, decisionNote | idx (organizationId, status, fromDate), (organizationId, employeeId) |
| **SalaryComponent** | name, code, kind `EARNING/DEDUCTION`, calc `FIXED/PERCENT_OF_BASIC/PERCENT_OF_GROSS`, statutory `PF_EE/PF_ER/ESI_EE/ESI_ER/PT/TDS/NONE`, → account | unique (organizationId, code) |
| **EmployeeSalaryComponent** | → employee, → component, amount or rateBp | unique (organizationId, employeeId, componentId) |
| **PayrollRun** | month `2026-10`, → financialYear, status `DRAFT/POSTED/CANCELLED`, totals, → journalEntry | unique (organizationId, month) |
| **Payslip** / **PayslipLine** | employee, paid days, LOP, gross, deductions, net, employer PF/ESI; lines with name and amount snapshots | unique (organizationId, payrollRunId, employeeId) |

### 3.9 What sign-up creates (one transaction)

User → Organization + settings → Head-office branch and Main warehouse → current financial year →
number series for every document type → the 7 default roles → Owner membership → the default chart
of accounts (below) → GST units (UQC). It's seeded from code, so every organization starts identical.

**Default chart of accounts** follows the Tally-style groups Indian accountants already know, mapped
to Schedule III headings for the balance sheet: Capital Account; Reserves & Surplus; Secured /
Unsecured Loans; Current Liabilities (Duties & Taxes, Provisions, Trade Payables); Fixed Assets;
Investments; Current Assets (Bank Accounts, Cash-in-Hand, Deposits, Loans & Advances, Stock-in-Hand,
Trade Receivables); Sales Accounts; Purchase Accounts; Direct / Indirect Incomes; Direct / Indirect
Expenses; Suspense. System ledgers: Cash, Trade Receivables, Trade Payables, Sales, Sales Returns,
Purchases, Purchase Returns, Output and Input CGST / SGST / UTGST / IGST / Cess, RCM Payable,
TDS Receivable, Round Off, Discount Allowed/Received, Bank Charges, Salaries & Wages, Opening Balance
Difference, plus common indirect expense heads (rent, electricity, telephone, travel, office expenses…).

---

## 4. Money, quantities and GST — the single rounding module

`src/lib/money/rounding.ts` is the only place rounding happens. It's isomorphic, so the form shows
the same totals the server computes, as Hyperzen does. Every value is a JavaScript `bigint`. That
keeps products like quantity × rate exact (with `number` they can pass 2^53). Values parse from
strings, never through floats.

- Rounding mode: **half-up** (away from zero), applied **once per line** for each figure:
  - `amount   = round(qtyMilli × rate / 1000)`
  - `discount = round(amount × discountBp / 10000)`, or a flat amount
  - document-level discount is shared across lines in proportion to value, with the last line taking the remainder (Hyperzen's method)
  - `taxable  = amount − discount − share of the document discount`
  - intra-state: `CGST = SGST/UTGST = round(taxable × rateBp / 20000)` (this also handles 0.25% correctly, without halving the rate to 12.5 bp)
  - inter-state: `IGST = round(taxable × rateBp / 10000)`; cess: `round(taxable × cessBp / 10000)`
  - **tax-inclusive prices:** `gross = round(qty × rate)`, then `CGST = SGST = round(gross × rate / (2 × (10000 + rate)))` and `taxable = gross − taxes`, so the line total equals exactly what was typed and CGST always equals SGST
- Document total = Σ (taxable + taxes). Round-off to the nearest rupee (half-up) when the setting is on;
  the difference posts to Round Off.
- GST rates are data, not code. The picker offers today's slabs (0, 0.25, 1.5, 3, 5, 18, 40%), and the
  old 12% and 28% stay valid for older documents.

**Which tax applies:**
1. Seller state = place of supply → CGST + SGST; CGST + UTGST in Chandigarh, Ladakh, Lakshadweep,
   Andaman & Nicobar and DNH & DD (Delhi, Puducherry and J&K charge SGST).
2. Different states → IGST.
3. SEZ and exports → IGST whatever the state, or zero tax under LUT (`*_WITHOUT_TAX`); exports use place of supply 96.
4. Reverse charge flag: sales show the tax but don't collect it; on purchases the business posts the RCM liability and the matching input credit.
5. A composition-scheme or unregistered seller charges no tax and the document prints as a **Bill of Supply**.
6. Nil-rated, exempt and non-GST items carry 0 tax and are reported separately in GSTR-1 and GSTR-3B.
7. Place of supply defaults to the shipping state for goods and the billing state for services
   (the organization's state if unknown). The user can change it on the document.
8. Seller GSTIN and state come from the document's branch, so a company with registrations in two
   states charges correctly from each.

Each of these is a named test in Phase 4 (and the arithmetic in Phase 2).

**Posting rules (one journal per posted document):**

| Document | Debit | Credit |
| --- | --- | --- |
| Sales invoice | Trade Receivables (party) — grand total | Sales (per item or default) — taxable; Output CGST/SGST/UTGST/IGST/Cess; Round Off ± |
| Credit note | Sales Returns; Output taxes | Trade Receivables (party) |
| Purchase bill | Purchases (or the item's account) — taxable; Input taxes when ITC is eligible (otherwise added to cost); Round Off ± | Trade Payables (party) |
| Purchase bill, reverse charge | Purchases; Input taxes (RCM) | Trade Payables — taxable only; RCM Payable |
| Debit note | Trade Payables (party) | Purchase Returns; Input taxes |
| Receipt | Cash/Bank; TDS Receivable (if deducted) | Trade Receivables (party) |
| Payment | Trade Payables (party) | Cash/Bank |
| Contra | Cash or Bank | Bank or Cash |
| Expense | Expense heads; Input taxes when eligible | Cash/Bank, or Trade Payables (party) |
| Manual journal | Any — balanced; control accounts need a party | Any |
| Payroll (phase 8) | Salaries & Wages; employer PF/ESI | Salary Payable; PF/ESI/PT/TDS Payable |
| Cancellation | Every line of the original, swapped | |
| Delivery note, goods receipt, transfers, adjustments | No journal (stock only) | |

---

## 5. Capabilities and default roles

Capabilities are fixed in `src/lib/rbac.ts`. Roles are rows per organization. As in Hyperzen, nobody
can grant a capability they don't hold, or create, edit or assign a role at or above their own rank.
The last Owner can't be removed or demoted. **Deleting the organization** and transferring ownership
are tied to the system Owner role, not to a grantable capability.

| Capability | Gates |
| --- | --- |
| `sales.read` | Customers, quotations, orders, delivery notes, invoices, credit notes, receipts, statements, receivables ageing |
| `sales.write` | Create and edit drafts; issue quotations, orders and invoices; record receipts; edit customers |
| `sales.approve` | Cancel posted sales documents, issue credit notes, sell over a customer's credit limit or below the price list |
| `purchases.read` / `.write` / `.approve` | Same pattern for suppliers, POs, goods receipts, bills, debit notes, payments, payables ageing |
| `inventory.read` | Items, stock levels, stock movement, low stock, barcode lookup |
| `inventory.write` | Items, units, price lists, warehouses, transfers, adjustment drafts; delivery notes and goods receipts against open orders (the storekeeper sees the order's items and quantities, not its prices) |
| `inventory.approve` | Post and cancel adjustments and opening stock; override negative-stock blocking |
| `inventory.valuation` | See purchase costs and stock value (otherwise hidden — storekeepers see quantities only) |
| `accounts.read` | Chart of accounts, ledgers, day book, journals, cash and bank books, reconciliation status |
| `accounts.write` | Manual journals, contra, expenses, bank statement import and matching, ledger opening balances |
| `accounts.approve` | Cancel accounting documents; edit the chart of accounts |
| `accounts.lock` | Set or move the period lock date |
| `reports.read` | Trial balance, P&L, balance sheet, cash flow, GSTR-1 / GSTR-3B summaries, registers |
| `data.export` | CSV / Excel exports and the full data export |
| `hr.read` / `.write` / `.approve` | Employees, departments, attendance corrections; approve leave |
| `payroll.read` / `.write` / `.approve` | View payroll; prepare runs; post payroll |
| `activity.read` | Activity log and audit trail |
| `settings.write` | Company profile, GST, branches, warehouses, financial years, number series, branding, email, notification retention, attendance location |
| `users.manage` | Invite and remove members, assign roles below your own |
| `roles.manage` | Create and edit roles within your own capabilities |

Every member who is linked to an employee record can check in, request leave and view their own
payslips. That's self-service, not a capability.

| Role (rank) | Capabilities |
| --- | --- |
| **Owner** (0, system) | Everything |
| **Accountant** (10) | sales.\*, purchases.\*, inventory.read, inventory.valuation, accounts.\*, reports.read, data.export, payroll.read, payroll.approve, activity.read |
| **Sales** (40) | sales.read, sales.write, inventory.read |
| **Purchase** (40) | purchases.read, purchases.write, inventory.read, inventory.valuation |
| **Storekeeper** (40) | inventory.read, inventory.write |
| **HR** (40) | hr.\*, payroll.read, payroll.write |
| **Viewer** (80) | every `.read`, reports.read, activity.read — no export |

---

## 6. Route map

**Public** (work without the app; Play Store links point here)

| Route | Purpose |
| --- | --- |
| `/` | Landing page with sign-up |
| `/signup`, `/login`, `/forgot-password`, `/verify-email` | Accounts |
| `/invite/[token]` | Accept a staff invite (sign in or create a login) |
| `/accept-policies` | Accept new policy versions |
| `/privacy`, `/terms` | Current policy text |
| `/delete-account` | How to delete an account or an organization, with or without the app |
| `/.well-known/assetlinks.json` | Android App Links (route handler) |

**App** (`/app`, tenant session)

| Area | Routes |
| --- | --- |
| Home | `/app` dashboard · `/app/select-org` · `/app/onboarding` · `/app/more` (phone) · `/app/notifications` · `/app/activity` |
| Sales | `/app/sales` hub · `quotations` · `orders` · `deliveries` · `invoices` · `credit-notes` · `receipts` — each with `/new`, `/[id]`, `/[id]/edit` · `customers`, `customers/[id]` (ledger and statement) · `outstanding` (ageing) |
| Purchases | `/app/purchases/orders` · `receipts` (goods receipts) · `bills` · `debit-notes` · `payments` · `suppliers`, `suppliers/[id]` · `payables` |
| Items and stock | `/app/items`, `/app/items/[id]` (stock card) · `/app/items/price-lists` · `/app/inventory/stock` · `movements` · `low-stock` · `transfers` · `adjustments` · `opening-stock` · `warehouses` |
| Accounts | `/app/accounts/chart` · `ledgers/[id]` · `journals` · `contra` · `expenses` · `cash-book` · `bank/[accountId]` (book, imports, reconcile) · `lock` |
| Reports | `/app/reports` hub · `day-book` · `trial-balance` · `profit-loss` · `balance-sheet` · `cash-flow` · `sales-register` · `purchase-register` · `gst/gstr-1` · `gst/gstr-3b` · `gst/hsn` |
| HR and payroll | `/app/hr/employees` · `departments` · `attendance` · `leave` · `leave-types` · `/app/payroll/runs`, `runs/[id]` · `components` · self-service `/app/me/attendance` · `/app/me/leave` · `/app/me/payslips` |
| Settings | `/app/settings` (company) · `gst` · `branches` · `warehouses` · `financial-years` · `number-series` · `branding` · `email` · `notifications` · `members` · `roles` · `hr` · `delete-organization` |
| Your account | `/app/account` (profile, password, signed-in devices, export my data, delete my account) |

**Print and API**

| Route | Purpose |
| --- | --- |
| `/print/[type]/[id]` | Printable document (`(print)` group) |
| `/api/pdf/[type]/[id]` | The PDF file, authenticated — what the phone saves and shares |
| `/api/files/[id]` | Private files (receipts, logos), authenticated and capability-checked |
| `/api/export/[list]` | CSV / Excel for any list, with the list's own filters |
| `/api/export/organization`, `/api/export/account` | Full data export (zip of CSV + files), streamed |
| `/api/notifications/poll` | Unread count and latest items for the bell |
| `/api/items/lookup?barcode=` | Scanner lookup |
| `/api/push/register` | FCM token (only when push is configured) |
| `/api/health` | Container health check |

**Platform console** (`/platform`, platform session only): `/platform/login` · `/platform`
(organizations, usage, status) · `/platform/orgs/[id]` (suspend, reactivate, open read-only support
view) · `/platform/policies` · `/platform/email` (system SMTP — you type the password into the form
yourself) · `/platform/audit`.

---

## 7. Folder structure

```
android/                      Capacitor Android project (phase 6)
capacitor.config.ts
docs/                         this plan; deployment runbook
prisma/
  schema.prisma
  migrations/                 SQL migrations, incl. hand-written triggers and CHECK constraints
  seed.ts                     platform defaults (policies)
scripts/
  dev-db.mjs                  embedded PostgreSQL + shadow DB (from Hyperzen)
  db-preflight.ts, copy-database.ts
  create-platform-admin.ts
  jobs.ts                     daily: purge sessions/notifications, finish deletions past grace, overdue and low-stock alerts
  demo-seed.ts                demo organization for the Play review (phase 5)
  server/                     backup.sh, restore notes used by the README
src/
  middleware.ts
  app/
    (marketing)/              landing, privacy, terms, delete-account
    (auth)/                   login, signup, forgot-password, verify-email, invite, accept-policies
    app/                      the ERP (layout = app shell), one folder per area, colocated actions.ts
    (print)/print/[type]/[id]
    platform/
    api/
    .well-known/assetlinks.json/route.ts
  server/                     server-only ("server-only" import in every file)
    db/                       raw.ts (the only PrismaClient), tenant.ts (forOrg), readonly.ts, identity.ts, tenant-sql.ts
    auth/                     sessions, passwords, reset codes, platform and support sessions, context + action wrapper
    sales/ purchases/ inventory/ accounts/ gst/ hr/ payroll/
    numbering/ notifications/ activity/ revisions/ files/ email/ sms/ push/ export/ pdf/
  lib/                        isomorphic (safe in the browser)
    money/                    paise, rounding.ts (THE rounding module), format (₹1,23,456.78)
    gst/                      states, GSTIN check digit, compute
    rbac.ts, dates.ts (IST, financial year), validation/ (Zod schemas shared by forms and actions), csv.ts, utils.ts, app-detect.ts (Capacitor detection — UI only)
  components/
    shell/                    app shell, sidebar, bottom tab bar, org switcher, bell, theme
    ui/                       Hyperzen's kit + money/qty/date inputs, responsive table→cards, sticky action bar
    documents/                line editor, totals, party picker, item picker (barcode)
    charts/
    native/                   scan, camera, share-PDF buttons — render only inside the app
tests/
  setup/                      starts a throwaway PGlite, runs migrations (npm test needs nothing running)
  isolation/  posting/  gst/  money/  rbac/  numbering/  inventory/
Dockerfile, docker-compose.yml, .env.example, .dockerignore, .gitignore, README.md
```

---

## 8. Approach notes per phase

- **Phase 1** covers everything listed for it. The dashboard shell is there with empty states; real
  figures arrive in Phase 2.
- **Performance:** server-rendered pages, database pagination (`take`/`skip` with an
  `organizationId`-first index for every filter), trigram indexes for name search, the dashboard's
  queries in parallel with covering indexes, and journal-line balances via index-only aggregates.
  I'll measure the slowest screens against the 300 ms target on the server in Phase 5.
- **Timed jobs:** `scripts/jobs.ts daily`, run by the server's crontab right after the nightly backup.
  Notification purge also runs opportunistically, as in Hyperzen.
- **Outside services** (all optional, off by default, configured in settings): SMTP (platform and
  per-organization), SMS (Twilio, as Hyperzen), and FCM push (phase 6). I'll flag any new one before
  adding it.
- **New libraries** beyond the stack list: `next-themes`, `clsx` + `tailwind-merge` (all already in
  Hyperzen), `vitest`, `@react-pdf/renderer` (if D2 = A), `fflate` (zip export), `exceljs` (Excel
  exports, server-only), `qrcode` (UPI QR on invoices).
- **Out of scope as specified:** GST filing, e-invoice IRN generation and the e-way bill API
  (e-invoicing is mandatory above ₹5 crore turnover — such businesses would need an IRP integration
  later). GSTR-3B input credit is "as per books"; reconciling it against GSTR-2B isn't included.
- **Android (phase 6):** Capacitor's docs describe `server.url` as meant for development. Apps use it
  in production, and the spec chooses it. The native features in section 7 of your brief are what
  keep the app from being treated as a plain WebView. This PC has JDK 25. The Android build needs
  JDK 21, which Android Studio bundles. The Android SDK is already installed.
- **GitHub:** `gh` isn't installed on this PC. Creating the private repo is a few clicks I'll list at
  the end of Phase 1. The server's read-only deploy key is generated on the server, and you only ever
  see its *public* half.

---

## 9. Decisions I need from you

| # | Decision | My recommendation |
| --- | --- | --- |
| D1 | The four placeholders | Domain `erp.hyperzen.in` · package `in.hyperzen.erp` (permanent once published) · server folder `/home/dev2/projects/hyperzen-erp` · short name `hzerp` (compose project, network, containers, `/home/dev2/hzerp-data`) · Play Store title **"Hyperzen ERP"** (plain "Hyperzen" is likely taken or too generic for the store) |
| D2 | How PDFs are made | **A: `@react-pdf/renderer`** — one layout per document drawn server-side as a real PDF, in-process and light. The print route shows that PDF with a toolbar. B: Hyperzen-style HTML print page plus a second PDF layout (two layouts to keep in step). C: headless Chromium turning the HTML into PDF (one layout, but ~300 MB image and heavy RAM on the shared server) |
| D3 | Stock in the accounts | **Periodic (Tally-style):** purchases post to Purchases; closing stock is valued at weighted average from the stock ledger and shown in P&L and the balance sheet. Backdated documents never force a re-post of already-posted entries. The alternative (posting cost of goods per invoice) can't stay immutable when someone enters a backdated purchase |
| D4 | Deletion grace period | **30 days** for both. Organization: the Owner can cancel during grace; members are locked out. Account: personal details are anonymised, and documents the person created stay with the company as "Deleted user" (business records belong to the organization). An Owner of an organization with other members must transfer ownership or delete the organization first |
| D5 | Email verification at sign-up | **Yes**, a 6-digit code (same flow as reset), once platform SMTP is configured. In development the code prints to the terminal |
| D6 | "Approve" capability meaning | **As in section 5:** salespeople issue invoices themselves; `approve` is for cancelling, credit notes and limit overrides |
| D7 | GitHub account for the private repo | Tell me the account or organization name (no password). I'll give click steps |

Reply "approve with your defaults" or tell me what to change, and I'll start Phase 1 with its plan.
