import { describe, expect, it } from "vitest";
import {
  add,
  allocate,
  fromDecimalString,
  MoneyError,
  money,
  multiply,
  percentageBps,
  subtract,
  toDecimalString,
} from "./index";

describe("money", () => {
  it("rejects non-integer amounts", () => {
    expect(() => money(19.99, "USD")).toThrow(MoneyError);
  });

  it("rejects currency mismatches", () => {
    expect(() => add(money(100, "USD"), money(100, "EUR"))).toThrow(MoneyError);
  });

  it("adds and subtracts in minor units", () => {
    expect(add(money(500, "USD"), money(250, "USD"))).toEqual(money(750, "USD"));
    expect(subtract(money(500, "USD"), money(250, "USD"))).toEqual(money(250, "USD"));
  });

  it("multiplies by an integer quantity only", () => {
    expect(multiply(money(500, "USD"), 3)).toEqual(money(1500, "USD"));
    expect(() => multiply(money(500, "USD"), 1.5)).toThrow(MoneyError);
  });

  it("computes percentages via integer basis points", () => {
    // 8.25% of $19.99 (1999 cents) = 164.9175 -> rounds to 165 cents
    expect(percentageBps(money(1999, "USD"), 825)).toEqual(money(165, "USD"));
  });

  it("allocates a total across ratios without losing or inventing cents", () => {
    const shares = allocate(money(100, "USD"), [1, 1, 1]);
    expect(shares).toEqual([money(34, "USD"), money(33, "USD"), money(33, "USD")]);
    const total = shares.reduce((s, m) => s + m.amount, 0);
    expect(total).toBe(100);
  });

  it("parses and formats decimal strings per currency minor-unit digits", () => {
    expect(fromDecimalString("19.99", "USD")).toEqual(money(1999, "USD"));
    expect(toDecimalString(money(1999, "USD"))).toBe("19.99");
    // JPY has 0 minor-unit digits
    expect(fromDecimalString("500", "JPY")).toEqual(money(500, "JPY"));
    expect(toDecimalString(money(500, "JPY"))).toBe("500");
  });

  it("rejects malformed decimal input", () => {
    expect(() => fromDecimalString("abc", "USD")).toThrow(MoneyError);
  });
});
