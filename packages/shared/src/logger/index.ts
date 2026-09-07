import pino from "pino";

/**
 * Fields redacted from all log output regardless of call site. This is a
 * safety net, not a substitute for simply not logging secrets — never pass
 * a password, token, or credential object to the logger in the first
 * place.
 */
const REDACT_PATHS = [
  "password",
  "*.password",
  "newPassword",
  "*.newPassword",
  "currentPassword",
  "*.currentPassword",
  "passwordHash",
  "*.passwordHash",
  "token",
  "*.token",
  "accessToken",
  "*.accessToken",
  "refreshToken",
  "*.refreshToken",
  "sessionToken",
  "*.sessionToken",
  "secret",
  "*.secret",
  "apiKey",
  "*.apiKey",
  "apiSecret",
  "*.apiSecret",
  "cardNumber",
  "*.cardNumber",
  "cvv",
  "*.cvv",
  "twoFactorSecret",
  "*.twoFactorSecret",
  "recoveryCodes",
  "*.recoveryCodes",
  "eppCode",
  "*.eppCode",
  "authCode",
  "*.authCode",
  "req.headers.authorization",
  "req.headers.cookie",
];

export interface Logger {
  trace: pino.LogFn;
  debug: pino.LogFn;
  info: pino.LogFn;
  warn: pino.LogFn;
  error: pino.LogFn;
  fatal: pino.LogFn;
  child: (bindings: Record<string, unknown>) => Logger;
}

export function createLogger(name: string): Logger {
  return pino({
    name,
    level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug"),
    redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

export const logger = createLogger("hostpanel");
