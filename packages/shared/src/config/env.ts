import { z } from "zod";

/**
 * Typed environment configuration layer.
 *
 * Every module in the codebase that needs a secret or external endpoint
 * should import `getEnv()` from here rather than reading `process.env`
 * directly. This is the single place that decides what is required, what
 * is optional, and what "required" means per environment — so a missing
 * production secret fails loudly at startup instead of surfacing as a
 * mysterious runtime error later.
 */

const boolFromString = z
  .union([z.literal("true"), z.literal("false"), z.literal(""), z.undefined()])
  .transform((v) => v === "true");

const baseSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  APP_URL: z.string().url("APP_URL must be a valid absolute URL"),
  APP_NAME: z.string().min(1).default("HostPanel"),
  DEFAULT_TENANT_SLUG: z.string().min(1).default("default"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),
  BULL_BOARD_PORT: z.coerce.number().int().optional().default(3001),

  AUTH_SECRET: z
    .string()
    .min(32, "AUTH_SECRET must be at least 32 characters (openssl rand -base64 48)"),
  ENCRYPTION_KEY: z.string().min(1, "ENCRYPTION_KEY is required"),
  STAFF_REQUIRE_2FA: z.string().optional().default(""),

  EMAIL_PROVIDER: z.enum(["resend", "smtp"]).default("smtp"),
  EMAIL_FROM: z.string().min(1, "EMAIL_FROM is required"),
  RESEND_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_SECURE: boolFromString.optional(),

  STORAGE_ENDPOINT: z.string().optional(),
  STORAGE_REGION: z.string().optional().default("auto"),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_ACCESS_KEY_ID: z.string().optional(),
  STORAGE_SECRET_ACCESS_KEY: z.string().optional(),
  STORAGE_FORCE_PATH_STYLE: boolFromString.optional(),

  SENTRY_DSN: z.string().optional(),
  SENTRY_ENVIRONMENT: z.string().optional(),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  PAYPAL_CLIENT_ID: z.string().optional(),
  PAYPAL_CLIENT_SECRET: z.string().optional(),
  PAYPAL_WEBHOOK_ID: z.string().optional(),

  REGISTRAR_PROVIDER: z.enum(["manual"]).default("manual"),
  REGISTRAR_API_KEY: z.string().optional(),
  REGISTRAR_API_SECRET: z.string().optional(),
  REGISTRAR_SANDBOX: boolFromString.optional(),

  PROVISIONING_DEFAULT_DRIVER: z.enum(["manual", "cpanel"]).default("manual"),
});

export type Env = z.infer<typeof baseSchema>;

export class EnvConfigError extends Error {
  constructor(issues: string[]) {
    super(
      `Invalid or missing environment configuration:\n${issues.map((i) => `  - ${i}`).join("\n")}\n\nSee .env.example and ENVIRONMENT.md for the full list of variables.`,
    );
    this.name = "EnvConfigError";
  }
}

function validateProductionRequirements(env: Env): string[] {
  const issues: string[] = [];
  if (env.NODE_ENV !== "production") return issues;

  if (env.EMAIL_PROVIDER === "resend" && !env.RESEND_API_KEY) {
    issues.push("RESEND_API_KEY is required in production when EMAIL_PROVIDER=resend");
  }
  if (env.EMAIL_PROVIDER === "smtp" && (!env.SMTP_HOST || !env.SMTP_PORT)) {
    issues.push("SMTP_HOST and SMTP_PORT are required in production when EMAIL_PROVIDER=smtp");
  }
  if (!env.SENTRY_DSN) {
    // Error tracking is a strong operational requirement in production but
    // must not block a fresh deployment from booting; downgrade to a console
    // warning at call sites instead of failing here.
  }
  return issues;
}

let cached: Env | undefined;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = baseSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new EnvConfigError(issues);
  }

  const productionIssues = validateProductionRequirements(result.data);
  if (productionIssues.length > 0) {
    throw new EnvConfigError(productionIssues);
  }

  return result.data;
}

/** Cached, validated environment. Throws EnvConfigError on first access if invalid. */
export function getEnv(): Env {
  cached ??= loadEnv();
  return cached;
}

/** Test-only helper to force re-validation with a different process.env shape. */
export function __resetEnvCacheForTests(): void {
  cached = undefined;
}
