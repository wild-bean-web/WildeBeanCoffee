import { applyShipmentCoupon, quoteShipment, validateShippingAddress } from "../config/shipping.js";
import { formatReceiptContent } from "../services/clover.js";
import {
  cloverCustomerFields,
  lastNameForClover,
  phoneDigitsForClover,
} from "../utils/cloverCustomer.js";

describe("Yirgacheffe shipment quote and address", () => {
  it("charges $17.53 plus $6.95 for one bag and no tax", () => {
    const quote = quoteShipment(1);
    expect(quote.ok).toBe(true);
    expect(quote.subtotal).toBe(17.53);
    expect(quote.shipping).toBe(6.95);
    expect(quote.taxCents).toBe(0);
    expect(quote.totalCents).toBe(2448);
  });

  it("takes 90% off the coffee for DEVWBC and leaves shipping in place", () => {
    const quote = applyShipmentCoupon(quoteShipment(1), "devwbc");
    expect(quote.ok).toBe(true);
    expect(quote.discountCents).toBe(1578);
    expect(quote.shippingCents).toBe(695);
    expect(quote.totalCents).toBe(870);
  });

  it("takes 15% off the coffee for WBCLYTY", () => {
    const quote = applyShipmentCoupon(quoteShipment(1), "WBCLYTY");
    expect(quote.discount).toBe(2.63);
    expect(quote.total).toBe(21.85);
  });

  it("rejects an unknown coupon code", () => {
    const quote = applyShipmentCoupon(quoteShipment(1), "NOPE");
    expect(quote.ok).toBe(false);
  });

  it("steps shipping by bag count and drops it at five bags", () => {
    expect(quoteShipment(2).shippingCents).toBe(795);
    expect(quoteShipment(3).shippingCents).toBe(795);
    expect(quoteShipment(4).totalCents).toBe(1753 * 4 + 995);
    expect(quoteShipment(5).shippingCents).toBe(0);
    expect(quoteShipment(5).totalCents).toBe(1753 * 5);
    expect(quoteShipment(6).shippingCents).toBe(0);
  });

  it("rejects a P.O. Box and a state outside the contiguous US", () => {
    const po = validateShippingAddress({
      name: "Alex Smith",
      phone: "(240) 555-0148",
      line1: "PO Box 12",
      city: "Rockville",
      state: "MD",
      postalCode: "20850",
    });
    expect(po.ok).toBe(false);
    expect(po.errors.join(" ")).toMatch(/P\.O\. Boxes/);

    const hawaii = validateShippingAddress({
      name: "Alex Smith",
      phone: "2405550148",
      line1: "123 Main St",
      city: "Honolulu",
      state: "HI",
      postalCode: "96813",
    });
    expect(hawaii.ok).toBe(false);
  });

  it("prints the ship-to address and free shipping on a five-bag slip", () => {
    const lines = formatReceiptContent({
      _id: "abcdef1234567890",
      fulfillment: "ship",
      customer: { name: "Alex Smith", phone: "2405550148" },
      shippingAddress: {
        line1: "123 Main St",
        line2: "Apt 4",
        city: "Rockville",
        state: "MD",
        postalCode: "20850",
      },
      items: [{ name: "Ethiopian Yirgacheffe", quantity: 5, price: 17.53 }],
      totals: { subtotal: 87.65, tax: 0, shipping: 0, tip: 0, total: 87.65 },
      paymentStatus: "paid",
    });
    const text = lines.map((line) => line.text).join("\n");
    expect(text).toContain("SHIP ORDER");
    expect(text).toContain("SHIP TO");
    expect(text).toContain("123 Main St");
    expect(text).toContain("Rockville, MD 20850");
    expect(text).toContain("Shipping: Free");
  });

  it("accepts an apartment in a contiguous state", () => {
    const result = validateShippingAddress({
      name: "Alex Smith",
      phone: "1 (240) 555-0148",
      line1: "123 Main St",
      line2: "Apt 4",
      city: "Rockville",
      state: "md",
      postalCode: "20850",
    });
    expect(result.ok).toBe(true);
    expect(result.address).toMatchObject({
      phone: "2405550148",
      line2: "Apt 4",
      state: "MD",
      country: "US",
    });
  });
});

describe("Clover customer fields for Apple Pay", () => {
  it("refuses a blank or placeholder last name", () => {
    expect(() => lastNameForClover("")).toThrow(/Last name/);
    expect(() => lastNameForClover(".")).toThrow(/Last name/);
  });

  it("sends a 10-digit phone and a real last name", () => {
    expect(phoneDigitsForClover("(240) 555-0148")).toBe("2405550148");
    expect(
      cloverCustomerFields({
        firstName: "Alex",
        lastName: "Smith",
        email: "alex@example.com",
        phone: "240-555-0148",
      }),
    ).toEqual({
      firstName: "Alex",
      lastName: "Smith",
      email: "alex@example.com",
      phoneNumber: "2405550148",
    });
  });
});
