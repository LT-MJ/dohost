# Disaster recovery

**Status: not implemented.** There is no automated backup job, no tested
restore procedure, and no defined RPO/RTO yet — this is Phase 7
("Hardening") scope per ARCHITECTURE.md's roadmap. Writing this document
now, honestly reflecting that gap, is preferable to staying silent about it
or claiming a procedure exists that hasn't been tested — per the product
spec's own principle: "Never consider a backup successful merely because
the backup process returned exit code 0."

## What data matters (for when this is built)

- **PostgreSQL** is the system of record for everything: clients, orders,
  invoices, audit logs, sessions. Losing it loses the business's financial
  history. This is the primary backup target.
- **Redis** holds only in-flight job queue state (email sends today; more
  job types in later phases). Losing it loses in-progress jobs, not
  historical record — `EmailLog` rows already persist the durable "did
  this send" answer independent of Redis (see ARCHITECTURE.md's
  background-jobs section). Redis does not need the same backup rigor as
  Postgres, but a queue-draining/reconciliation step after a Redis loss
  will eventually be worth having (Phase 6's reconciliation engine).
- **Object storage** (Phase 5+, ticket attachments/KB assets) will need
  its own retention policy once it exists — most S3-compatible providers
  offer versioning/cross-region replication at the bucket level, which is
  likely sufficient rather than a custom backup job.

## Minimum viable plan (not yet implemented)

1. Automated, encrypted `pg_dump` (or continuous WAL archiving for
   point-in-time recovery) on a schedule, stored off-site from the
   database host.
2. A retention policy distinguishing "recent backups for operational
   restore" from "long-term retention for financial/legal record" —
   audit logs and invoices in particular should never be purged by a
   generic retention job; see the product spec's section 61 on data
   retention.
3. A **tested** restore procedure — actually restoring a backup into a
   scratch environment and verifying the application boots against it —
   run on a schedule, not just written down and assumed to work.
4. Documented RPO (how much data loss is acceptable — likely near-zero
   for a billing system, arguing for WAL archiving over periodic dumps)
   and RTO (how long a restore is allowed to take) once the business
   defines its own tolerance; these are business decisions, not ones to
   invent here.
5. An emergency-access procedure (who can trigger a restore, how staff
   authenticate if the primary auth path is part of what's down).

## In the meantime

If you deploy this today, you are responsible for your own backup strategy
until this document reflects a real, tested one. At minimum, don't run it
against a Postgres instance that isn't already covered by your
infrastructure provider's own backup product.
