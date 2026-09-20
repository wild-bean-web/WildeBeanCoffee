import { describe, expect, it } from "vitest";

import {
  normalizeCloverOrder,
  normalizeCloverPayment,
  normalizeCloverRefund,
} from "../normalization";
import {
  calculateDailyControlTotals,
  reconcileDailyControlTotals,
} from "../reconciliation";
import { NormalizedPaymentSchema } from "../schemas";
import {
  cloverOrderFixture,
  cloverPaymentFixture,
  cloverRefundFixture,
  failedCloverPaymentFixture,
  fixtureMerchantId,
} from "./fixtures/clover";

const paymentContext = {
  merchantId: fixtureMerchantId,
  currency: "USD",
  sourceChannel: "online",
} as const;

describe("Clover normalization", () => {
  it("normalizes cents, items, modifiers, discounts, taxes, and source", () => {
    const order = normalizeCloverOrder(cloverOrderFixture, {
      merchantId: fixtureMerchantId,
    });

    expect(order.currency).toBe("USD");
    expect(order.sourceChannel).toBe("online");
    expect(order.sourceChannelRaw).toBe("ONLINE");
    expect(order.lineItemGrossCents).toBe(1175);
    expect(order.lineItemNetCents).toBe(1075);
    expect(order.discountAmountCents).toBe(100);

    expect(order.lineItems[0]).toMatchObject({
      quantity: 1,
      unitPriceCents: 500,
      baseAmountCents: 500,
      modifierAmountCents: 75,
      grossAmountCents: 575,
      discountAmountCents: 100,
      netAmountCents: 475,
    });
    expect(order.lineItems[0]?.modifiers[0]).toMatchObject({
      name: "Oat milk",
      amountCents: 75,
      catalogModifierExternalId: "MODIFIER_OAT",
    });
    expect(order.lineItems[0]?.discounts).toEqual([
      expect.objectContaining({
        amountCents: 50,
        scope: "line_item",
      }),
      expect.objectContaining({
        amountCents: 50,
        scope: "order",
      }),
    ]);
    expect(order.lineItems[1]).toMatchObject({
      quantity: 1.5,
      baseAmountCents: 600,
      grossAmountCents: 600,
    });
    expect(order.taxes[0]).toMatchObject({
      rateBasisPoints: 800,
      taxableAmountCents: 1075,
      amountCents: 86,
    });
  });

  it("normalizes payments, tips, tenders, and de-duplicated refunds", () => {
    const order = normalizeCloverOrder(cloverOrderFixture, {
      merchantId: fixtureMerchantId,
    });
    const payment = order.payments[0];
    const refund = order.refunds[0];

    expect(payment).toMatchObject({
      status: "SUCCESS",
      amountCents: 1161,
      subtotalAmountCents: 1075,
      taxAmountCents: 86,
      tipAmountCents: 200,
      totalCollectedCents: 1361,
      refundedAmountCents: 400,
      netCollectedCents: 961,
      additionalChargeAmountCents: 25,
      tender: {
        type: "card",
        cardBrand: "VISA",
      },
    });
    expect(refund).toMatchObject({
      amountCents: 400,
      subtotalAmountCents: 320,
      taxAmountCents: 30,
      tipAmountCents: 50,
      paymentExternalId: "PAYMENT123",
    });
    expect(order.refunds).toHaveLength(1);
    expect(order.netCollectedCents).toBe(961);
  });

  it("rejects fractional cents instead of silently rounding money", () => {
    expect(() =>
      normalizeCloverPayment(
        {
          ...cloverPaymentFixture,
          amount: 1161.5,
        },
        paymentContext,
      ),
    ).toThrow();
  });
});

describe("daily Clover control totals and reconciliation", () => {
  it("calculates merchant-day controls without double-counting replays", () => {
    const order = normalizeCloverOrder(cloverOrderFixture, {
      merchantId: fixtureMerchantId,
    });
    const successfulPayment = normalizeCloverPayment(
      cloverPaymentFixture,
      paymentContext,
    );
    const failedPayment = normalizeCloverPayment(
      failedCloverPaymentFixture,
      paymentContext,
    );
    const refund = normalizeCloverRefund(
      cloverRefundFixture,
      paymentContext,
    );

    const totals = calculateDailyControlTotals({
      businessDate: "2026-09-17",
      timeZone: "UTC",
      currency: "usd",
      orders: [order, order],
      payments: [successfulPayment, failedPayment, successfulPayment],
      refunds: [refund],
    });

    expect(totals).toMatchObject({
      businessDate: "2026-09-17",
      currency: "USD",
      orders: {
        count: 1,
        totalCents: 1161,
        discountCents: 100,
      },
      payments: {
        count: 1,
        failedCount: 1,
        offlineCount: 0,
        amountCents: 1161,
        tipCents: 200,
        taxCents: 86,
        totalCollectedCents: 1361,
      },
      refunds: {
        count: 1,
        amountCents: 400,
        tipCents: 50,
        taxCents: 30,
      },
      netCollectedCents: 961,
    });
    expect(totals.tenders["card:TENDER_CARD"]).toEqual({
      paymentCount: 1,
      refundCount: 1,
      grossCents: 1361,
      refundCents: 400,
      netCents: 961,
    });
    expect(totals.sources.online).toEqual({
      paymentCount: 1,
      refundCount: 1,
      grossCents: 1361,
      refundCents: 400,
      netCents: 961,
    });
  });

  it("uses the configured business timezone at UTC date boundaries", () => {
    const payment = NormalizedPaymentSchema.parse({
      ...normalizeCloverPayment(cloverPaymentFixture, paymentContext),
      externalId: "PAYMENT_LATE",
      occurredAt: "2026-09-18T02:00:00.000Z",
      refunds: [],
      refundedAmountCents: 0,
      netCollectedCents: 1361,
    });

    const totals = calculateDailyControlTotals({
      businessDate: "2026-09-17",
      timeZone: "America/New_York",
      currency: "USD",
      payments: [payment],
    });

    expect(totals.payments.count).toBe(1);
  });

  it("reports exact differences and supports explicit tolerances", () => {
    const payment = normalizeCloverPayment(
      cloverPaymentFixture,
      paymentContext,
    );
    const expected = calculateDailyControlTotals({
      businessDate: "2026-09-17",
      timeZone: "UTC",
      currency: "USD",
      payments: [payment],
    });
    const actual = {
      ...expected,
      payments: {
        ...expected.payments,
        amountCents: expected.payments.amountCents + 2,
      },
    };

    const report = reconcileDailyControlTotals(expected, actual);
    expect(report.status).toBe("different");
    expect(report.differences).toContainEqual({
      metric: "payments.amountCents",
      expected: 1161,
      actual: 1163,
      difference: 2,
      tolerance: 0,
    });

    expect(
      reconcileDailyControlTotals(expected, actual, {
        metrics: { "payments.amountCents": 2 },
      }).status,
    ).toBe("matched");
  });
});
