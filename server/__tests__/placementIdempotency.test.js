import request from "supertest";
import { createTestApp } from "./app.js";
import { setupTestDB, teardownTestDB, clearDatabase } from "./setup.js";
import {
  createTestMenuItem,
  createTestLocation,
  buildPaidOrderFields,
  futurePickupWithinStoreHours,
} from "./helpers.js";
import { HostedCheckoutDraft, Order } from "../models/index.js";
import { placeOnlineOrder } from "../services/onlineOrderPlacement.js";

const app = createTestApp();

describe("Hosted checkout placement idempotency", () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearDatabase();
    await createTestLocation();
  });

  it("creates only one order when two paid placements race on the same checkoutSessionId", async () => {
    const menuItem = await createTestMenuItem({
      name: "Latte",
      price: 5.99,
      available: true,
      active: true,
    });
    const checkoutSessionId = `race-checkout-${Date.now()}`;
    const pickupTime = futurePickupWithinStoreHours();
    const orderBody = {
      customer: {
        name: "Race Tester",
        phone: "555-111-2222",
        email: "race@example.com",
      },
      items: [
        {
          itemType: "menu",
          itemId: menuItem._id.toString(),
          name: menuItem.name,
          price: menuItem.price,
          quantity: 1,
        },
      ],
      taxRate: 0.0875,
      pickupTime,
      ...buildPaidOrderFields(checkoutSessionId),
    };

    await HostedCheckoutDraft.create({
      checkoutSessionId,
      orderDraft: orderBody,
      amountCents: 651,
      paymentApprovedAt: new Date(),
      status: "pending",
    });

    const [a, b] = await Promise.all([
      placeOnlineOrder(orderBody, null, {
        skipPrint: true,
        hostedCheckoutPaidPlacementBypassPickupScheduling: true,
      }),
      placeOnlineOrder(orderBody, null, {
        skipPrint: true,
        hostedCheckoutPaidPlacementBypassPickupScheduling: true,
      }),
    ]);

    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(String(a.order._id)).toBe(String(b.order._id));
    expect(a.idempotent || b.idempotent).toBe(true);

    const count = await Order.countDocuments({ paymentRef: checkoutSessionId });
    expect(count).toBe(1);

    const draft = await HostedCheckoutDraft.findOne({ checkoutSessionId }).lean();
    expect(draft.status).toBe("fulfilled");
    expect(String(draft.fulfilledOrderId)).toBe(String(a.order._id));
  });

  it("returns the same order on sequential recover-hosted-checkout calls", async () => {
    const menuItem = await createTestMenuItem({
      name: "Cappuccino",
      price: 4.5,
      available: true,
      active: true,
    });
    const checkoutSessionId = `recover-${Date.now()}`;
    const orderBody = {
      customer: {
        name: "Recover Tester",
        phone: "555-333-4444",
        email: "recover@example.com",
      },
      items: [
        {
          itemType: "menu",
          itemId: menuItem._id.toString(),
          name: menuItem.name,
          price: menuItem.price,
          quantity: 1,
        },
      ],
      taxRate: 0.0875,
      pickupTime: futurePickupWithinStoreHours(),
      ...buildPaidOrderFields(checkoutSessionId),
    };

    await HostedCheckoutDraft.create({
      checkoutSessionId,
      orderDraft: {
        customer: orderBody.customer,
        items: orderBody.items,
        taxRate: orderBody.taxRate,
        pickupTime: orderBody.pickupTime,
      },
      amountCents: 490,
      paymentApprovedAt: new Date(),
      status: "pending",
    });

    const first = await request(app)
      .post("/api/orders/recover-hosted-checkout")
      .send({ checkoutId: checkoutSessionId });
    const second = await request(app)
      .post("/api/orders/recover-hosted-checkout")
      .send({ checkoutId: checkoutSessionId });

    expect(first.status).toBeLessThan(300);
    expect(second.status).toBe(200);
    expect(first.body.data._id).toBe(second.body.data._id);
    expect(await Order.countDocuments({ paymentRef: checkoutSessionId })).toBe(1);
  });
});
