import { describe, expect, it } from "vitest";
import { isValidOrderTransition, ORDER_TRANSITIONS } from "./orders";

describe("order state machine", () => {
  it("allows the normal happy path", () => {
    expect(isValidOrderTransition("PENDING", "AWAITING_PAYMENT")).toBe(true);
    expect(isValidOrderTransition("AWAITING_PAYMENT", "PAID")).toBe(true);
    expect(isValidOrderTransition("PAID", "PROCESSING")).toBe(true);
    expect(isValidOrderTransition("PROCESSING", "ACTIVE")).toBe(true);
  });

  it("rejects skipping straight to a terminal state", () => {
    expect(isValidOrderTransition("PENDING", "ACTIVE")).toBe(false);
    expect(isValidOrderTransition("PENDING", "PAID")).toBe(false);
  });

  it("never allows leaving a terminal state", () => {
    for (const terminal of ["CANCELLED", "FRAUD", "REFUNDED"] as const) {
      expect(ORDER_TRANSITIONS[terminal]).toEqual([]);
    }
  });

  it("rejects moving backwards from a later state to an earlier one", () => {
    expect(isValidOrderTransition("PAID", "PENDING")).toBe(false);
    expect(isValidOrderTransition("ACTIVE", "AWAITING_PAYMENT")).toBe(false);
  });

  it("allows recovering a failed order back into the payment flow", () => {
    expect(isValidOrderTransition("FAILED", "AWAITING_PAYMENT")).toBe(true);
    expect(isValidOrderTransition("FAILED", "CANCELLED")).toBe(true);
  });
});
