# Environment configuration

All variables are validated at startup by `packages/shared/src/config/env.ts`
(a typed Zod schema) — the app refuses to boot with a specific, actionable
error listing exactly which variables are missing or malformed, rather than
failing confusingly later. See `.env.example` for the canonical, always-current
list; this document explains what each group means and how to satisfy it.

## Where `.env` lives

There is **one** `.env` file, at the repository root — not per-package.
Each runtime that needs it loads it explicitly, because neither Next.js nor
`tsx` auto-loads an env file from a parent directory:

- `apps/web` (Next.js): auto-loads `.env.local` from **its own** directory.
  Local dev: symlink it — `ln -s ../../.env apps/web/.env.local`.
- `apps/worker`: same symlink pattern — `ln -s ../../.env apps/worker/.env.local`
  — loaded explicitly in `apps/worker/src/index.ts` via
  `process.loadEnvFile()` (Node 22's built-in, no `dotenv` dependency).
- `packages/db/prisma.config.ts` (the Prisma CLI's config, used by
  `migrate`/`generate`/`studio`/`db seed`): loads the root `.env` directly
  via the `dotenv` package (Prisma 7 does not auto-load env files at all).
- `packages/seed/src/seed.ts`: same explicit-load pattern as the worker,
  for the case where it's invoked directly rather than through
  `prisma db seed`.

In a real deployment, set these as actual process environment variables
(however your platform does that) rather than shipping a `.env` file.

## Core (always required)

| Variable | Meaning |
| --- | --- |
| `NODE_ENV` | `development` \| `test` \| `production`. Gates the production-only checks below. |
| `APP_URL` | Public base URL, no trailing slash. Used to build absolute links in emails (verification, password reset, staff invites). |
| `APP_NAME` | Shown in email templates and page titles. Never hardcode the business name in code — this is why. |
| `DEFAULT_TENANT_SLUG` | The single tenant the seed script creates and `getDefaultTenant()` resolves, for a single-business deployment. |
| `DATABASE_URL` | Postgres connection string, e.g. `postgresql://user:pass@host:5432/db?schema=public`. |
| `REDIS_URL` | Redis connection string for BullMQ, e.g. `redis://localhost:6379`. Startup only checks that this is a non-empty string, not that it's reachable — BullMQ connects lazily on first enqueue/dequeue (same lazy pattern as the Prisma client; see ARCHITECTURE.md). A placeholder value lets the app boot and serve pages that don't touch the job queue; anything that actually enqueues (registration, password reset, staff invite emails) will fail at that point instead, with a connection error, until this points at a real, reachable Redis. |
| `BULL_BOARD_PORT` | Port the worker serves the Bull Board queue-monitoring UI on. Default `3001`. |

## Auth

| Variable | Meaning |
| --- | --- |
| `AUTH_SECRET` | Signs the session JWT. Generate with `openssl rand -base64 48`. At least 32 characters; startup fails otherwise. |
| `ENCRYPTION_KEY` | AES-256-GCM key for at-rest secrets (TOTP today). Generate with `openssl rand -base64 32` — must decode to exactly 32 bytes. **Rotating this strands existing encrypted secrets** — see SECURITY.md. |
| `STAFF_REQUIRE_2FA` | Reserved for a future mandatory-2FA-for-staff policy. Not yet enforced. |

## Email

| Variable | Meaning |
| --- | --- |
| `EMAIL_PROVIDER` | `resend` or `smtp`. Local dev: `smtp` pointed at the Mailpit container (see docker-compose.yml) so nothing leaves your machine. |
| `EMAIL_FROM` | `"Name <address>"` sender for all transactional email. |
| `RESEND_API_KEY` | Required in production only if `EMAIL_PROVIDER=resend`. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_SECURE` | Required in production only if `EMAIL_PROVIDER=smtp`. Local dev defaults (`localhost:1025`, no auth) target Mailpit. |

If the selected provider's required credentials are missing **in
production** (`NODE_ENV=production`), startup fails immediately rather than
silently dropping emails — see `validateProductionRequirements` in
`packages/shared/src/config/env.ts`. Like `REDIS_URL`, this is a
presence check, not a real-credential check — `RESEND_API_KEY` isn't
validated against Resend's API, and `SMTP_HOST`/`SMTP_PORT` aren't
tested for connectivity, until an email actually tries to send (see
`packages/notifications`). A placeholder value unblocks startup the
same way; it doesn't mean email actually works.

## Object storage (declared, not yet used)

`STORAGE_ENDPOINT`, `STORAGE_REGION`, `STORAGE_BUCKET`,
`STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`,
`STORAGE_FORCE_PATH_STYLE` — S3-compatible (AWS S3, Cloudflare R2, MinIO,
Wasabi all work via the endpoint override). Nothing in Phase 1 uploads
files, so these are unused until ticket attachments / KB assets (Phase 5)
land. Leave blank.

## Observability (declared, not yet used)

`SENTRY_DSN`, `SENTRY_ENVIRONMENT` — no error-tracking SDK is wired up yet.
Leave blank for now; startup only warns, never fails, on a missing DSN.

## Payments — Phase 2 (declared, not yet used)

`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`,
`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID` — no gateway
integration exists yet. Checkout in Phase 1 has no payment step; invoices
are settled via the staff-only manual "mark paid" action (see
ARCHITECTURE.md). Leave blank until Phase 2.

## Domains — Phase 4 (declared, not yet used)

`REGISTRAR_PROVIDER` (only `"manual"` is a valid value today —
the schema will grow an enum member per real adapter as they're built),
`REGISTRAR_API_KEY`, `REGISTRAR_API_SECRET`, `REGISTRAR_SANDBOX`. Which
registrar to integrate with is a genuinely open business decision (see the
product spec's section 67) — don't guess at this without asking first.

## Hosting provisioning — Phase 3 (declared, not yet used)

`PROVISIONING_DEFAULT_DRIVER` (`"manual"` or `"cpanel"` — cPanel/WHM is the
first concrete adapter the product spec names, but no code implements it
yet). Leave as `manual`.

## Docker Compose service variables

`docker-compose.yml` reads `POSTGRES_USER` / `POSTGRES_PASSWORD` /
`POSTGRES_DB` / `POSTGRES_PORT` / `REDIS_PORT` / `MAILPIT_SMTP_PORT` /
`MAILPIT_UI_PORT` to configure the local Postgres, Redis, and Mailpit
containers — keep these consistent with the host/port portion of
`DATABASE_URL` / `REDIS_URL` above.

## Seed-only overrides

`SEED_ADMIN_PASSWORD` / `SEED_CLIENT_PASSWORD` — override the seed script's
default dev password (`ChangeMe123!`) for the seeded staff/client accounts.
Never set these to anything you'd consider sensitive; the seed script is
development tooling, and the accounts it creates have `mustChangePassword`
semantics you should actually use.
