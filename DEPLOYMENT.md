# Deployment

**Status: local/dev deployment (Docker Compose) is complete and verified.**
A production deployment guide specific to any one hosting target
(Vercel, a VPS, Kubernetes, ...) is not written yet — this document covers
what's true regardless of target, and what production requires that isn't
optional.

## Vercel (`apps/web` only — partial)

This repo is git-linked to a Vercel project for `apps/web`. Two things to
know before treating "deployed to Vercel" as "the system is running":

- **The build itself needed a fix.** `packages/db` produces its Prisma
  Client via a gitignored codegen step (`prisma generate`) that was never
  wired into any build pipeline — only ever run manually
  (`pnpm db:generate`). `apps/web`'s build imports that generated module,
  so Vercel's build failed with `Module not found`. Fixed by giving
  `packages/db` a `"build": "prisma generate"` script (so Turborepo's
  `dependsOn: ["^build"]` graph runs it before `apps/web` builds) and by
  changing `prisma.config.ts`'s datasource `url` from prisma/config's
  `env()` helper (throws at config-*load* time if unset) to plain
  `process.env.DATABASE_URL` (`generate` never opens a connection, so it
  shouldn't require one to run — only `migrate`/`studio`/`db seed` do, and
  those still fail with a clear Prisma CLI error when it's genuinely
  unset). `typecheck`/`lint`/`test` needed the same same-package `"build"`
  added to their own `dependsOn` in `turbo.json`, since `^build` only
  covers a package's *upstream* dependencies, not its own build task.
  A second, sneakier version of the same bug followed: `packages/db`'s
  `build` task had no `outputs` declared, so it silently inherited the
  root task config's `[".next/**", "dist/**"]` — neither of which matches
  what `prisma generate` actually writes (`generated/**`). The first
  deployment worked anyway (a cache *miss* runs the command for real,
  and `apps/web`'s build reads the file moments later from the same
  build container's disk regardless of what got cached). A *later*
  deployment, where nothing under `packages/db` had changed, got a cache
  *hit* — Turborepo correctly skipped re-running `prisma generate` but,
  since the real output was never a declared `outputs` pattern, had
  nothing to restore either, so `generated/prisma/client` simply didn't
  exist and `apps/web`'s build failed the same `Module not found` way.
  Fixed with a package-level `packages/db/turbo.json` (Turborepo's
  "Package Configurations" feature) declaring `outputs: ["generated/**"]`
  for that package's `build` task specifically, verified by forcing the
  exact failure locally (delete `packages/db/generated`, rebuild, confirm
  Turborepo reports a cache hit *and* the file is actually restored to
  disk before trusting it against real Vercel builds again).
- **`apps/worker` cannot run on Vercel at all.** It's a persistent BullMQ
  worker process (see "What has to run" above) — Vercel's platform is
  serverless request/response functions, not long-running processes. Every
  transactional email (verification, password reset, staff invites, and
  every future job type) is processed there, not inline in a request
  handler. A Vercel deployment of `apps/web` alone will accept requests
  but never actually send email until `apps/worker` also runs somewhere
  that supports persistent processes (a VPS, a container platform, etc.).
- **Production environment variables are a deployment-by-deployment
  responsibility.** The build succeeding doesn't mean the app boots — see
  "Before going to production" above; `packages/shared/src/config/env.ts`
  fails startup immediately, with a specific message, if a required
  variable is missing. Configure them as real Vercel project environment
  variables (not a committed `.env`), never reuse a dev/staging
  `AUTH_SECRET`/`ENCRYPTION_KEY`. **Adding or changing a variable does not
  affect existing deployments** — Vercel injects the project's current
  variables at deploy time, not on every request, so an already-built
  deployment keeps running with whatever was configured when it was
  built. Trigger a fresh deployment afterward (dashboard: Deployments →
  the deployment → Redeploy; or push a new commit, which the git
  integration auto-deploys) for a variable change to take effect.
  There's no Vercel API/MCP action that reads or writes a project's
  environment variables, or that redeploys an existing deployment
  without either a new commit or re-uploading the entire source tree as
  a one-off file-based deployment — both env var changes and forcing a
  redeploy of already-pushed code currently require the dashboard.
  A few of these required variables (`REDIS_URL`, and `RESEND_API_KEY`/
  `SMTP_HOST`/`SMTP_PORT` depending on `EMAIL_PROVIDER`) are validated
  for presence only, not for actually working — see ENVIRONMENT.md — so
  a placeholder unblocks startup without meaning that functionality
  works; don't mistake "the app boots" for "email sends."
- **Connecting to Supabase's Postgres pooler over `@prisma/adapter-pg`
  needs an explicit SSL mode.** Without one, `pg` attempts full
  certificate-chain verification against the pooler's endpoint and fails
  with `P1011: Error opening a TLS connection: self-signed certificate
  in certificate chain` — a known quirk of connecting a generic `pg`
  client to Supabase's pgbouncer, not a bug in this codebase. Append
  `&uselibpqcompat=true&sslmode=require` to `DATABASE_URL`'s query
  string (still encrypted, just not validated against a public CA —
  `pg`'s own runtime warning is what names this exact parameter
  combination; without `uselibpqcompat=true`, `sslmode=require` is
  currently aliased to `verify-full` and fails the same way).

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

## First production admin account

`/admin/setup` creates the tenant (if missing) and a single `super_admin`
StaffUser with a password you choose directly in the form — it replaces
running the seed script (which creates known dev passwords) or a manual
database insert. It works exactly once: the moment any StaffUser exists
for the tenant, it refuses outright and just links to `/admin/login`
instead of rendering the form. There's no separate token gating it —
its safety is that narrow, self-closing window, not a secret — so use it
immediately after your first successful production deploy, before
sharing the URL with anyone else.

## Not yet built

- Health-check endpoints for `apps/web`/`apps/worker` suitable for a load
  balancer or orchestrator.
- Structured deploy automation (this repo has no CI/CD pipeline
  configuration yet).
- The system-health dashboard (Phase 6) that would otherwise surface
  queue/webhook/gateway/registrar errors post-deploy.
