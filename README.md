# HostPanel

A self-hosted hosting, domain, billing, and client-management platform —
architecturally comparable to WHMCS, built on a modern TypeScript stack.

This repository is being built in phases (see [ARCHITECTURE.md](./ARCHITECTURE.md)
for the full roadmap). **Phase 1 (Foundation) is implemented and tested**:
authentication/RBAC for staff and clients, client management, a versioned
product catalog, an order/invoice engine with immutable snapshots and
explicit state machines, audit logging, and both the admin and client
portals. Billing automation (Stripe, ledger, subscriptions), domains,
provisioning, and support are not built yet — see the roadmap.

## Tech stack

- **Next.js 16** (App Router, Turbopack) + React 19 + TypeScript
- **PostgreSQL** via **Prisma 7** (driver-adapter mode, no bundled query engine)
- **Auth.js (next-auth) v5** — credentials + DB-backed revocable sessions
- **Tailwind CSS v4** + **shadcn/ui** (Base UI primitives)
- **Redis** + **BullMQ** for background jobs, **Bull Board** for queue monitoring
- **React Email** + **Resend/SMTP** for transactional email
- **Vitest** for unit tests, **Playwright** for end-to-end tests
- **pnpm workspaces** + **Turborepo** monorepo

## Repository layout

```
apps/
  web/            Next.js app — client portal (/portal, /login, /register, ...)
                   and admin portal (/admin, /admin/login, ...)
  worker/         BullMQ worker (email delivery today) + Bull Board UI
packages/
  shared/         Env validation, Money (integer minor units), typed errors,
                   RBAC permission catalog, structured logging, audit taxonomy
  db/             Prisma schema, migrations, generated client, audit helpers
  auth/           Argon2id hashing, TOTP 2FA, AES-256-GCM at-rest encryption,
                   permission-check helpers (framework-agnostic)
  core/           Client/staff registration & auth, sessions, product catalog,
                   settings — the non-billing domain services
  billing/        Order/invoice state machines, sequential numbering, the
                   Phase-1 manual "mark paid" fallback
  notifications/  React Email templates + send adapter (Resend/SMTP)
  jobs/           BullMQ queue definitions + durable "queue with a DB record
                   first" producer helpers
  seed/           Development seed script (exercises the real domain
                   services, not raw inserts)
```

Domain logic lives in `packages/*`, never in React components or route
handlers — `apps/web` only wires sessions/permissions to those services and
renders UI.

## Getting started

Prerequisites: Node 22+, pnpm 10+, Docker (for Postgres/Redis locally).

```bash
pnpm install

# Copy the shared env file. Each app/worker process loads it via a
# .env.local symlink (see below) since Next.js and tsx only auto-load
# .env files from their own directory.
cp .env.example .env
# Fill in AUTH_SECRET and ENCRYPTION_KEY:
#   openssl rand -base64 48   -> AUTH_SECRET
#   openssl rand -base64 32   -> ENCRYPTION_KEY
ln -s ../../.env apps/web/.env.local
ln -s ../../.env apps/worker/.env.local

docker compose up -d postgres redis mailpit

pnpm db:generate
pnpm db:migrate       # applies migrations, prompts for a name on first run
pnpm db:seed          # creates a tenant, roles, staff, a demo client + order

pnpm dev              # runs apps/web (:3000) and apps/worker (:3001 Bull Board)
```

Seed credentials (change on first login — see console output after seeding):

| Role | Email | Password |
| --- | --- | --- |
| Super Admin | `admin@example.com` | `ChangeMe123!` (or `$SEED_ADMIN_PASSWORD`) |
| Support Staff | `support@example.com` | same |
| Billing Staff | `billing@example.com` | same |
| Client | `client@example.com` | `ChangeMe123!` (or `$SEED_CLIENT_PASSWORD`) |

Mailpit (catches outgoing dev email) is at http://localhost:8025. Bull Board
(queue monitoring) is at http://localhost:3001.

## Scripts

Run from the repo root (Turborepo fans these out to every package):

```bash
pnpm dev          # start web + worker in watch mode
pnpm build        # production build of every package
pnpm typecheck    # tsc --noEmit everywhere (apps/web also runs `next typegen` first)
pnpm lint         # eslint everywhere
pnpm test         # vitest unit tests everywhere
pnpm --filter @hostpanel/web test:e2e   # Playwright E2E (needs the dev stack running)
pnpm db:migrate   # prisma migrate dev
pnpm db:seed      # re-run the seed script (idempotent — upserts)
pnpm db:studio    # Prisma Studio
```

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) — design decisions, entity model, phase roadmap
- [SECURITY.md](./SECURITY.md) — auth, session, and data-protection model
- [ENVIRONMENT.md](./ENVIRONMENT.md) — full environment variable reference
- [API.md](./API.md), [DEPLOYMENT.md](./DEPLOYMENT.md), [DISASTER-RECOVERY.md](./DISASTER-RECOVERY.md) — scoped for later phases; current status noted in each
