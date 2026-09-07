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
    url: process.env.DATABASE_URL,
  },
});
