import { describe, expect, it } from "vitest";
import {
  signStorefrontEvent,
  StorefrontOutboxEventSchema,
  verifyStorefrontEventSignature,
} from ".";

const event = {
  schemaVersion: 1,
  eventId: "d8362386-f9a5-4ef2-a474-7c092ccde71e",
  eventType: "website.order.paid",
  organizationSlug: "wild-bean-coffee",
  occurredAt: "2026-09-18T01:00:00.000Z",
  order: {
    id: "order-1",
    paymentRef: "clover-payment-1",
    paymentStatus: "paid",
    status: "placed",
    source: "wild_bean_website",
    items: [
      {
        lineId: "line-1",
        itemType: "menu",
        itemId: "latte",
        name: "Latte",
        price: 5.25,
        quantity: 1,
        modifierTotal: 0,
        modifiers: [],
        loyaltyRewardApplied: false,
      },
    ],
    totals: {
      subtotal: 5.25,
      tax: 0.32,
      tip: 1,
      total: 6.57,
      currency: "USD",
    },
    createdAt: "2026-09-18T01:00:00.000Z",
    updatedAt: "2026-09-18T01:00:00.000Z",
  },
} as const;

describe("storefront outbox contract", () => {
  it("accepts a sanitized paid order event", () => {
    expect(StorefrontOutboxEventSchema.parse(event).eventId).toBe(
      event.eventId,
    );
  });

  it("rejects additional customer data", () => {
    expect(() =>
      StorefrontOutboxEventSchema.parse({
        ...event,
        customer: { email: "customer@example.com" },
      }),
    ).toThrow();
  });

  it("authenticates the exact body and timestamp", () => {
    const body = JSON.stringify(event);
    const signature = signStorefrontEvent(body, "a".repeat(32), 1000);
    expect(
      verifyStorefrontEventSignature({
        rawBody: body,
        signature,
        secret: "a".repeat(32),
        nowMs: 1_000_000,
      }),
    ).toBe(true);
    expect(
      verifyStorefrontEventSignature({
        rawBody: `${body} `,
        signature,
        secret: "a".repeat(32),
        nowMs: 1_000_000,
      }),
    ).toBe(false);
  });
});
