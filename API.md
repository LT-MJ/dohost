# API

**Status: not implemented.** A versioned public REST API (`/api/v1/...`)
with API-key authentication, per-key permissions, rate limiting, pagination,
filtering, an OpenAPI spec, and outgoing webhooks is Phase 6 scope (see
ARCHITECTURE.md's roadmap) — after billing, domains, provisioning, and
support exist to have something worth exposing.

## What exists today

`apps/web/src/app/api/auth/[...nextauth]/route.ts` — the Auth.js
credentials handler. It is not a public API surface; it exists solely to
back the login forms and is not intended for external consumption.

## Planned shape (not yet built)

When Phase 6 lands, expect:

- `ApiKey` model: hashed key storage (never plaintext at rest, matching
  the password/session pattern already established), scoped permissions
  reusing the same `PERMISSIONS` catalog as staff RBAC
  (`packages/shared/src/permissions`), per-key rate limits.
- Route handlers under `apps/web/src/app/api/v1/*`, each starting with an
  API-key authentication + permission check mirroring
  `requirePermission()` — no new, parallel authorization model.
- Responses as DTOs, never raw Prisma model shapes — the same
  "don't expose internal database structures directly" rule the product
  spec states for the internal API, so consumers aren't coupled to
  migration-driven column names.
- `WebhookEvent` / `WebhookDelivery` for outgoing webhooks (signed payload,
  event ID, retry policy, delivery history) — same durable-job pattern as
  the existing email queue (`packages/jobs`), not a fire-and-forget
  `fetch()`.
- An OpenAPI spec generated from (or validated against) the actual route
  handlers, not hand-maintained separately from the implementation.

If you're building an integration against this repo before Phase 6 lands,
the honest answer is: there isn't a public API yet. Use the domain
services in `packages/core` / `packages/billing` directly if you're
extending the app itself.
