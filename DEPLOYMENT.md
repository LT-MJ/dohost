# Deployment

**Status: local/dev deployment (Docker Compose) is complete and verified.**
A production deployment guide specific to any one hosting target
(Vercel, a VPS, Kubernetes, ...) is not written yet — this document covers
what's true regardless of target, and what production requires that isn't
optional.

## What has to run

Three independent processes, plus two managed services:

1. **`apps/web`** — the Next.js app (`pnpm --filter @hostpanel/web build`
   then `start`). Serves both the client portal and the admin portal.
2. **`apps/worker`** — the BullMQ worker (`pnpm --filter @hostpanel/worker build`
   then `node dist/index.js`). Must run continuously and independently of
   `apps/web` — emails (and every future job type: provisioning, registrar
   sync, dunning) are processed here, not inline in a request handler.
   Also serves the Bull Board UI on `BULL_BOARD_PORT` — put this behind
   auth/a private network in production; it has no auth of its own today.
3. **PostgreSQL** — run `pnpm --filter @hostpanel/db migrate:deploy`
   (not `migrate:dev`, which prompts interactively) as part of every
   deploy, before starting `apps/web`/`apps/worker` against the new schema.
4. **Redis** — BullMQ's backing store. No special configuration beyond
   `REDIS_URL` pointing at it.

## Before going to production

- Every variable in ENVIRONMENT.md must be a real secret from your
  platform's secret manager — never a committed `.env` file. The env
  validator (`packages/shared/src/config/env.ts`) enforces the
  production-only requirements (a real email provider configured) at
  startup; it does not and cannot enforce "these are actually secret."
- `AUTH_SECRET` / `ENCRYPTION_KEY` must be freshly generated for
  production, never reused from a dev/staging environment, and backed up
  somewhere durable outside the app's own database — see SECURITY.md on
  why rotating `ENCRYPTION_KEY` is destructive.
- Run `pnpm build && pnpm typecheck && pnpm lint && pnpm test` (all via
  Turborepo, so across every package) and the Playwright suite
  (`pnpm --filter @hostpanel/web test:e2e`) against a staging environment
  before promoting.
- Seed data (`pnpm db:seed`) is development tooling. Do not run it against
  production — it creates known-password accounts. Production's first
  Super Admin account should be created via a one-off script or a
  first-run setup flow, neither of which exists yet (currently, the only
  way to create the first staff account is the seed script or a direct
  database insert — a gap worth closing before a real production launch).

## Not yet built

- A first-run / initial-setup flow that replaces "run the seed script" for
  production.
- Health-check endpoints for `apps/web`/`apps/worker` suitable for a load
  balancer or orchestrator.
- Structured deploy automation (this repo has no CI/CD pipeline
  configuration yet).
- The system-health dashboard (Phase 6) that would otherwise surface
  queue/webhook/gateway/registrar errors post-deploy.
