import { applyShipmentCoupon, validateShipForm, quoteShipment } from "@/lib/beanShipping";

describe("bean shipping form", () => {
  it("quotes one bag at $24.48 and waives shipping at five bags", () => {
    expect(quoteShipment(1)).toMatchObject({
      subtotal: 17.53,
      shipping: 6.95,
      total: 24.48,
    });
    expect(quoteShipment(2).shipping).toBe(7.95);
    expect(quoteShipment(4).shipping).toBe(9.95);
    expect(quoteShipment(5)).toMatchObject({
      shipping: 0,
      total: 87.65,
    });
  });

  it("applies DEVWBC and WBCLYTY to the coffee only", () => {
    expect(applyShipmentCoupon(quoteShipment(1), "devwbc")).toMatchObject({
      couponCode: "DEVWBC",
      percentOff: 90,
      discount: 15.78,
      shipping: 6.95,
      total: 8.7,
    });
    expect(applyShipmentCoupon(quoteShipment(1), "WBCLYTY").total).toBe(21.85);
    expect(applyShipmentCoupon(quoteShipment(1), "NOPE")).toBeNull();
  });

  it("requires city, state, and ZIP as separate fields", () => {
    const errors = validateShipForm({
      firstName: "Alex",
      lastName: "Smith",
      phone: "2405550148",
      email: "alex@example.com",
      line1: "123 Main St",
      line2: "Apt 4",
      city: "",
      state: "",
      postalCode: "",
    });
    expect(errors.city).toBeTruthy();
    expect(errors.state).toBeTruthy();
    expect(errors.postalCode).toBeTruthy();
  });

  it("accepts a Rockville address", () => {
    expect(
      validateShipForm({
        firstName: "Alex",
        lastName: "Smith",
        phone: "(240) 555-0148",
        email: "alex@example.com",
        line1: "123 Main St",
        line2: "Apt 4",
        city: "Rockville",
        state: "MD",
        postalCode: "20850",
      }),
    ).toEqual({});
  });
});
