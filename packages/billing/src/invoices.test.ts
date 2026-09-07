import { describe, expect, it } from "vitest";
import { INVOICE_TRANSITIONS, isValidInvoiceTransition } from "./invoices";

describe("invoice state machine", () => {
  it("allows the normal payable path", () => {
    expect(isValidInvoiceTransition("DRAFT", "ISSUED")).toBe(true);
    expect(isValidInvoiceTransition("ISSUED", "PARTIALLY_PAID")).toBe(true);
    expect(isValidInvoiceTransition("PARTIALLY_PAID", "PAID")).toBe(true);
  });

  it("allows an issued invoice to be paid in full directly", () => {
    expect(isValidInvoiceTransition("ISSUED", "PAID")).toBe(true);
  });

  it("never allows leaving PAID except to REFUNDED", () => {
    expect(INVOICE_TRANSITIONS.PAID).toEqual(["REFUNDED"]);
    expect(isValidInvoiceTransition("PAID", "ISSUED")).toBe(false);
    expect(isValidInvoiceTransition("PAID", "CANCELLED")).toBe(false);
  });

  it("never allows leaving a terminal state", () => {
    expect(INVOICE_TRANSITIONS.CANCELLED).toEqual([]);
    expect(INVOICE_TRANSITIONS.REFUNDED).toEqual([]);
  });

  it("rejects an invalid jump from draft straight to paid", () => {
    expect(isValidInvoiceTransition("DRAFT", "PAID")).toBe(false);
  });

  it("allows collections to resolve as paid or cancelled only", () => {
    expect(INVOICE_TRANSITIONS.COLLECTIONS).toEqual(["PAID", "CANCELLED"]);
  });
});
