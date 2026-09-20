import { z } from "zod";

import {
  canonicalDecimal,
  ConversionSnapshotSchema,
  convertQuantity,
  deepFreeze,
  DomainDecimal,
  NonNegativeDecimalStringSchema,
  PositiveDecimalStringSchema,
  type ConversionSnapshot,
  type DeepReadonly,
} from "../inventory/uom";
import { IntegerCentsSchema } from "./journal";
import { ProvenanceSourceSchema } from "./provenance";

const PositiveIntegerCentsSchema = IntegerCentsSchema.min(1);

function addSafeCents(total: number, amount: number): number {
  if (amount > Number.MAX_SAFE_INTEGER - total) {
    throw new RangeError("Procurement total exceeds safe integer cents");
  }
  return total + amount;
}

function sumSafeCents(amounts: readonly number[]): number {
  return amounts.reduce(addSafeCents, 0);
}

export const PurchaseOrderLineSchema = z.strictObject({
  purchaseOrderLineId: z.string().trim().min(1).max(160),
  itemId: z.string().trim().min(1).max(160),
  orderedQuantity: PositiveDecimalStringSchema,
  conversionToStockingUnit: ConversionSnapshotSchema,
  expectedAmountCents: IntegerCentsSchema,
});

export const GoodsReceiptLineSchema = z.strictObject({
  receiptLineId: z.string().trim().min(1).max(160),
  purchaseOrderLineId: z.string().trim().min(1).max(160),
  receivedQuantity: PositiveDecimalStringSchema,
  conversionToStockingUnit: ConversionSnapshotSchema,
});

export const SupplierInvoiceLineSchema = z.strictObject({
  invoiceLineId: z.string().trim().min(1).max(160),
  purchaseOrderLineId: z.string().trim().min(1).max(160),
  invoicedQuantity: PositiveDecimalStringSchema,
  conversionToStockingUnit: ConversionSnapshotSchema,
  amountCents: IntegerCentsSchema,
});

export const PaymentAllocationSchema = z.strictObject({
  invoiceId: z.string().trim().min(1).max(160),
  amountCents: PositiveIntegerCentsSchema,
});

const EventIdentityFields = {
  eventId: z.string().trim().min(1).max(160),
  purchaseOrderId: z.string().trim().min(1).max(160),
  occurredAt: z.string().datetime({ offset: true }),
  source: ProvenanceSourceSchema,
} as const;

export const PurchaseOrderPlacedEventSchema = z
  .strictObject({
    ...EventIdentityFields,
    type: z.literal("purchase_order_placed"),
    vendorId: z.string().trim().min(1).max(160),
    currency: z.string().regex(/^[A-Z]{3}$/),
    lines: z.array(PurchaseOrderLineSchema).min(1),
  })
  .superRefine((event, context) => {
    const lineIds = new Set<string>();
    for (const [index, line] of event.lines.entries()) {
      if (lineIds.has(line.purchaseOrderLineId)) {
        context.addIssue({
          code: "custom",
          path: ["lines", index, "purchaseOrderLineId"],
          message: "Purchase order line IDs must be unique",
        });
      }
      lineIds.add(line.purchaseOrderLineId);
    }

    try {
      sumSafeCents(event.lines.map((line) => line.expectedAmountCents));
    } catch (error) {
      context.addIssue({
        code: "custom",
        path: ["lines"],
        message:
          error instanceof Error
            ? error.message
            : "Purchase order total is invalid",
      });
    }
  });

export const GoodsReceivedEventSchema = z
  .strictObject({
    ...EventIdentityFields,
    type: z.literal("goods_received"),
    receiptId: z.string().trim().min(1).max(160),
    receivingLocationId: z.string().trim().min(1).max(160),
    lines: z.array(GoodsReceiptLineSchema).min(1),
  })
  .superRefine((event, context) => {
    const lineIds = new Set<string>();
    for (const [index, line] of event.lines.entries()) {
      if (lineIds.has(line.receiptLineId)) {
        context.addIssue({
          code: "custom",
          path: ["lines", index, "receiptLineId"],
          message: "Goods receipt line IDs must be unique",
        });
      }
      lineIds.add(line.receiptLineId);
    }
  });

export const SupplierInvoiceRecordedEventSchema = z
  .strictObject({
    ...EventIdentityFields,
    type: z.literal("supplier_invoice_recorded"),
    invoiceId: z.string().trim().min(1).max(160),
    supplierInvoiceNumber: z.string().trim().min(1).max(160),
    lines: z.array(SupplierInvoiceLineSchema).min(1),
    taxCents: IntegerCentsSchema,
    freightCents: IntegerCentsSchema,
    invoiceTotalCents: PositiveIntegerCentsSchema,
  })
  .superRefine((event, context) => {
    const lineIds = new Set<string>();
    for (const [index, line] of event.lines.entries()) {
      if (lineIds.has(line.invoiceLineId)) {
        context.addIssue({
          code: "custom",
          path: ["lines", index, "invoiceLineId"],
          message: "Supplier invoice line IDs must be unique",
        });
      }
      lineIds.add(line.invoiceLineId);
    }

    try {
      const calculatedTotal = sumSafeCents([
        ...event.lines.map((line) => line.amountCents),
        event.taxCents,
        event.freightCents,
      ]);
      if (calculatedTotal !== event.invoiceTotalCents) {
        context.addIssue({
          code: "custom",
          path: ["invoiceTotalCents"],
          message: "Invoice total must equal lines, tax, and freight",
        });
      }
    } catch (error) {
      context.addIssue({
        code: "custom",
        path: ["invoiceTotalCents"],
        message:
          error instanceof Error ? error.message : "Invoice total is invalid",
      });
    }
  });

export const SupplierPaymentRecordedEventSchema = z
  .strictObject({
    ...EventIdentityFields,
    type: z.literal("supplier_payment_recorded"),
    paymentId: z.string().trim().min(1).max(160),
    paymentReference: z.string().trim().min(1).max(160),
    amountCents: PositiveIntegerCentsSchema,
    allocations: z.array(PaymentAllocationSchema).min(1),
  })
  .superRefine((event, context) => {
    const invoiceIds = new Set<string>();
    for (const [index, allocation] of event.allocations.entries()) {
      if (invoiceIds.has(allocation.invoiceId)) {
        context.addIssue({
          code: "custom",
          path: ["allocations", index, "invoiceId"],
          message: "A payment may allocate to an invoice only once",
        });
      }
      invoiceIds.add(allocation.invoiceId);
    }

    try {
      if (
        sumSafeCents(event.allocations.map((item) => item.amountCents)) !==
        event.amountCents
      ) {
        context.addIssue({
          code: "custom",
          path: ["allocations"],
          message: "Payment allocations must equal the payment amount",
        });
      }
    } catch (error) {
      context.addIssue({
        code: "custom",
        path: ["allocations"],
        message:
          error instanceof Error
            ? error.message
            : "Payment allocation total is invalid",
      });
    }
  });

export const ProcurementEventSchema = z.union([
  PurchaseOrderPlacedEventSchema,
  GoodsReceivedEventSchema,
  SupplierInvoiceRecordedEventSchema,
  SupplierPaymentRecordedEventSchema,
]);

export type PurchaseOrderPlacedEvent = DeepReadonly<
  z.output<typeof PurchaseOrderPlacedEventSchema>
>;
export type GoodsReceivedEvent = DeepReadonly<
  z.output<typeof GoodsReceivedEventSchema>
>;
export type SupplierInvoiceRecordedEvent = DeepReadonly<
  z.output<typeof SupplierInvoiceRecordedEventSchema>
>;
export type SupplierPaymentRecordedEvent = DeepReadonly<
  z.output<typeof SupplierPaymentRecordedEventSchema>
>;
export type ProcurementEvent = DeepReadonly<
  z.output<typeof ProcurementEventSchema>
>;

export const ProcurementPolicySchema = z.strictObject({
  overReceiptToleranceRatio:
    NonNegativeDecimalStringSchema.default("0"),
  overInvoiceToleranceRatio:
    NonNegativeDecimalStringSchema.default("0"),
});

export type ProcurementPolicy = z.input<typeof ProcurementPolicySchema>;

interface MutableLineState {
  readonly purchaseOrderLineId: string;
  readonly itemId: string;
  readonly stockingUnit: ConversionSnapshot["toUnit"];
  readonly orderedQuantity: InstanceType<typeof DomainDecimal>;
  receivedQuantity: InstanceType<typeof DomainDecimal>;
  invoicedQuantity: InstanceType<typeof DomainDecimal>;
}

interface MutableInvoiceState {
  readonly invoiceId: string;
  readonly totalCents: number;
  paidCents: number;
}

export interface ProcurementLineState {
  readonly purchaseOrderLineId: string;
  readonly itemId: string;
  readonly stockingUnitCode: string;
  readonly orderedQuantity: string;
  readonly receivedQuantity: string;
  readonly invoicedQuantity: string;
}

export interface ProcurementInvoiceState {
  readonly invoiceId: string;
  readonly totalCents: number;
  readonly paidCents: number;
  readonly outstandingCents: number;
}

export interface ProcurementAggregate {
  readonly purchaseOrderId: string;
  readonly vendorId: string;
  readonly currency: string;
  readonly eventIds: readonly string[];
  readonly lines: readonly ProcurementLineState[];
  readonly invoices: readonly ProcurementInvoiceState[];
  readonly expectedAmountCents: number;
  readonly invoicedAmountCents: number;
  readonly paidAmountCents: number;
  readonly outstandingAmountCents: number;
  readonly receiptStatus: "not_received" | "partially_received" | "received";
  readonly invoiceStatus: "not_invoiced" | "partially_invoiced" | "invoiced";
  readonly paymentStatus: "not_invoiced" | "unpaid" | "partially_paid" | "paid";
  readonly status: "open" | "completed";
}

function assertSameTargetUnit(
  orderLine: MutableLineState,
  snapshot: ConversionSnapshot,
): void {
  const expected = orderLine.stockingUnit;
  const actual = snapshot.toUnit;
  if (
    actual.code !== expected.code ||
    actual.dimension !== expected.dimension ||
    actual.definitionVersion !== expected.definitionVersion ||
    !new DomainDecimal(actual.toBaseFactor).eq(expected.toBaseFactor)
  ) {
    throw new Error(
      `Line ${orderLine.purchaseOrderLineId} conversion targets a different stocking unit snapshot`,
    );
  }
}

function assertWithinTolerance(
  description: string,
  accumulated: InstanceType<typeof DomainDecimal>,
  ordered: InstanceType<typeof DomainDecimal>,
  toleranceRatio: string,
): void {
  const maximum = ordered.mul(
    new DomainDecimal(1).plus(toleranceRatio),
  );
  if (accumulated.gt(maximum)) {
    throw new RangeError(`${description} exceeds the configured tolerance`);
  }
}

function completenessStatus<
  NoneStatus extends string,
  PartialStatus extends string,
  CompleteStatus extends string,
>(
  lines: readonly MutableLineState[],
  field: "receivedQuantity" | "invoicedQuantity",
  none: NoneStatus,
  partial: PartialStatus,
  complete: CompleteStatus,
): NoneStatus | PartialStatus | CompleteStatus {
  if (lines.every((line) => line[field].isZero())) return none;
  if (lines.every((line) => line[field].gte(line.orderedQuantity))) {
    return complete;
  }
  return partial;
}

/**
 * Folds the explicit procurement event stream. An invoice may arrive before a
 * receipt, but neither can precede the purchase order, and a payment must
 * reference an already-recorded invoice.
 */
export function foldProcurementEvents(
  eventInputs: readonly unknown[],
  policyInput: ProcurementPolicy = {},
): DeepReadonly<ProcurementAggregate> {
  if (eventInputs.length === 0) {
    throw new Error("A procurement stream cannot be empty");
  }

  const events = eventInputs.map((event) => ProcurementEventSchema.parse(event));
  const policy = ProcurementPolicySchema.parse(policyInput);
  const first = events[0];
  if (first === undefined || first.type !== "purchase_order_placed") {
    throw new Error("The first procurement event must place the purchase order");
  }

  const eventIds = new Set<string>();
  const receiptIds = new Set<string>();
  const paymentIds = new Set<string>();
  const supplierInvoiceNumbers = new Set<string>();
  const lineStates = new Map<string, MutableLineState>();
  const invoiceStates = new Map<string, MutableInvoiceState>();
  let previousOccurredAt = Number.NEGATIVE_INFINITY;
  let purchaseOrderCount = 0;

  for (const event of events) {
    if (event.purchaseOrderId !== first.purchaseOrderId) {
      throw new Error("A procurement stream may contain one purchase order");
    }
    if (eventIds.has(event.eventId)) {
      throw new Error(`Duplicate procurement event ${event.eventId}`);
    }
    eventIds.add(event.eventId);

    const occurredAt = Date.parse(event.occurredAt);
    if (occurredAt < previousOccurredAt) {
      throw new Error("Procurement events must be in chronological order");
    }
    previousOccurredAt = occurredAt;

    switch (event.type) {
      case "purchase_order_placed": {
        purchaseOrderCount += 1;
        if (purchaseOrderCount > 1) {
          throw new Error("A purchase order may only be placed once");
        }
        for (const line of event.lines) {
          const orderedQuantity = new DomainDecimal(
            convertQuantity(
              line.orderedQuantity,
              line.conversionToStockingUnit,
            ),
          );
          lineStates.set(line.purchaseOrderLineId, {
            purchaseOrderLineId: line.purchaseOrderLineId,
            itemId: line.itemId,
            stockingUnit: line.conversionToStockingUnit.toUnit,
            orderedQuantity,
            receivedQuantity: new DomainDecimal(0),
            invoicedQuantity: new DomainDecimal(0),
          });
        }
        break;
      }

      case "goods_received": {
        if (receiptIds.has(event.receiptId)) {
          throw new Error(`Duplicate goods receipt ${event.receiptId}`);
        }
        receiptIds.add(event.receiptId);

        for (const line of event.lines) {
          const orderLine = lineStates.get(line.purchaseOrderLineId);
          if (orderLine === undefined) {
            throw new Error(
              `Receipt references unknown line ${line.purchaseOrderLineId}`,
            );
          }
          assertSameTargetUnit(orderLine, line.conversionToStockingUnit);
          orderLine.receivedQuantity = orderLine.receivedQuantity.plus(
            convertQuantity(
              line.receivedQuantity,
              line.conversionToStockingUnit,
            ),
          );
          assertWithinTolerance(
            `Received quantity for ${line.purchaseOrderLineId}`,
            orderLine.receivedQuantity,
            orderLine.orderedQuantity,
            policy.overReceiptToleranceRatio,
          );
        }
        break;
      }

      case "supplier_invoice_recorded": {
        if (invoiceStates.has(event.invoiceId)) {
          throw new Error(`Duplicate supplier invoice ${event.invoiceId}`);
        }
        if (supplierInvoiceNumbers.has(event.supplierInvoiceNumber)) {
          throw new Error(
            `Duplicate supplier invoice number ${event.supplierInvoiceNumber}`,
          );
        }
        supplierInvoiceNumbers.add(event.supplierInvoiceNumber);

        for (const line of event.lines) {
          const orderLine = lineStates.get(line.purchaseOrderLineId);
          if (orderLine === undefined) {
            throw new Error(
              `Invoice references unknown line ${line.purchaseOrderLineId}`,
            );
          }
          assertSameTargetUnit(orderLine, line.conversionToStockingUnit);
          orderLine.invoicedQuantity = orderLine.invoicedQuantity.plus(
            convertQuantity(
              line.invoicedQuantity,
              line.conversionToStockingUnit,
            ),
          );
          assertWithinTolerance(
            `Invoiced quantity for ${line.purchaseOrderLineId}`,
            orderLine.invoicedQuantity,
            orderLine.orderedQuantity,
            policy.overInvoiceToleranceRatio,
          );
        }
        invoiceStates.set(event.invoiceId, {
          invoiceId: event.invoiceId,
          totalCents: event.invoiceTotalCents,
          paidCents: 0,
        });
        break;
      }

      case "supplier_payment_recorded": {
        if (paymentIds.has(event.paymentId)) {
          throw new Error(`Duplicate supplier payment ${event.paymentId}`);
        }
        paymentIds.add(event.paymentId);

        for (const allocation of event.allocations) {
          const invoice = invoiceStates.get(allocation.invoiceId);
          if (invoice === undefined) {
            throw new Error(
              `Payment references unknown invoice ${allocation.invoiceId}`,
            );
          }
          if (
            allocation.amountCents >
            invoice.totalCents - invoice.paidCents
          ) {
            throw new RangeError(
              `Payment over-allocates invoice ${allocation.invoiceId}`,
            );
          }
          invoice.paidCents = addSafeCents(
            invoice.paidCents,
            allocation.amountCents,
          );
        }
        break;
      }
    }
  }

  const mutableLines = [...lineStates.values()];
  const receiptStatus = completenessStatus(
    mutableLines,
    "receivedQuantity",
    "not_received",
    "partially_received",
    "received",
  );
  const invoiceStatus = completenessStatus(
    mutableLines,
    "invoicedQuantity",
    "not_invoiced",
    "partially_invoiced",
    "invoiced",
  );
  const invoiceValues = [...invoiceStates.values()];
  const invoicedAmountCents = sumSafeCents(
    invoiceValues.map((invoice) => invoice.totalCents),
  );
  const paidAmountCents = sumSafeCents(
    invoiceValues.map((invoice) => invoice.paidCents),
  );
  const outstandingAmountCents = invoicedAmountCents - paidAmountCents;
  const paymentStatus =
    invoiceValues.length === 0
      ? "not_invoiced"
      : paidAmountCents === 0
        ? "unpaid"
        : outstandingAmountCents === 0
          ? "paid"
          : "partially_paid";
  const expectedAmountCents = sumSafeCents(
    first.lines.map((line) => line.expectedAmountCents),
  );
  const status =
    receiptStatus === "received" &&
    invoiceStatus === "invoiced" &&
    paymentStatus === "paid"
      ? "completed"
      : "open";

  return deepFreeze({
    purchaseOrderId: first.purchaseOrderId,
    vendorId: first.vendorId,
    currency: first.currency,
    eventIds: [...eventIds],
    lines: mutableLines.map((line) => ({
      purchaseOrderLineId: line.purchaseOrderLineId,
      itemId: line.itemId,
      stockingUnitCode: line.stockingUnit.code,
      orderedQuantity: canonicalDecimal(line.orderedQuantity),
      receivedQuantity: canonicalDecimal(line.receivedQuantity),
      invoicedQuantity: canonicalDecimal(line.invoicedQuantity),
    })),
    invoices: invoiceValues.map((invoice) => ({
      invoiceId: invoice.invoiceId,
      totalCents: invoice.totalCents,
      paidCents: invoice.paidCents,
      outstandingCents: invoice.totalCents - invoice.paidCents,
    })),
    expectedAmountCents,
    invoicedAmountCents,
    paidAmountCents,
    outstandingAmountCents,
    receiptStatus,
    invoiceStatus,
    paymentStatus,
    status,
  } satisfies ProcurementAggregate);
}

export interface ProcurementEventEffect {
  readonly eventType: ProcurementEvent["type"];
  readonly commitmentCreatedCents: number;
  readonly physicalInventoryChanges: readonly Readonly<{
    purchaseOrderLineId: string;
    stockingUnitCode: string;
    quantity: string;
  }>[];
  readonly accountsPayableDeltaCents: number;
  readonly cashDeltaCents: number;
}

/**
 * Makes event separation explicit: only receipts affect physical quantity,
 * only invoices establish AP, and only payments reduce AP and cash.
 */
export function procurementEventEffect(
  eventInput: unknown,
): DeepReadonly<ProcurementEventEffect> {
  const event = ProcurementEventSchema.parse(eventInput);

  switch (event.type) {
    case "purchase_order_placed":
      return deepFreeze({
        eventType: event.type,
        commitmentCreatedCents: sumSafeCents(
          event.lines.map((line) => line.expectedAmountCents),
        ),
        physicalInventoryChanges: [],
        accountsPayableDeltaCents: 0,
        cashDeltaCents: 0,
      });
    case "goods_received":
      return deepFreeze({
        eventType: event.type,
        commitmentCreatedCents: 0,
        physicalInventoryChanges: event.lines.map((line) => ({
          purchaseOrderLineId: line.purchaseOrderLineId,
          stockingUnitCode: line.conversionToStockingUnit.toUnit.code,
          quantity: convertQuantity(
            line.receivedQuantity,
            line.conversionToStockingUnit,
          ),
        })),
        accountsPayableDeltaCents: 0,
        cashDeltaCents: 0,
      });
    case "supplier_invoice_recorded":
      return deepFreeze({
        eventType: event.type,
        commitmentCreatedCents: 0,
        physicalInventoryChanges: [],
        accountsPayableDeltaCents: event.invoiceTotalCents,
        cashDeltaCents: 0,
      });
    case "supplier_payment_recorded":
      return deepFreeze({
        eventType: event.type,
        commitmentCreatedCents: 0,
        physicalInventoryChanges: [],
        accountsPayableDeltaCents: -event.amountCents,
        cashDeltaCents: -event.amountCents,
      });
  }
}
