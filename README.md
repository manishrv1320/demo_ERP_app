# Hyperzen ERP

A multi-company ERP for Indian small and medium businesses — GST invoicing, purchases, inventory, accounts
and payroll — on the web and on Android. Built the Hyperzen way: the stack, conventions, security model and
deployment of `D:\Hyperzen` (hyperzen.in).

- **Web:** Next.js 15 (App Router, Server Components, Server Actions), React 19, strict TypeScript, Tailwind CSS 4
- **Data:** Prisma 6 + PostgreSQL 16, Prisma **migrations** (never `db push` — this database holds accounting data)
- **Libraries:** Zod, react-hook-form, lucide-react, recharts, sonner, bcryptjs, nodemailer, server-only, next-themes, fflate
- **Runtime and tests:** Node 24, embedded PGlite for local development and tests, Vitest
- **Android:** Capacitor wrapping the live site (phase 6)

The full design — data model, capabilities, routes, decisions — is in [docs/phase-0-plan.md](docs/phase-0-plan.md).

## Status

| Phase | What | State |
| --- | --- | --- |
| 0 | Plan | Done |
| 1 | Foundation: auth, tenancy + isolation tests, roles, settings, app shell, notifications, revisions, policies, deletion, landing page | Done — waiting for approval |
| 2 | Masters, sales, GST invoicing, receipts, PDFs, dashboard | Next |
| 3 | Purchases and inventory | |
| 4 | Accounts, banking, reports, GST exports, period lock | |
| 5 | Deploy to the server, demo organization | |
| 6 | Android app | |
| 7 | Play Store release kit | |
| 8 | HR and payroll | |

## Run it locally

Needs Node 24. Nothing else — the database is embedded.

```bash
npm install
npm run setup:env      # creates .env with a fresh DATA_ENCRYPTION_KEY (never printed)
npm run db:dev         # terminal 1: PostgreSQL (PGlite) on 127.0.0.1:5443, shadow DB on 5444
npm run db:migrate     # terminal 2: applies migrations (and creates new ones after schema edits)
npm run db:seed        # Terms, Privacy Policy, platform settings
npm run dev            # http://localhost:3000
```

- Sign up at http://localhost:3000/signup. In development, email isn't sent: the six-digit verification and
  reset codes are **printed in the `npm run dev` terminal**.
- Platform console (Hyperzen staff): `npm run platform:create-admin -- --email you@hyperzen.in --name "Your Name"`.
  The generated password is written to `platform-admin-<time>.txt` (mode 600, git-ignored) and never printed.
  Sign in at http://localhost:3000/platform/login, then delete the file.

| Script | Does |
| --- | --- |
| `npm run typecheck` / `lint` / `test` / `build` | The four checks every phase must pass |
| `npm test` | Starts its own in-memory PostgreSQL, applies every migration, runs all tests — needs nothing running |
| `npm run db:migrate` | `prisma migrate dev` against the dev database (uses the shadow DB on 5444) |
| `npm run db:deploy` | `prisma migrate deploy` — production |
| `npm run jobs:daily` | Housekeeping and finishing deletions (server crontab, after the nightly backup) |

PGlite serves one connection at a time. If a migration or script waits and times out, stop `npm run dev`
(or `next start`) first — it holds the connection.

Stop `npm run db:dev` with **Ctrl+C**, never by killing the process: a hard kill can leave `.pgdata` unreadable
("RuntimeError: Aborted()"). If that happens, rename `.pgdata` (e.g. to `.pgdata-damaged`, git-ignored), run
`npm run db:dev` again and then `npm run db:deploy && npm run db:seed`. Local data only — production uses real PostgreSQL.

## Rules this code keeps

1. **Self-hosted.** All data is in our PostgreSQL and on our server's disk. Live updates use polling (the
   notification bell polls every 30 s). Outside services are optional and **off by default**:
   - SMTP — platform-wide (Platform console → Email) for codes and invitations; per organization (Settings → Email) for documents;
   - SMS — Twilio, via `SMS_PROVIDER` in the server's env file (as in Hyperzen);
   - FCM push — phase 6, only once `google-services.json` is added.
2. **Shared server.** The ERP gets its own Compose project, Postgres, network, data folder, loopback ports
   and tunnel (phase 5). Nothing of Legaleasy's or Hyperzen's is touched.
3. **Money** is integer paise (`BigInt`), quantities integer thousandths, rates integer basis points. Rounding
   happens once, per line, in `src/lib/money/rounding.ts` (phase 2).
4. **Permissions are checked on the server** in every action and route — `action()` / `requirePage()`. A
   screen a role can't use is a 404.
5. **Tenant isolation** — see below.
6. **Posted accounting documents are never edited or deleted** (phase 4: reversing entries + database
   triggers). Everything else keeps a restorable snapshot on edit (revision history).
7. **Secrets** are git-ignored from the first commit: `.env*`, keystores, `keystore.properties`,
   `google-services.json`, key files, platform-admin credential files.

## Tenant isolation

Leaking one company's data to another is the worst failure this app can have, so it takes four layers:

1. **Composite foreign keys.** Every tenant table has `@@unique([organizationId, id])` and links to other
   tenant tables through `(organizationId, xId) → (organizationId, id)`. The database refuses a row in one
   organization that points at another's.
2. **`forOrg(orgId)`** (`src/server/db/tenant.ts`) — the tenant client every page and action gets as `ctx.db`.
   It adds `organizationId` to every query and every created row, throws if a caller names another
   organization, has no access to global tables, and doesn't expose raw SQL.
3. **Lint rule.** Only `src/server/db/**`, `src/server/platform/**`, scripts, the seed and tests may import
   `@prisma/client` values or the raw client (`eslint.config.mjs`). Type imports are fine everywhere.
4. **Tests** (`tests/isolation/`), generated from Prisma's model metadata so new tables are covered
   automatically: every operation through organization A's client is tried against B's rows, the database's
   foreign keys are tried directly, and a schema test fails the build if a tenant table breaks the conventions.

## Security

- Sessions are database rows; the cookie (`hzerp_session`: httpOnly, secure, sameSite=lax, 30 days) holds a
  random token and only its SHA-256 hash is stored. Changing the password signs out every device.
- Membership, role and organization status are re-checked on every request.
- Passwords: bcrypt (12 rounds). Unknown emails take as long as wrong passwords.
- Rate limits on sign-up, sign-in, reset codes (per network and per address), invitations and test emails.
  The client IP comes from Cloudflare's `CF-Connecting-IP`, which a client can't forge.
- Reset and verification codes: six digits, hashed, ten minutes, five attempts, identical replies whether or
  not an account exists.
- Encryption at rest (AES-256-GCM, `src/server/security/encryption.ts`, header `HZERP`): uploaded files and
  SMTP passwords. **Losing `DATA_ENCRYPTION_KEY` loses those files — keep a copy away from the backups.**
- Private files live outside the repo under random names, in `orgs/<organizationId>/`, and are served only by
  `/api/files/[id]` after a membership and capability check.
- CSV exports neutralise spreadsheet formulas.
- Headers: `X-Frame-Options: DENY`, `nosniff`, strict referrer, HSTS in production (no includeSubDomains), the
  canonical-https redirect via `CF-Visitor`.
- Platform console: separate accounts created only by the CLI, separate session table, cookie scoped to
  `/platform`, everything audited. Support view: a reason is required, it's read-only (refused by the action
  wrapper and by the read-only tenant client), lasts 60 minutes, and every page opened is logged.
- Policies: Terms and Privacy are versioned; a new version must be accepted before continuing.
- Deletion (Google Play): account and organization deletion need typed confirmation, offer a full export
  first, and wait 30 days. `npm run jobs:daily` then deletes the organization's rows and files, or anonymises
  the account ("Deleted user"). The activity log is never purged (Companies (Accounts) Rules audit trail).

## Layout

```
prisma/            schema.prisma, migrations/, seed.ts
scripts/           dev-db.mjs + pglite-server.mjs (embedded PostgreSQL), setup-env, create-platform-admin, jobs
src/app/           (marketing) landing, terms, privacy, delete-account · (auth) sign-in screens
                   app/(shell) the ERP · app/(bare) choose/create organization · platform/ console · api/
src/server/        server-only: db/ (raw client, forOrg, identity, provision, export, purge), auth/, platform/,
                   email/, files/, security/, activity, notifications, revisions, policies
src/lib/           isomorphic: rbac, dates (IST, financial year), gst/, numbering, validation/, csv
src/components/    shell/ (sidebar, tab bar, org switcher, bell), ui/ (kit), revision-history
tests/             setup/ (throwaway database, request stand-in), isolation/, actions/, lib/
```

## Deployment

Phase 5 (planned, not yet run): server `dev2@117.222.154.129`, Compose project `hzerp` (db `postgres:16-alpine`,
app, `cloudflared` under the `public` profile), ports `127.0.0.1:3200` and `127.0.0.1:5435`, data in
`/home/dev2/hzerp-data`, its own Cloudflare tunnel for `erp.hyperzen.in`, nightly `pg_dump` + storage mirror
to Google Drive with rclone. The exact plan is shown and approved before any command runs on the server.
