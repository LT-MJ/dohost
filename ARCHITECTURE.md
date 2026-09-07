# Architecture

## Guiding principles

These hold across every phase, not just what's built so far:

1. Server-side authorization is authoritative; UI checks are convenience only.
2. Money is always an integer count of minor units (`{ amount: number, currency: string }`
   — see `packages/shared/src/money`). Never a float.
3. Financial and lifecycle records are immutable once created. "Changing"
   a price, a status, or an invoice means creating a new versioned record
   or a new state-history row — never rewriting history in place.
4. Every state transition goes through a domain-service function that
   validates the transition against an explicit map and records
   `StatusHistory` in the same transaction. UI code never sets `.status`
   directly.
5. Every security- or business-sensitive mutation writes an `AuditLog` row
   in the same transaction as the mutation.
6. Domain logic lives in `packages/*`, never in `apps/web` route handlers
   or components. Server actions in `apps/web/src/lib/actions/*` are thin
   adapters: resolve the current actor, call a domain service, revalidate.
7. External integrations sit behind an adapter interface with a manual
   fallback; nothing pretends an unconfigured integration succeeded.

## Multi-tenancy

Every business record hangs off a `Tenant` row (`packages/db`'s
`schema.prisma`). A single-business deployment just seeds one tenant
(`DEFAULT_TENANT_SLUG`, default `"default"`) — the schema and domain
services are already tenant-scoped, so introducing real multi-tenancy
later is a routing/auth change, not a data-model rewrite.

## Identity, sessions, and RBAC

**Two actor types, one NextAuth instance.** Staff (`StaffUser`) and clients
(`ClientContact`, a sub-account of the billing entity `Client`) are
different security domains with different permission models — RBAC
permission strings for staff, boolean flags (`billing`/`support`/`domains`/
`services`) for client contacts. Rather than running two separate Auth.js
instances (two cookies, two route-handler mounts), `apps/web/src/auth.ts`
runs **one** Credentials-based NextAuth config whose `authorize()` branches
on an `actorType` field the login form submits, and whose session JWT
carries only `{ actorType, sessionToken }`. This is a deliberate
simplification for Phase 1, documented here so it's revisited deliberately
if the two domains need to diverge further (e.g. different cookie
lifetimes) — see "Deferred / Phase 7" below.

**Sessions are DB-backed and revocable, not trust-the-JWT.** `StaffSession`
and `ClientSession` rows store a hash of an opaque token; the JWT only
carries that token. The `session()` callback in `auth.ts` looks up the
matching row on **every request** — if it's missing, expired, or revoked,
the caller is treated as logged out, and RBAC permissions are re-read from
the `Role`/`RolePermission` tables fresh each time (never cached in the
JWT), so a permission change or account disable takes effect immediately,
not just at next login. `packages/core/src/sessions.ts` is the only place
that creates/validates/revokes these rows.

**Admin impersonation** (section 41 of the product spec) is designed to be
an ordinary `ClientSession` row with `impersonatedByStaffUserId` set and a
short (30 min) expiry — the client portal layout shows a banner whenever
that field is present. The session plumbing for this exists
(`createClientSession` accepts the field); the staff-side "impersonate this
client" action/audit trail is not wired up yet — see roadmap.

**Route protection** lives in `apps/web/src/proxy.ts` (Next.js 16 renamed
`middleware.ts` to `proxy.ts`; same mechanism). It does an optimistic,
cookie-only check and redirects obviously-unauthenticated requests before
rendering. The real authorization decision is always re-checked server-side
in `lib/session.ts`'s `requireStaffActor()`/`requireClientActor()` (called
by every protected layout/page) and in each domain service via
`requirePermission()` — proxy.ts is a UX nicety, never the only gate.

*Routing gotcha worth remembering*: a layout's auth guard applies to every
route nested under its folder. The admin login/set-password/reset-password
pages must **not** be nested under the same folder as the protected admin
layout, or an unauthenticated visitor hitting the protected layout gets
redirected to the login page, which — being nested under the same
layout — redirects again, forever. The fix here was an
`app/admin/(protected)/` route group holding only the pages that require a
staff session, with the auth pages as siblings outside it (`app/admin/login`,
etc.), matching how the client portal already separated `/portal` (protected)
from `/login`, `/register` (public, top-level).

## Money

`packages/shared/src/money` represents every amount as
`{ amount: number, currency: string }` where `amount` is a whole number of
minor units (cents for USD). All arithmetic goes through pure functions
(`add`, `subtract`, `multiply` by an integer quantity, `percentageBps` for
tax/discount-style percentages as integer basis points, `allocate` for
splitting a total across N shares without losing or inventing a penny) that
assert their inputs are integers and same-currency. `fromDecimalString` /
`toDecimalString` are the only places a human-entered decimal crosses into
the integer representation, with a single rounding step at that boundary.
Amounts are stored in Postgres as `Int` (32-bit) — comfortably enough
headroom for hosting invoices; documented here so a future need for
larger amounts is a deliberate migration to `BigInt`, not a surprise.

## State machines

Order (`packages/billing/src/orders.ts`) and Invoice
(`packages/billing/src/invoices.ts`) each define an explicit
`Record<Status, Status[]>` transition map and a pure `isValidXTransition()`
checker (unit-tested in `*.test.ts` alongside them). The only way to change
`.status` is `transitionOrderStatus` / the invoice equivalent, which
validates against that map, writes the new status and a `StatusHistory` row
in one transaction, and throws `BusinessRuleError` on an illegal jump.
Client status (`packages/core/src/clients.ts`) follows the same pattern.

Phase 1's order flow: `createOrder` (PENDING, idempotent on
`(tenantId, idempotencyKey)`) → `issueInvoiceForOrder` (also flips the order
to AWAITING_PAYMENT) → staff `markInvoicePaidManually` (Phase 1's only
"payment" path — see below) → invoice PAID also drives the order to PAID.
PROCESSING/ACTIVE exist in the map for when Phase 3 (provisioning) starts
driving them; they're unused today, which is intentional, not a bug.

## Billing scope in Phase 1 (and what's deferred)

There is no payment gateway, tax engine, coupon engine, or ledger yet —
those are explicitly Phase 2. What exists:

- **Product catalog** with immutable, versioned pricing
  (`ProductPrice` rows are never mutated; changing a price closes the old
  row's `effectiveTo` and inserts a new one — see `setProductPrice`).
- **Orders** with immutable line-item snapshots (`OrderItem` copies the
  product name/price/billing-cycle at order time; a later product edit
  never rewrites a historical order).
- **Invoices** with snapshotted customer/company details at issue time.
- **"Payment"** is a staff-only manual action
  (`markInvoicePaidManually`) recording that money arrived by bank
  transfer — the documented Phase 1 fallback (see the product spec's
  section 67: don't fake an unconfigured integration). There is
  intentionally no `Payment`/`LedgerEntry`/`Refund` model yet — Phase 2
  introduces those alongside the real Stripe integration rather than
  guessing their shape now and reworking it.
- **Tax is always zero.** `taxTotal` fields exist and are wired through
  the whole pipeline so Phase 2's tax engine has somewhere to write, but
  nothing computes a nonzero value — inventing tax rates would violate
  section 23 of the product spec ("do not invent legally binding tax
  rules").

## Background jobs

`packages/jobs` defines BullMQ queues; `apps/worker` runs the processors.
The pattern (see `packages/jobs/src/email.ts` + `apps/worker/src/processors/email.tsx`):
a durable DB row (`EmailLog`) is created **before** the job is enqueued, in
the same call, so there's a record even if the worker never picks the job
up. The worker updates that row to `SENT`/`FAILED` via BullMQ's
`completed`/`failed` events (only marking `FAILED` once retries are
exhausted, not on every transient attempt). Bull Board
(`apps/worker/src/board.ts`, served on `BULL_BOARD_PORT`) gives visibility
into queue depth and failures. This is the template future queues
(provisioning, registrar sync, dunning) should follow.

## Audit logging & status history

Two distinct append-only tables, both written inside the same transaction
as the mutation they describe (`packages/db/src/audit.ts`):

- `StatusHistory` — one row per state-machine transition (`fromStatus`,
  `toStatus`, actor, reason). Answers "when did this order become PAID and
  who/what caused it."
- `AuditLog` — one row per sensitive action, broader than just status
  changes (client edited, staff invited, settings changed, note added).
  Carries before/after JSON snapshots for edits.

Both use a **plain string `actorId`** (not a foreign key to `StaffUser`/
`ClientContact`) so a log entry survives the actor's account being deleted
or disabled — audit history must outlive the thing it's auditing.

## Entity coverage vs. the full spec

The product spec (section 68) lists ~60 entities across every phase.
Phase 1 implements: `Tenant`, `StaffUser`, `Role`, `Permission`,
`RolePermission`, `StaffSession`, `Client`, `ClientGroup`, `ClientContact`,
`ClientSession`, `ClientNote`, `LoginEvent`, `EmailVerificationToken`,
`PasswordResetToken`, `ProductGroup`, `Product`, `ProductPrice`, `Order`,
`OrderItem`, `Invoice`, `InvoiceItem`, `StatusHistory`, `AuditLog`,
`SystemSetting`, `Counter`, `EmailLog`. Everything else (`Payment`,
`PaymentMethod`, `Refund`, `Chargeback`, `Credit`, `LedgerEntry`,
`CreditNote`, `TaxRule`, `TaxTransaction`, `Coupon`, `CouponRedemption`,
`Domain` and its satellites, `Server`, `ProvisioningJob`, `Ticket` and
support entities, `WebhookEvent`, `ApiKey`, `StaffTask`, `FraudReview`,
`BackupJob`, ...) is Phase 2+ and deliberately not stubbed — an empty table
with no domain service behind it is dead weight, not progress.

## Phase roadmap

- **Phase 1 — Foundation (done, this repo state).** Monorepo, auth/RBAC,
  clients, product catalog, orders, invoices, audit logging, both portals.
- **Phase 2 — Billing.** Stripe adapter, real `Payment`/`PaymentMethod`,
  webhooks (idempotent, signature-verified), subscriptions + recurring
  billing, `LedgerEntry` (append-only, reversal-based corrections),
  `Coupon`, real tax engine (configuration-driven, not invented rates),
  dunning, credit balance.
- **Phase 3 — Hosting automation.** `Server`, a `ProvisioningModule`
  adapter interface with a manual fallback and (once real credentials are
  chosen) one real control-panel adapter, `ProvisioningJob` with
  exponential backoff + dead-letter queue, `Service` lifecycle.
- **Phase 4 — Domains.** Domain search/registration/renewal/transfer, a
  `RegistrarModule` adapter interface (manual fallback always available;
  the real adapter depends on which registrar the business picks — a
  genuinely blocking question per the spec, not yet answered), DNS
  management, domain state machine.
- **Phase 5 — Support.** Tickets, departments, SLAs, knowledge base.
- **Phase 6 — Operations.** Reports, fraud engine, reconciliation jobs,
  versioned public API, outgoing webhooks, system-health dashboard.
- **Phase 7 — Hardening.** Security audit, the two-NextAuth-instance
  question above if warranted, CSP/security headers, backup + restore
  verification, accessibility audit, load testing.

## Key decisions and why

- **Prisma 7, driver-adapter mode.** Prisma 7 removed the bundled Rust
  query engine; `packages/db` uses `@prisma/adapter-pg` explicitly
  (`packages/db/src/client.ts`). The generator is `prisma-client` (not the
  older `prisma-client-js`), output to `packages/db/generated/prisma`
  (gitignored, regenerated by `pnpm db:generate`). Environment variables
  are **not** auto-loaded by the Prisma CLI in v7 — `prisma.config.ts`
  loads the repo-root `.env` explicitly.
- **The Prisma client is a lazily-initialized `Proxy`,** not a top-level
  `new PrismaClient()`. ESM evaluates a module's imports (and their side
  effects) before the importing module's own code runs — a standalone
  entrypoint (the worker, the seed script) that loads `.env` itself as its
  first step would otherwise crash if merely *importing* `@hostpanel/db`
  eagerly read `process.env.DATABASE_URL` before that load ran. The proxy
  defers construction to first property access.
- **`packages/seed` is its own package**, not `packages/db/prisma/seed.ts`.
  The seed script needs the domain services (`core`, `billing`, which
  depend on `db`) — keeping it inside `db` would make `db` depend on its
  own dependents. pnpm installs a cycle like that without complaint;
  Turborepo's task graph cannot schedule one. `prisma.config.ts`'s
  `migrations.seed` points at the sibling package by relative path.
- **Next.js 16's Cache Components feature is intentionally not enabled.**
  It's a significant new caching/prerendering model (`'use cache'`,
  `cacheLife`, instant-navigation validation) that pays off for
  content with meaningful static/cacheable portions. This app is almost
  entirely per-user authenticated dashboards; enabling it now would mean
  extensive `<Suspense>`/`'use cache'` restructuring for little benefit.
  Revisit if a substantial public/marketing surface gets built.
- **`proxy.ts`, not `middleware.ts`.** Next.js 16 renamed the file
  convention; behavior is the same, but the name matters — an
  auth-library helper or a stale doc referencing `middleware.ts` won't be
  picked up under the new name.
