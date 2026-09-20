import { createHmac } from "node:crypto";
import {
  buildSanitizedOrderEvent,
  signManagerOutboxBody,
} from "../services/managerOutbox.js";

describe("manager outbox", () => {
  const order = {
    _id: "507f1f77bcf86cd799439011",
    paymentRef: "clover-payment-1",
    paymentStatus: "paid",
    status: "placed",
    customer: {
      name: "Private Customer",
      phone: "555-0100",
      email: "private@example.com",
    },
    notes: "Customer private note",
    items: [
      {
        itemType: "menu",
        itemId: "507f1f77bcf86cd799439012",
        name: "Latte",
        price: 5.25,
        quantity: 1,
        modifierTotal: 0.75,
        modifiers: [
          {
            modifierGroupName: "Milk",
            selectedOptions: [
              { name: "Oat milk", price: 0.75, quantity: 1 },
            ],
          },
        ],
      },
    ],
    totals: {
      subtotal: 6,
      tax: 0.36,
      tip: 1,
      total: 7.36,
      currency: "usd",
    },
    createdAt: new Date("2026-09-18T01:00:00.000Z"),
    updatedAt: new Date("2026-09-18T01:01:00.000Z"),
  };

  it("copies operational facts without customer PII", () => {
    const event = buildSanitizedOrderEvent(
      order,
      "website.order.paid",
      "d8362386-f9a5-4ef2-a474-7c092ccde71e",
    );

    expect(event.order.items[0].modifiers[0].selectedOptions[0]).toEqual({
      name: "Oat milk",
      price: 0.75,
      quantity: 1,
    });
    expect(event.order.totals.currency).toBe("USD");
    expect(event).not.toHaveProperty("order.customer");
    expect(event).not.toHaveProperty("order.notes");
    expect(JSON.stringify(event)).not.toContain("private@example.com");
  });

  it("signs the timestamp and exact JSON body", () => {
    const body = JSON.stringify({ eventId: "one" });
    const secret = "a".repeat(32);
    const header = signManagerOutboxBody(body, secret, 1234);
    const expected = createHmac("sha256", secret)
      .update(`1234.${body}`, "utf8")
      .digest("hex");
    expect(header).toBe(`t=1234,v1=${expected}`);
  });
});
