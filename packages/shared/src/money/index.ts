/**
 * Money handling: integer minor units only, never floating point.
 *
 * All monetary amounts in the system are represented as `Money { amount,
 * currency }` where `amount` is a whole number of minor units (e.g. cents
 * for USD). Every arithmetic operation here validates its inputs are
 * integers and that currencies match, so a float or a currency mismatch
 * fails loudly at the point of the mistake rather than silently corrupting
 * a ledger entry three calls later.
 */

export type CurrencyCode = string;

export interface Money {
  readonly amount: number;
  readonly currency: CurrencyCode;
}

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}

/** ISO 4217 currencies whose minor unit is not 2 decimal digits. */
const MINOR_UNIT_DIGITS: Record<string, number> = {
  BIF: 0,
  CLP: 0,
  DJF: 0,
  GNF: 0,
  JPY: 0,
  KMF: 0,
  KRW: 0,
  MGA: 0,
  PYG: 0,
  RWF: 0,
  UGX: 0,
  VND: 0,
  VUV: 0,
  XAF: 0,
  XOF: 0,
  XPF: 0,
  BHD: 3,
  IQD: 3,
  JOD: 3,
  KWD: 3,
  LYD: 3,
  OMR: 3,
  TND: 3,
};

export function minorUnitDigits(currency: CurrencyCode): number {
  return MINOR_UNIT_DIGITS[currency.toUpperCase()] ?? 2;
}

function assertInteger(n: number, label = "amount"): void {
  if (!Number.isInteger(n)) {
    throw new MoneyError(`${label} must be an integer minor-unit value, got ${n}`);
  }
}

export function money(amount: number, currency: CurrencyCode): Money {
  assertInteger(amount);
  if (!/^[A-Za-z]{3}$/.test(currency)) {
    throw new MoneyError(`Invalid ISO 4217 currency code: ${currency}`);
  }
  return { amount, currency: currency.toUpperCase() };
}

export function zero(currency: CurrencyCode): Money {
  return money(0, currency);
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new MoneyError(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  }
}

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amount + b.amount, a.currency);
}

export function subtract(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amount - b.amount, a.currency);
}

/** Multiply by an integer quantity (e.g. line-item quantity). */
export function multiply(a: Money, quantity: number): Money {
  assertInteger(quantity, "quantity");
  return money(a.amount * quantity, a.currency);
}

/**
 * Apply a percentage expressed as integer basis points (1/100 of a
 * percent), e.g. 1000 bps = 10.00%. Rounds to the nearest minor unit.
 * Never accepts a floating-point percentage, which would reintroduce
 * float error at the call site.
 */
export function percentageBps(a: Money, bps: number): Money {
  if (!Number.isInteger(bps) || bps < 0) {
    throw new MoneyError(`bps must be a non-negative integer, got ${bps}`);
  }
  return money(Math.round((a.amount * bps) / 10000), a.currency);
}

export function isZero(a: Money): boolean {
  return a.amount === 0;
}

export function isNegative(a: Money): boolean {
  return a.amount < 0;
}

export function isPositive(a: Money): boolean {
  return a.amount > 0;
}

export function negate(a: Money): Money {
  return money(-a.amount, a.currency);
}

export function compare(a: Money, b: Money): -1 | 0 | 1 {
  assertSameCurrency(a, b);
  if (a.amount === b.amount) return 0;
  return a.amount > b.amount ? 1 : -1;
}

export function max(a: Money, b: Money): Money {
  return compare(a, b) >= 0 ? a : b;
}

export function min(a: Money, b: Money): Money {
  return compare(a, b) <= 0 ? a : b;
}

export function sum(currency: CurrencyCode, items: readonly Money[]): Money {
  return items.reduce((acc, m) => add(acc, m), zero(currency));
}

/**
 * Split `total` into `ratios.length` integer shares that sum back exactly
 * to `total.amount` (no lost or invented pennies), distributing the
 * remainder deterministically to the earliest shares. Used for prorations,
 * tax component splits, and payment allocation across multiple invoices.
 */
export function allocate(total: Money, ratios: readonly number[]): Money[] {
  if (ratios.length === 0) {
    throw new MoneyError("allocate() requires at least one ratio");
  }
  if (ratios.some((r) => !Number.isInteger(r) || r < 0)) {
    throw new MoneyError("allocate() ratios must be non-negative integers");
  }
  const ratioSum = ratios.reduce((s, r) => s + r, 0);
  if (ratioSum === 0) {
    throw new MoneyError("allocate() ratios must not all be zero");
  }

  const sign = total.amount < 0 ? -1 : 1;
  const totalAbs = Math.abs(total.amount);
  const shares: number[] = [];
  let allocated = 0;
  for (const ratio of ratios) {
    const share = Math.floor((totalAbs * ratio) / ratioSum);
    shares.push(share);
    allocated += share;
  }
  let remainder = totalAbs - allocated;
  for (let i = 0; remainder > 0; i = (i + 1) % shares.length) {
    shares[i] = (shares[i] ?? 0) + 1;
    remainder -= 1;
  }
  return shares.map((s) => money(s * sign, total.currency));
}

/**
 * Parse a human-entered decimal string (e.g. "19.99") into integer minor
 * units for the given currency. This is the one place a single rounding
 * step is acceptable: converting user input into the canonical integer
 * representation at the system boundary.
 */
export function fromDecimalString(value: string, currency: CurrencyCode): Money {
  const trimmed = value.trim();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    throw new MoneyError(`Invalid decimal amount: "${value}"`);
  }
  const digits = minorUnitDigits(currency);
  const factor = 10 ** digits;
  const amount = Math.round(Number.parseFloat(trimmed) * factor);
  return money(amount, currency);
}

export function toDecimalString(m: Money): string {
  const digits = minorUnitDigits(m.currency);
  const factor = 10 ** digits;
  return (m.amount / factor).toFixed(digits);
}

const formatterCache = new Map<string, Intl.NumberFormat>();

export function format(m: Money, locale = "en-US"): string {
  const key = `${locale}:${m.currency}`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { style: "currency", currency: m.currency });
    formatterCache.set(key, formatter);
  }
  const digits = minorUnitDigits(m.currency);
  return formatter.format(m.amount / 10 ** digits);
}
