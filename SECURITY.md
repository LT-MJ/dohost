# Security

This describes what Phase 1 actually implements. Where something is a known
gap rather than a finished control, it's labeled as such — see "Known gaps"
at the end rather than assuming silence means it's handled.

## Passwords

Argon2id via `@node-rs/argon2` (`packages/auth/src/password.ts`), OWASP
baseline parameters for a server-side auth path: 19 MiB memory cost, 2 time
cost, 1 degree of parallelism. Never lower these to make login "feel
faster" — scale the auth service instead. Passwords are never logged (see
"Logging" below) and never transmitted anywhere except the login form
submission itself.

Staff accounts are created with an unusable random placeholder hash
(`generateToken(32)` hashed through the same Argon2id path) and
`mustChangePassword: true`; the only way to actually activate one is the
emailed set-password link (`PasswordResetToken`, single-use, 24h expiry).
There is no scenario where a staff account is both freshly created and
loggable-into with a guessable password.

## Two-factor authentication

TOTP via `otplib` (`packages/auth/src/totp.ts`) — standard 30-second,
6-digit codes compatible with any authenticator app. The secret is only
persisted once the user proves possession by submitting a valid code during
enrollment (`confirmStaff2FAEnrollment`); an abandoned enrollment never
leaves a usable-but-unconfirmed secret at rest. Eight single-use recovery
codes are generated at enrollment and stored as SHA-256 hashes, never
plaintext, never shown again after generation.

**At rest, the TOTP secret is encrypted**, not just hashed (unlike a
password, it must be recoverable to verify a code) — AES-256-GCM via
`packages/auth/src/crypto.ts`, keyed by `ENCRYPTION_KEY`. Losing that key
means every enrolled 2FA secret becomes unrecoverable (a deliberate
tradeoff: the alternative is a weaker at-rest guarantee).

`STAFF_REQUIRE_2FA` exists in the environment schema for a future
"mandatory 2FA for staff" policy; enforcement of it is not wired up yet.

## Sessions

Session tokens are high-entropy random values (`generateToken(32)`,
`crypto.randomBytes`), never sequential or predictable. Only a SHA-256 hash
of the token is stored (`StaffSession.tokenHash` / `ClientSession.tokenHash`,
both unique-indexed) — a database read does not hand out a usable session
token. The JWT cookie (httpOnly, Auth.js defaults: `secure` in production,
`sameSite: lax`) carries only the raw token plus `actorType`; every request
re-validates that token against the DB row and re-reads current RBAC
permissions fresh (see ARCHITECTURE.md's "Identity, sessions, and RBAC") —
a revoked session or a permission change takes effect on the very next
request, not at next login.

Login attempts (success and failure) are logged to the append-only
`LoginEvent` table with actor type, email, IP, user agent, and — on
failure — a reason code. Five failed attempts for the same
`(tenant, actorType, email)` within 15 minutes locks that account out for 15
minutes (`packages/core/src/login-guard.ts`), independent of source IP (an
attacker rotating IPs doesn't bypass the lock; a shared-NAT office doesn't
get punished for one user's typos, since the lock is keyed by email, not
IP).

## Encryption & secrets

- `ENCRYPTION_KEY` (32 bytes, base64) — AES-256-GCM for at-rest secrets
  (today: TOTP secrets; the same helper is intended for registrar
  EPP/auth codes and provisioning credentials in later phases).
- `AUTH_SECRET` (32+ bytes, base64) — signs the session JWT (Auth.js).
- Neither is ever logged, checked into source control, or has a default
  value — `packages/shared/src/config/env.ts` fails application startup
  with a specific, actionable message if either is missing or too short.
  See ENVIRONMENT.md for how to generate them.
- No third-party API credentials exist yet (Phase 1 has no payment
  gateway, registrar, or control-panel integration configured) — the env
  schema has placeholders for them, all optional, all unused until the
  business chooses concrete providers.

## Authorization (RBAC)

`packages/shared/src/permissions` is the single source of truth for
permission strings (`clients.read`, `invoices.write`, ...) and default
role→permission grants. Every domain-service function that performs a
staff-privileged action calls `requirePermission(actor, PERMISSION)`
(`packages/auth/src/rbac.ts`) as its first line — never an
`if (user.role === "admin")` check scattered through route/UI code. A
denied check throws `AuthorizationError` with a generic, safe message (no
information about which specific permission or resource was involved beyond
what the user already knew). `apps/web` pages additionally hide
write-action UI (buttons/forms) for actors lacking the permission, but that
is UX only — the enforcement is the domain-service check, verified in this
repo's E2E suite by a support-staff account being denied `/admin/audit`
server-side, not just having the link hidden.

Client contacts (`ClientContact`) have a simpler boolean-flag model
(`billing`/`support`/`domains`/`services`) rather than the full RBAC
catalog — appropriate for "can this sub-user see billing," not staff-grade
granularity. Ownership checks (a client can only act on their own
`clientId`) are enforced in the domain services themselves (e.g.
`createOrder`, `updateClientProfile`), not just at the route layer.

## Audit logging

See ARCHITECTURE.md. Append-only by convention (no code path calls
`auditLog.update`/`.delete`), records actor/action/entity/before/after/
reason/IP/user-agent, and survives the referenced actor account being
deleted (plain string `actorId`, not a foreign key).

## Input validation & injection

- All database access goes through Prisma's typed query builder — no raw
  SQL string interpolation exists in this codebase.
- Form inputs are validated server-side (Zod schemas in
  `apps/web/src/lib/actions/*`, plus domain-service-level checks) before
  any database write; client-side `required`/`minLength` attributes are
  UX only.
- React (both React DOM and the Server Component model) escapes rendered
  output by default — no `dangerouslySetInnerHTML` is used anywhere in
  this codebase.

## Logging

`packages/shared/src/logger` (pino) redacts a fixed list of field names
(`password`, `token`, `secret`, `apiKey`, `cardNumber`, `cvv`,
`twoFactorSecret`, `recoveryCodes`, `eppCode`, `authCode`, and `*.`-prefixed
variants for nested objects, plus `Authorization`/`Cookie` headers)
regardless of call site, as a safety net — but the actual rule is simpler
and comes first: never pass a secret to the logger to begin with.

## Known gaps (not yet implemented — tracked, not hidden)

- **CSRF**: Auth.js's built-in CSRF protection covers its own sign-in
  flow; custom server actions rely on Next.js's own
  same-origin-by-default POST handling rather than an explicit
  additional CSRF token. Worth a dedicated review once the API platform
  (Phase 6, cross-origin by design) exists.
- **Rate limiting** exists only for login attempts (the lockout above).
  Registration, password-reset requests, and other unauthenticated
  endpoints have no dedicated rate limit yet — a real gap for abuse
  resistance.
- **Security headers / CSP**: not yet configured in `next.config.ts`.
- **Secret rotation**: no automated rotation for `AUTH_SECRET` /
  `ENCRYPTION_KEY` (rotating `ENCRYPTION_KEY` today would strand every
  encrypted TOTP secret — a re-encryption migration path doesn't exist
  yet).
- **File uploads**: no file-upload surface exists yet (ticket
  attachments, KB assets are Phase 5) — the "never store uploads in the
  public webroot" / malware-scanning / signed-URL requirements apply once
  that's built, not before.
- **Webhook signature verification**: no outgoing or incoming webhooks
  exist yet (Phase 2 payment webhooks, Phase 6 outgoing webhooks) — the
  verify-authenticity-before-trusting requirement applies when those
  land.

These are Phase 7 ("Hardening") scope per the roadmap, not oversights to
be quietly patched around — flagging them here is the point.
