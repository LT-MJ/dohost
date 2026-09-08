import path from "node:path";
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// The monorepo keeps a single .env at the repository root; Prisma's CLI
// runs with this package as its cwd, so point dotenv there explicitly
// instead of relying on its default (which only looks in cwd).
config({ path: path.resolve(import.meta.dirname, "../../.env") });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // Lives in packages/seed, not this package: the seed script needs the
    // domain services (@hostpanel/core, @hostpanel/billing), which
    // themselves depend on @hostpanel/db — keeping seed.ts here would make
    // this package depend on its own dependents, a real cycle that breaks
    // Turborepo's task graph (pnpm tolerates it, Turborepo does not).
    seed: "tsx ../seed/src/seed.ts",
  },
  datasource: {
    // Deliberately not prisma/config's `env()` helper: it throws at config
    // *load* time if the variable is unresolvable, before Prisma even knows
    // which subcommand is running. `generate` never opens a connection and
    // has no real DATABASE_URL requirement (a CI/build step should be able
    // to run it with no database configured at all) — only `migrate`/`studio`/
    // `db seed` actually need one, and they already fail with a clear,
    // actionable error from the Prisma CLI itself when `url` is undefined.
    //
    // DIRECT_URL (optional) takes priority when set: `migrate deploy` needs
    // to hold an advisory lock for the duration of the command, which a
    // transaction-mode connection pooler (e.g. Supabase's pgbouncer on
    // port 6543) doesn't support — every statement can land on a different
    // underlying connection, so the lock silently never resolves and the
    // command just hangs. The running app is unaffected either way: this
    // config file only feeds the Prisma CLI (generate/migrate/studio/db
    // seed), never the app's own PrismaClient, which builds its own
    // connection straight from DATABASE_URL in src/client.ts. Point
    // DIRECT_URL at the non-pooled connection string (Supabase: port 5432,
    // no `pgbouncer=true`) and leave DATABASE_URL as the pooled one the app
    // should keep using at runtime.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
});
