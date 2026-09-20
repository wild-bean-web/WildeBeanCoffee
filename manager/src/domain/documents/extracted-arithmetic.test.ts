import { describe, expect, it } from "vitest";

import {
  validateInvoiceArithmetic,
  validateReceiptArithmetic,
} from "./arithmetic";
import {
  ExtractedDocumentSchema,
  ExtractedInvoiceSchema,
  ExtractedReceiptSchema,
} from "./extracted";

function makeInvoice(overrides: Record<string, unknown> = {}) {
  return ExtractedInvoiceSchema.parse({
    schemaVersion: 1,
    documentType: "invoice",
    vendor: { name: "North Shore Foods", taxId: "CA-123" },
    invoiceNumber: "INV-1001",
    issuedDate: "2026-09-15",
    currency: "CAD",
    lines: [
      {
        sourceLineId: "line-1",
        description: "Coffee beans",
        vendorSku: "BEAN-1KG",
        quantity: "2.500",
        pack: { quantity: "1.000", unit: "kg" },
        unitPriceCents: 400,
        lineSubtotalCents: 1_000,
      },
    ],
    subtotalCents: 1_000,
    discountCents: 0,
    shippingCents: 0,
    taxCents: 75,
    totalCents: 1_075,
    ...overrides,
  });
}

function makeReceipt(overrides: Record<string, unknown> = {}) {
  return ExtractedReceiptSchema.parse({
    schemaVersion: 1,
    documentType: "receipt",
    merchant: { name: "Corner Market" },
    receiptNumber: "R-55",
    transactionDate: "2026-09-15",
    currency: "CAD",
    lines: [
      {
        sourceLineId: "line-1",
        description: "Cleaning supplies",
        quantity: "2.000",
        unitPriceCents: 500,
        lineSubtotalCents: 1_000,
      },
    ],
    subtotalCents: 1_000,
    discountCents: 0,
    taxCents: 80,
    tipCents: 200,
    totalCents: 1_280,
    ...overrides,
  });
}

describe("extracted document schemas", () => {
  it("parses invoices and applies explicit zero defaults", () => {
    const parsed = ExtractedInvoiceSchema.parse({
      schemaVersion: 1,
      documentType: "invoice",
      vendor: { name: "Vendor" },
      invoiceNumber: "I-1",
      issuedDate: "2026-09-15",
      currency: "USD",
      lines: [
        {
          sourceLineId: "1",
          description: "Item",
          quantity: "1.000",
          unitPriceCents: 100,
          lineSubtotalCents: 100,
        },
      ],
      subtotalCents: 100,
      totalCents: 100,
    });

    expect(parsed.discountCents).toBe(0);
    expect(parsed.shippingCents).toBe(0);
    expect(parsed.taxCents).toBe(0);
  });

  it("rejects floating money and non-string quantities", () => {
    const invoice = makeInvoice();
    expect(() =>
      ExtractedInvoiceSchema.parse({ ...invoice, totalCents: 10.75 }),
    ).toThrow();
    expect(() =>
      ExtractedInvoiceSchema.parse({
        ...invoice,
        lines: [{ ...invoice.lines[0], quantity: 2.5 }],
      }),
    ).toThrow();
    expect(() =>
      ExtractedInvoiceSchema.parse({
        ...invoice,
        lines: [{ ...invoice.lines[0], quantity: "2.5e0" }],
      }),
    ).toThrow();
  });

  it("rejects invalid calendar dates and untrusted AI posting fields", () => {
    const invoice = makeInvoice();
    expect(() =>
      ExtractedInvoiceSchema.parse({
        ...invoice,
        issuedDate: "2026-02-30",
      }),
    ).toThrow();
    expect(() =>
      ExtractedInvoiceSchema.parse({
        ...invoice,
        aiApproved: true,
      }),
    ).toThrow();
  });

  it("rejects duplicate source line IDs", () => {
    const invoice = makeInvoice();
    expect(() =>
      ExtractedInvoiceSchema.parse({
        ...invoice,
        lines: [invoice.lines[0], { ...invoice.lines[0] }],
      }),
    ).toThrow(/source line IDs must be unique/);
  });

  it("discriminates invoices from receipts and allows unitemized receipts", () => {
    const receipt = ExtractedDocumentSchema.parse({
      schemaVersion: 1,
      documentType: "receipt",
      merchant: { name: "Taxi" },
      transactionDate: "2026-09-15",
      currency: "CAD",
      subtotalCents: 2_000,
      totalCents: 2_000,
    });

    expect(receipt.documentType).toBe("receipt");
    expect(receipt.lines).toEqual([]);
  });
});

describe("deterministic document arithmetic", () => {
  it("validates exact invoice extensions, subtotal, and total", () => {
    const result = validateInvoiceArithmetic(makeInvoice());

    expect(result.valid).toBe(true);
    expect(result.roundingPolicy).toBe("half_up_to_cent");
    expect(result.computedLineSubtotalsCents).toEqual({ "line-1": 1_000 });
    expect(result.computedSubtotalCents).toBe(1_000);
    expect(result.computedTotalCents).toBe(1_075);
    expect(result.issues).toEqual([]);
  });

  it("uses half-up rounding and reports a line mismatch deterministically", () => {
    const invoice = makeInvoice({
      lines: [
        {
          sourceLineId: "line-1",
          description: "Fractional item",
          quantity: "2.500",
          unitPriceCents: 199,
          lineSubtotalCents: 497,
        },
      ],
      subtotalCents: 497,
      taxCents: 0,
      totalCents: 497,
    });
    const result = validateInvoiceArithmetic(invoice);

    expect(result.valid).toBe(false);
    expect(result.computedLineSubtotalsCents["line-1"]).toBe(498);
    expect(result.issues[0]).toEqual({
      code: "line_subtotal_mismatch",
      path: "lines.0.lineSubtotalCents",
      expectedCents: 498,
      actualCents: 497,
      deltaCents: -1,
    });
  });

  it("checks discounts, shipping, and tax using integer cents", () => {
    const result = validateInvoiceArithmetic(
      makeInvoice({
        discountCents: 100,
        shippingCents: 50,
        taxCents: 75,
        totalCents: 1_025,
      }),
    );

    expect(result.valid).toBe(true);
    expect(result.computedTotalCents).toBe(1_025);
  });

  it("reports subtotal and total mismatches in stable order", () => {
    const result = validateInvoiceArithmetic(
      makeInvoice({ subtotalCents: 999, totalCents: 1_000 }),
    );

    expect(result.issues.map((issue) => issue.code)).toEqual([
      "document_subtotal_mismatch",
      "document_total_mismatch",
    ]);
    expect(result.issues[0].deltaCents).toBe(-1);
    expect(result.issues[1].expectedCents).toBe(1_074);
  });

  it("validates receipt tax and tip arithmetic", () => {
    const result = validateReceiptArithmetic(makeReceipt());
    expect(result.valid).toBe(true);
    expect(result.computedTotalCents).toBe(1_280);
  });

  it("only permits a discrepancy when an explicit tolerance is supplied", () => {
    const invoice = makeInvoice({
      lines: [
        {
          ...makeInvoice().lines[0],
          lineSubtotalCents: 999,
        },
      ],
      subtotalCents: 999,
      taxCents: 0,
      totalCents: 999,
    });

    expect(validateInvoiceArithmetic(invoice).valid).toBe(false);
    expect(validateInvoiceArithmetic(invoice, 1).valid).toBe(true);
  });
});
