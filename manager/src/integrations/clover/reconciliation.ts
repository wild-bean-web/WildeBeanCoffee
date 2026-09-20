import { z } from "zod";

import {
  CurrencyCodeSchema,
  NormalizedOrderSchema,
  NormalizedPaymentSchema,
  NormalizedRefundSchema,
  NormalizedSourceChannelSchema,
  type NormalizedOrder,
  type NormalizedPayment,
  type NormalizedRefund,
} from "./schemas";
import { isCloverSuccessfulPayment } from "./normalization";

export const BusinessDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (value) =>
      new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value,
    "Invalid calendar date.",
  );

const CountSchema = z.number().int().safe().nonnegative();
const CentsSchema = z.number().int().safe();
const NonNegativeCentsSchema = CentsSchema.nonnegative();

export const DailyTenderControlSchema = z
  .object({
    paymentCount: CountSchema,
    refundCount: CountSchema,
    grossCents: NonNegativeCentsSchema,
    refundCents: NonNegativeCentsSchema,
    netCents: CentsSchema,
  })
  .strict();

export const DailySourceControlSchema = z
  .object({
    paymentCount: CountSchema,
    refundCount: CountSchema,
    grossCents: NonNegativeCentsSchema,
    refundCents: NonNegativeCentsSchema,
    netCents: CentsSchema,
  })
  .strict();

export const DailyControlTotalsSchema = z
  .object({
    businessDate: BusinessDateSchema,
    timeZone: z.string().min(1),
    currency: CurrencyCodeSchema,
    orders: z
      .object({
        count: CountSchema,
        totalCents: CentsSchema,
        discountCents: NonNegativeCentsSchema,
      })
      .strict(),
    payments: z
      .object({
        count: CountSchema,
        failedCount: CountSchema,
        offlineCount: CountSchema,
        amountCents: NonNegativeCentsSchema,
        tipCents: NonNegativeCentsSchema,
        taxCents: NonNegativeCentsSchema,
        totalCollectedCents: NonNegativeCentsSchema,
      })
      .strict(),
    refunds: z
      .object({
        count: CountSchema,
        amountCents: NonNegativeCentsSchema,
        tipCents: NonNegativeCentsSchema,
        taxCents: NonNegativeCentsSchema,
      })
      .strict(),
    netCollectedCents: CentsSchema,
    tenders: z.record(z.string().min(1), DailyTenderControlSchema),
    sources: z.partialRecord(
      NormalizedSourceChannelSchema,
      DailySourceControlSchema,
    ),
  })
  .strict();

export type DailyControlTotals = z.infer<typeof DailyControlTotalsSchema>;

export interface CalculateDailyControlTotalsInput {
  readonly businessDate: string;
  readonly timeZone: string;
  readonly currency: string;
  readonly orders?: readonly NormalizedOrder[];
  readonly payments: readonly NormalizedPayment[];
  readonly refunds?: readonly NormalizedRefund[];
}

type MutableControlBucket = {
  paymentCount: number;
  refundCount: number;
  grossCents: number;
  refundCents: number;
  netCents: number;
};

function createControlBucket(): MutableControlBucket {
  return {
    paymentCount: 0,
    refundCount: 0,
    grossCents: 0,
    refundCents: 0,
    netCents: 0,
  };
}

function addSafe(left: number, right: number): number {
  return CentsSchema.parse(left + right);
}

function uniqueByExternalId<T extends { readonly externalId: string }>(
  values: readonly T[],
): T[] {
  const unique = new Map<string, T>();
  for (const value of values) {
    unique.set(value.externalId, value);
  }
  return [...unique.values()];
}

function createDateFormatter(timeZone: string): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    throw new Error(`Invalid IANA time zone: ${timeZone}`);
  }
}

function dateInTimeZone(
  timestamp: string,
  formatter: Intl.DateTimeFormat,
): string {
  const parts = formatter.formatToParts(new Date(timestamp));
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Unable to resolve a business date.");
  }
  return `${year}-${month}-${day}`;
}

function assertCurrency(expected: string, actual: string): void {
  if (actual !== expected) {
    throw new Error("Control totals cannot mix currencies.");
  }
}

function tenderKey(payment: NormalizedPayment): string {
  return payment.tender.externalId
    ? `${payment.tender.type}:${encodeURIComponent(payment.tender.externalId)}`
    : payment.tender.type;
}

function updatePaymentBucket(
  buckets: Map<string, MutableControlBucket>,
  key: string,
  payment: NormalizedPayment,
): void {
  const bucket = buckets.get(key) ?? createControlBucket();
  bucket.paymentCount += 1;
  bucket.grossCents = addSafe(bucket.grossCents, payment.totalCollectedCents);
  bucket.netCents = addSafe(bucket.netCents, payment.totalCollectedCents);
  buckets.set(key, bucket);
}

function updateRefundBucket(
  buckets: Map<string, MutableControlBucket>,
  key: string,
  refund: NormalizedRefund,
): void {
  const bucket = buckets.get(key) ?? createControlBucket();
  bucket.refundCount += 1;
  bucket.refundCents = addSafe(bucket.refundCents, refund.amountCents);
  bucket.netCents = addSafe(bucket.netCents, -refund.amountCents);
  buckets.set(key, bucket);
}

function bucketsToRecord(
  buckets: Map<string, MutableControlBucket>,
): Record<string, MutableControlBucket> {
  return Object.fromEntries(
    [...buckets.entries()].sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  );
}

/**
 * Produces merchant-local daily controls from normalized Clover records.
 * Successful payments are counted once by external ID; explicit and embedded
 * refunds are de-duplicated the same way.
 */
export function calculateDailyControlTotals(
  input: CalculateDailyControlTotalsInput,
): DailyControlTotals {
  const businessDate = BusinessDateSchema.parse(input.businessDate);
  const currency = CurrencyCodeSchema.parse(input.currency);
  const formatter = createDateFormatter(input.timeZone);
  const timeZone = formatter.resolvedOptions().timeZone;

  const orders = uniqueByExternalId(
    (input.orders ?? []).map((order) => NormalizedOrderSchema.parse(order)),
  );
  const payments = uniqueByExternalId(
    input.payments.map((payment) => NormalizedPaymentSchema.parse(payment)),
  );
  const explicitRefunds = (input.refunds ?? []).map((refund) =>
    NormalizedRefundSchema.parse(refund),
  );
  const refunds = uniqueByExternalId([
    ...explicitRefunds,
    ...payments.flatMap((payment) => payment.refunds),
  ]);

  for (const record of [...orders, ...payments, ...refunds]) {
    assertCurrency(currency, record.currency);
  }

  const dailyOrders = orders.filter(
    (order) => dateInTimeZone(order.createdAt, formatter) === businessDate,
  );
  const allDailyPayments = payments.filter(
    (payment) => dateInTimeZone(payment.occurredAt, formatter) === businessDate,
  );
  const dailyPayments = allDailyPayments.filter(isCloverSuccessfulPayment);
  const dailyRefunds = refunds.filter(
    (refund) => dateInTimeZone(refund.occurredAt, formatter) === businessDate,
  );

  const paymentById = new Map(
    payments.map((payment) => [payment.externalId, payment]),
  );
  const tenderBuckets = new Map<string, MutableControlBucket>();
  const sourceBuckets = new Map<string, MutableControlBucket>();

  for (const payment of dailyPayments) {
    updatePaymentBucket(tenderBuckets, tenderKey(payment), payment);
    updatePaymentBucket(sourceBuckets, payment.sourceChannel, payment);
  }

  for (const refund of dailyRefunds) {
    const originalPayment = refund.paymentExternalId
      ? paymentById.get(refund.paymentExternalId)
      : undefined;
    const refundTenderKey = refund.tender
      ? refund.tender.externalId
        ? `${refund.tender.type}:${encodeURIComponent(refund.tender.externalId)}`
        : refund.tender.type
      : originalPayment
        ? tenderKey(originalPayment)
        : "unknown";
    const refundSource = originalPayment?.sourceChannel ?? refund.sourceChannel;

    updateRefundBucket(tenderBuckets, refundTenderKey, refund);
    updateRefundBucket(sourceBuckets, refundSource, refund);
  }

  const paymentAmountCents = dailyPayments.reduce(
    (total, payment) => addSafe(total, payment.amountCents),
    0,
  );
  const paymentTipCents = dailyPayments.reduce(
    (total, payment) => addSafe(total, payment.tipAmountCents),
    0,
  );
  const paymentTaxCents = dailyPayments.reduce(
    (total, payment) => addSafe(total, payment.taxAmountCents),
    0,
  );
  const totalCollectedCents = dailyPayments.reduce(
    (total, payment) => addSafe(total, payment.totalCollectedCents),
    0,
  );
  const refundAmountCents = dailyRefunds.reduce(
    (total, refund) => addSafe(total, refund.amountCents),
    0,
  );
  const refundTipCents = dailyRefunds.reduce(
    (total, refund) => addSafe(total, refund.tipAmountCents),
    0,
  );
  const refundTaxCents = dailyRefunds.reduce(
    (total, refund) => addSafe(total, refund.taxAmountCents),
    0,
  );

  return DailyControlTotalsSchema.parse({
    businessDate,
    timeZone,
    currency,
    orders: {
      count: dailyOrders.length,
      totalCents: dailyOrders.reduce(
        (total, order) => addSafe(total, order.totalCents),
        0,
      ),
      discountCents: dailyOrders.reduce(
        (total, order) => addSafe(total, order.discountAmountCents),
        0,
      ),
    },
    payments: {
      count: dailyPayments.length,
      failedCount: allDailyPayments.length - dailyPayments.length,
      offlineCount: dailyPayments.filter((payment) => payment.offline).length,
      amountCents: paymentAmountCents,
      tipCents: paymentTipCents,
      taxCents: paymentTaxCents,
      totalCollectedCents,
    },
    refunds: {
      count: dailyRefunds.length,
      amountCents: refundAmountCents,
      tipCents: refundTipCents,
      taxCents: refundTaxCents,
    },
    netCollectedCents: addSafe(totalCollectedCents, -refundAmountCents),
    tenders: bucketsToRecord(tenderBuckets),
    sources: bucketsToRecord(sourceBuckets),
  });
}

export const ReconciliationDifferenceSchema = z
  .object({
    metric: z.string().min(1),
    expected: CentsSchema,
    actual: CentsSchema,
    difference: CentsSchema,
    tolerance: NonNegativeCentsSchema,
  })
  .strict();

export const ReconciliationMetadataDifferenceSchema = z
  .object({
    field: z.enum(["businessDate", "timeZone", "currency"]),
    expected: z.string(),
    actual: z.string(),
  })
  .strict();

export const DailyReconciliationReportSchema = z
  .object({
    status: z.enum(["matched", "different"]),
    comparedMetricCount: CountSchema,
    differences: z.array(ReconciliationDifferenceSchema),
    metadataDifferences: z.array(ReconciliationMetadataDifferenceSchema),
  })
  .strict();

export type DailyReconciliationReport = z.infer<
  typeof DailyReconciliationReportSchema
>;

export interface ReconciliationTolerance {
  readonly cents?: number;
  readonly count?: number;
  readonly metrics?: Readonly<Record<string, number>>;
}

function flattenControls(
  controls: DailyControlTotals,
): Readonly<Record<string, number>> {
  const values: Record<string, number> = {
    "orders.count": controls.orders.count,
    "orders.totalCents": controls.orders.totalCents,
    "orders.discountCents": controls.orders.discountCents,
    "payments.count": controls.payments.count,
    "payments.failedCount": controls.payments.failedCount,
    "payments.offlineCount": controls.payments.offlineCount,
    "payments.amountCents": controls.payments.amountCents,
    "payments.tipCents": controls.payments.tipCents,
    "payments.taxCents": controls.payments.taxCents,
    "payments.totalCollectedCents": controls.payments.totalCollectedCents,
    "refunds.count": controls.refunds.count,
    "refunds.amountCents": controls.refunds.amountCents,
    "refunds.tipCents": controls.refunds.tipCents,
    "refunds.taxCents": controls.refunds.taxCents,
    netCollectedCents: controls.netCollectedCents,
  };

  for (const [key, bucket] of Object.entries(controls.tenders)) {
    for (const [metric, value] of Object.entries(bucket)) {
      values[`tenders.${key}.${metric}`] = value;
    }
  }
  for (const [key, bucket] of Object.entries(controls.sources)) {
    for (const [metric, value] of Object.entries(bucket)) {
      values[`sources.${key}.${metric}`] = value;
    }
  }

  return values;
}

function isCountMetric(metric: string): boolean {
  return metric.endsWith(".count") || metric.endsWith("Count");
}

export function reconcileDailyControlTotals(
  untrustedExpected: DailyControlTotals,
  untrustedActual: DailyControlTotals,
  tolerance: ReconciliationTolerance = {},
): DailyReconciliationReport {
  const expected = DailyControlTotalsSchema.parse(untrustedExpected);
  const actual = DailyControlTotalsSchema.parse(untrustedActual);
  const centsTolerance = NonNegativeCentsSchema.parse(tolerance.cents ?? 0);
  const countTolerance = CountSchema.parse(tolerance.count ?? 0);
  const metricTolerances = z
    .record(z.string(), NonNegativeCentsSchema)
    .parse(tolerance.metrics ?? {});

  const metadataDifferences = (
    ["businessDate", "timeZone", "currency"] as const
  )
    .filter((field) => expected[field] !== actual[field])
    .map((field) => ({
      field,
      expected: expected[field],
      actual: actual[field],
    }));

  const expectedMetrics = flattenControls(expected);
  const actualMetrics = flattenControls(actual);
  const metrics = [...new Set([
    ...Object.keys(expectedMetrics),
    ...Object.keys(actualMetrics),
  ])].sort();

  const differences = metrics.flatMap((metric) => {
    const expectedValue = expectedMetrics[metric] ?? 0;
    const actualValue = actualMetrics[metric] ?? 0;
    const allowedDifference =
      metricTolerances[metric] ??
      (isCountMetric(metric) ? countTolerance : centsTolerance);
    const difference = actualValue - expectedValue;

    return Math.abs(difference) <= allowedDifference
      ? []
      : [
          {
            metric,
            expected: expectedValue,
            actual: actualValue,
            difference,
            tolerance: allowedDifference,
          },
        ];
  });

  return DailyReconciliationReportSchema.parse({
    status:
      differences.length === 0 && metadataDifferences.length === 0
        ? "matched"
        : "different",
    comparedMetricCount: metrics.length,
    differences,
    metadataDifferences,
  });
}
