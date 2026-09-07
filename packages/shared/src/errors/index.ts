/**
 * Every error thrown by domain/service code should be (or wrap into) an
 * AppError with one of these categories, per the error-handling contract:
 * user-facing messages are safe and understandable, internal diagnostic
 * context is kept out of what gets sent to the client.
 */
export type ErrorCategory =
  | "validation"
  | "authentication"
  | "authorization"
  | "business_rule"
  | "integration"
  | "transient"
  | "infrastructure"
  | "concurrency"
  | "fraud"
  | "payment";

const DEFAULT_HTTP_STATUS: Record<ErrorCategory, number> = {
  validation: 400,
  authentication: 401,
  authorization: 403,
  business_rule: 422,
  integration: 502,
  transient: 503,
  infrastructure: 500,
  concurrency: 409,
  fraud: 403,
  payment: 402,
};

export interface AppErrorOptions {
  /** Machine-readable, stable error code, e.g. "invoice.already_paid". */
  code: string;
  /** Safe to show directly to the end user. Never include secrets or stack traces. */
  message: string;
  httpStatus?: number;
  cause?: unknown;
  /** Internal diagnostic context — logged, never returned in an API response body. */
  meta?: Record<string, unknown>;
}

export class AppError extends Error {
  readonly category: ErrorCategory;
  readonly code: string;
  readonly httpStatus: number;
  readonly meta?: Record<string, unknown>;

  constructor(category: ErrorCategory, options: AppErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = "AppError";
    this.category = category;
    this.code = options.code;
    this.httpStatus = options.httpStatus ?? DEFAULT_HTTP_STATUS[category];
    this.meta = options.meta;
  }
}

export class ValidationError extends AppError {
  constructor(options: AppErrorOptions) {
    super("validation", options);
    this.name = "ValidationError";
  }
}

export class AuthenticationError extends AppError {
  constructor(options: AppErrorOptions) {
    super("authentication", options);
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends AppError {
  constructor(options: AppErrorOptions) {
    super("authorization", options);
    this.name = "AuthorizationError";
  }
}

export class BusinessRuleError extends AppError {
  constructor(options: AppErrorOptions) {
    super("business_rule", options);
    this.name = "BusinessRuleError";
  }
}

export class IntegrationError extends AppError {
  constructor(options: AppErrorOptions) {
    super("integration", options);
    this.name = "IntegrationError";
  }
}

export class TransientError extends AppError {
  constructor(options: AppErrorOptions) {
    super("transient", options);
    this.name = "TransientError";
  }
}

export class InfrastructureError extends AppError {
  constructor(options: AppErrorOptions) {
    super("infrastructure", options);
    this.name = "InfrastructureError";
  }
}

export class ConcurrencyError extends AppError {
  constructor(options: AppErrorOptions) {
    super("concurrency", options);
    this.name = "ConcurrencyError";
  }
}

export class FraudError extends AppError {
  constructor(options: AppErrorOptions) {
    super("fraud", options);
    this.name = "FraudError";
  }
}

export class PaymentError extends AppError {
  constructor(options: AppErrorOptions) {
    super("payment", options);
    this.name = "PaymentError";
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/** Shape safe to serialize directly into an API response body. */
export interface SafeErrorPayload {
  error: {
    code: string;
    message: string;
    category: ErrorCategory;
    requestId?: string;
  };
}

/**
 * Convert any thrown value into a payload safe to send to a client. Unknown
 * (non-AppError) errors are collapsed into a generic message — the original
 * error should still be logged with full context by the caller.
 */
export function toSafeErrorPayload(error: unknown, requestId?: string): SafeErrorPayload {
  if (isAppError(error)) {
    return {
      error: { code: error.code, message: error.message, category: error.category, requestId },
    };
  }
  return {
    error: {
      code: "internal_error",
      message: "An unexpected error occurred. Please try again or contact support.",
      category: "infrastructure",
      requestId,
    },
  };
}
