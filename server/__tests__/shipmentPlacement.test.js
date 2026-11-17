import { jest } from "@jest/globals";

const sendShipmentOrderEmail = jest.fn(async () => ({
  success: true,
  messageId: "test-shipment-email",
}));

jest.unstable_mockModule("../services/email.js", () => ({
  sendShipmentOrderEmail,
  sendVerificationCode: jest.fn(),
  sendPasswordResetCode: jest.fn(),
  verifyEmailConfig: jest.fn(async () => true),
}));

const { setupTestDB, teardownTestDB, clearDatabase } = await import("./setup.js");
const { createTestProduct } = await import("./helpers.js");
const { Product } = await import("../models/index.js");
const { placeOnlineOrder } = await import("../services/onlineOrderPlacement.js");

const address = {
  name: "Alex Smith",
  phone: "2405550148",
  line1: "123 Main St",
  line2: "Apt 4",
  city: "Rockville",
  state: "MD",
  postalCode: "20850",
  country: "US",
};

function shipBody(product, quantity, paymentRef, couponCode = "") {
  return {
    fulfillment: "ship",
    couponCode,
    customer: {
      name: "Alex Smith",
      phone: "2405550148",
      email: "alex@example.com",
    },
    items: [
      {
        itemType: "product",
        itemId: product._id.toString(),
        name: "Ethiopian Yirgacheffe",
        price: 1,
        quantity,
      },
    ],
    taxRate: 0,
    shipping: address,
    paymentStatus: "paid",
    paymentRef,
  };
}

describe("Paid Yirgacheffe shipment placement", () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearDatabase();
    sendShipmentOrderEmail.mockClear();
    await Product.deleteMany({ name: /yirgacheffe/i });
  });

  it("stores a one-bag paid shipment at $24.48 and emails the shop", async () => {
    const product = await createTestProduct({
      name: "Ethiopian Yirgacheffe",
      price: 17.53,
      inventory: 40,
      inStoreOnly: true,
    });
    const result = await placeOnlineOrder(
      shipBody(product, 1, `ship-one-${Date.now()}`),
      null,
      { skipPrint: true },
    );

    expect(result.ok).toBe(true);
    expect(result.order.fulfillment).toBe("ship");
    expect(result.order.pickupTime).toBeUndefined();
    expect(result.order.items[0].price).toBe(17.53);
    expect(result.order.totals).toMatchObject({
      subtotal: 17.53,
      tax: 0,
      shipping: 6.95,
      total: 24.48,
    });
    expect(result.order.shippingAddress).toMatchObject({
      line1: "123 Main St",
      line2: "Apt 4",
      city: "Rockville",
      state: "MD",
      postalCode: "20850",
    });
    expect(sendShipmentOrderEmail).toHaveBeenCalledTimes(1);
    expect(sendShipmentOrderEmail.mock.calls[0][0].totals.total).toBe(24.48);
  });

  it("stores a five-bag paid shipment with free shipping", async () => {
    const product = await createTestProduct({
      name: "Ethiopian Yirgacheffe",
      price: 17.53,
      inventory: 40,
      inStoreOnly: true,
    });
    const result = await placeOnlineOrder(
      shipBody(product, 5, `ship-five-${Date.now()}`),
      null,
      { skipPrint: true },
    );

    expect(result.ok).toBe(true);
    expect(result.order.totals).toMatchObject({
      subtotal: 87.65,
      shipping: 0,
      tax: 0,
      total: 87.65,
    });
    expect(sendShipmentOrderEmail).toHaveBeenCalledTimes(1);
  });

  it("charges $8.70 for one bag with DEVWBC", async () => {
    const product = await createTestProduct({
      name: "Ethiopian Yirgacheffe",
      price: 17.53,
      inventory: 40,
      inStoreOnly: true,
    });
    const result = await placeOnlineOrder(
      shipBody(product, 1, `ship-coupon-${Date.now()}`, "devwbc"),
      null,
      { skipPrint: true },
    );

    expect(result.ok).toBe(true);
    expect(result.order.couponCode).toBe("DEVWBC");
    expect(result.order.totals).toMatchObject({
      subtotal: 17.53,
      discount: 15.78,
      shipping: 6.95,
      total: 8.7,
    });
  });
});
