import path from "node:path";
import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

// The monorepo keeps a single .env at the repository root; Prisma's CLI
// runs with this package as its cwd, so point dotenv there explicitly
// instead of relying on its default (which only looks in cwd).
config({ path: path.resolve(import.meta.dirname, "../../.env") });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
