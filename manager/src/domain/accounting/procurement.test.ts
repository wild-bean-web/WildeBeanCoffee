import { describe, expect, it } from "vitest";

import {
  GoodsReceivedEventSchema,
  SupplierInvoiceRecordedEventSchema,
  SupplierPaymentRecordedEventSchema,
  foldProcurementEvents,
  procurementEventEffect,
} from "./procurement";
import { createProvenanceSource } from "./provenance";
import {
  createConversionSnapshot,
  createUnitDefinition,
} from "../inventory/uom";

const each = createUnitDefinition({
  code: "each",
  name: "each",
  symbol: "ea",
  dimension: "count",
  toBaseFactor: "1",
  definitionVersion: 1,
  quantityScale: 0,
});

const supplierCase = createUnitDefinition({
  code: "case",
  name: "supplier case",
  symbol: "case",
  dimension: "count",
  toBaseFactor: "12",
  definitionVersion: 1,
  quantityScale: 2,
});

function conversion(snapshotId: string) {
  return createConversionSnapshot({
    snapshotId,
    capturedAt: "2026-09-17T09:00:00.000Z",
    fromUnit: supplierCase,
    toUnit: each,
  });
}

function identity(eventId: string, occurredAt: string) {
  return {
    eventId,
    purchaseOrderId: "po-1",
    occurredAt,
    source: createProvenanceSource({
      sourceId: `source-${eventId}`,
      kind: "supplier_document",
      independenceKey: `document-${eventId}`,
      observedAt: occurredAt,
    }),
  };
}

function purchaseOrder() {
  return {
    ...identity("event-po", "2026-09-17T10:00:00.000Z"),
    type: "purchase_order_placed" as const,
    vendorId: "vendor-1",
    currency: "USD",
    lines: [
      {
        purchaseOrderLineId: "po-line-1",
        itemId: "coffee-cup",
        orderedQuantity: "10",
        conversionToStockingUnit: conversion("po-conversion"),
        expectedAmountCents: 12_000,
      },
    ],
  };
}

function receipt(
  quantity = "4",
  occurredAt = "2026-09-17T11:00:00.000Z",
  receiptId = "receipt-1",
) {
  return {
    ...identity(`event-${receiptId}`, occurredAt),
    type: "goods_received" as const,
    receiptId,
    receivingLocationId: "store",
    lines: [
      {
        receiptLineId: `${receiptId}-line`,
        purchaseOrderLineId: "po-line-1",
        receivedQuantity: quantity,
        conversionToStockingUnit: conversion(`${receiptId}-conversion`),
      },
    ],
  };
}

function invoice(occurredAt = "2026-09-17T12:00:00.000Z") {
  return {
    ...identity("event-invoice", occurredAt),
    type: "supplier_invoice_recorded" as const,
    invoiceId: "invoice-1",
    supplierInvoiceNumber: "SUP-100",
    lines: [
      {
        invoiceLineId: "invoice-line-1",
        purchaseOrderLineId: "po-line-1",
        invoicedQuantity: "10",
        conversionToStockingUnit: conversion("invoice-conversion"),
        amountCents: 12_000,
      },
    ],
    taxCents: 500,
    freightCents: 500,
    invoiceTotalCents: 13_000,
  };
}

function payment(
  amountCents: number,
  occurredAt: string,
  paymentId: string,
) {
  return {
    ...identity(`event-${paymentId}`, occurredAt),
    type: "supplier_payment_recorded" as const,
    paymentId,
    paymentReference: `reference-${paymentId}`,
    amountCents,
    allocations: [{ invoiceId: "invoice-1", amountCents }],
  };
}

describe("procurement event separation", () => {
  it("assigns physical and financial effects to distinct events", () => {
    const orderEffect = procurementEventEffect(purchaseOrder());
    const receiptEffect = procurementEventEffect(receipt());
    const invoiceEffect = procurementEventEffect(invoice());
    const paymentEffect = procurementEventEffect(
      payment(5_000, "2026-09-17T13:00:00.000Z", "payment-1"),
    );

    expect(orderEffect).toMatchObject({
      commitmentCreatedCents: 12_000,
      physicalInventoryChanges: [],
      accountsPayableDeltaCents: 0,
      cashDeltaCents: 0,
    });
    expect(receiptEffect).toMatchObject({
      commitmentCreatedCents: 0,
      physicalInventoryChanges: [
        {
          purchaseOrderLineId: "po-line-1",
          stockingUnitCode: "each",
          quantity: "48",
        },
      ],
      accountsPayableDeltaCents: 0,
      cashDeltaCents: 0,
    });
    expect(invoiceEffect).toMatchObject({
      physicalInventoryChanges: [],
      accountsPayableDeltaCents: 13_000,
      cashDeltaCents: 0,
    });
    expect(paymentEffect).toMatchObject({
      physicalInventoryChanges: [],
      accountsPayableDeltaCents: -5_000,
      cashDeltaCents: -5_000,
    });
  });

  it("strictly rejects fields belonging to another event type", () => {
    expect(() =>
      GoodsReceivedEventSchema.parse({
        ...receipt(),
        invoiceTotalCents: 13_000,
      }),
    ).toThrow();
  });

  it("validates invoice arithmetic and payment allocation arithmetic", () => {
    expect(() =>
      SupplierInvoiceRecordedEventSchema.parse({
        ...invoice(),
        invoiceTotalCents: 12_999,
      }),
    ).toThrow(/equal lines, tax, and freight/);

    expect(() =>
      SupplierPaymentRecordedEventSchema.parse({
        ...payment(5_000, "2026-09-17T13:00:00.000Z", "payment-1"),
        allocations: [{ invoiceId: "invoice-1", amountCents: 4_999 }],
      }),
    ).toThrow(/allocations must equal/);
  });
});

describe("procurement event folding", () => {
  it("tracks independent order, receipt, invoice, and payment state", () => {
    const aggregate = foldProcurementEvents([
      purchaseOrder(),
      receipt("4", "2026-09-17T11:00:00.000Z", "receipt-1"),
      receipt("6", "2026-09-17T11:30:00.000Z", "receipt-2"),
      invoice(),
      payment(5_000, "2026-09-17T13:00:00.000Z", "payment-1"),
      payment(8_000, "2026-09-17T14:00:00.000Z", "payment-2"),
    ]);

    expect(aggregate.lines).toEqual([
      {
        purchaseOrderLineId: "po-line-1",
        itemId: "coffee-cup",
        stockingUnitCode: "each",
        orderedQuantity: "120",
        receivedQuantity: "120",
        invoicedQuantity: "120",
      },
    ]);
    expect(aggregate.invoices).toEqual([
      {
        invoiceId: "invoice-1",
        totalCents: 13_000,
        paidCents: 13_000,
        outstandingCents: 0,
      },
    ]);
    expect(aggregate).toMatchObject({
      receiptStatus: "received",
      invoiceStatus: "invoiced",
      paymentStatus: "paid",
      status: "completed",
      expectedAmountCents: 12_000,
      invoicedAmountCents: 13_000,
      paidAmountCents: 13_000,
      outstandingAmountCents: 0,
    });
    expect(Object.isFrozen(aggregate)).toBe(true);
  });

  it("allows an invoice before a receipt while preserving separate statuses", () => {
    const aggregate = foldProcurementEvents([
      purchaseOrder(),
      invoice("2026-09-17T11:00:00.000Z"),
    ]);

    expect(aggregate.receiptStatus).toBe("not_received");
    expect(aggregate.invoiceStatus).toBe("invoiced");
    expect(aggregate.paymentStatus).toBe("unpaid");
    expect(aggregate.status).toBe("open");
  });

  it("enforces receipt tolerance in the stocking dimension", () => {
    expect(() =>
      foldProcurementEvents([purchaseOrder(), receipt("11")]),
    ).toThrow(/Received quantity.*exceeds/);

    const tolerated = foldProcurementEvents(
      [purchaseOrder(), receipt("11")],
      { overReceiptToleranceRatio: "0.1" },
    );
    expect(tolerated.lines[0]?.receivedQuantity).toBe("132");
    expect(tolerated.receiptStatus).toBe("received");
  });

  it("rejects conversion snapshots targeting another stocking unit", () => {
    const portion = createUnitDefinition({
      code: "portion",
      name: "portion",
      symbol: "portion",
      dimension: "count",
      toBaseFactor: "1",
      definitionVersion: 1,
      quantityScale: 0,
    });
    const mismatchedReceipt = receipt();
    mismatchedReceipt.lines[0]!.conversionToStockingUnit =
      createConversionSnapshot({
        snapshotId: "wrong-target",
        capturedAt: "2026-09-17T09:00:00.000Z",
        fromUnit: supplierCase,
        toUnit: portion,
      });

    expect(() =>
      foldProcurementEvents([purchaseOrder(), mismatchedReceipt]),
    ).toThrow(/different stocking unit snapshot/);
  });

  it("rejects payments before invoices and over-allocation", () => {
    expect(() =>
      foldProcurementEvents([
        purchaseOrder(),
        payment(1_000, "2026-09-17T11:00:00.000Z", "payment-early"),
      ]),
    ).toThrow(/unknown invoice/);

    expect(() =>
      foldProcurementEvents([
        purchaseOrder(),
        invoice(),
        payment(13_001, "2026-09-17T13:00:00.000Z", "payment-too-large"),
      ]),
    ).toThrow(/over-allocates/);
  });

  it("rejects duplicate documents and out-of-order event streams", () => {
    expect(() =>
      foldProcurementEvents([
        purchaseOrder(),
        receipt("1", "2026-09-17T11:00:00.000Z", "same-receipt"),
        receipt("1", "2026-09-17T11:01:00.000Z", "same-receipt"),
      ]),
    ).toThrow(/Duplicate procurement event|Duplicate goods receipt/);

    expect(() =>
      foldProcurementEvents([
        purchaseOrder(),
        receipt("1", "2026-09-17T09:00:00.000Z"),
      ]),
    ).toThrow(/chronological order/);
  });
});
