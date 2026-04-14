import { parseHostedCheckoutPaymentApproved } from "../services/cloverHostedWebhook.js";

describe("parseHostedCheckoutPaymentApproved", () => {
  it("reads checkoutSessionId from Clover Hosted Checkout webhook shape", () => {
    const body = {
      type: "PAYMENT",
      id: "X5XZKQNHH1X2C",
      status: "APPROVED",
      merchantId: "GJVVGA478WZJ1",
      checkoutSessionId: "506dc250-9ee7-456c-a262-718c99405d23",
    };
    expect(parseHostedCheckoutPaymentApproved(body)).toEqual({
      checkoutSessionId: "506dc250-9ee7-456c-a262-718c99405d23",
      paymentId: "X5XZKQNHH1X2C",
    });
  });

  it("accepts session id in data string (legacy)", () => {
    const sid = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    expect(
      parseHostedCheckoutPaymentApproved({
        type: "PAYMENT",
        status: "APPROVED",
        id: "PAY123",
        data: sid,
      }),
    ).toEqual({ checkoutSessionId: sid, paymentId: "PAY123" });
  });

  it("accepts session id in data object", () => {
    const sid = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    expect(
      parseHostedCheckoutPaymentApproved({
        type: "PAYMENT",
        status: "APPROVED",
        id: "PAY456",
        data: { checkoutSessionId: sid },
      }),
    ).toEqual({ checkoutSessionId: sid, paymentId: "PAY456" });
  });

  it("returns null when session id is missing", () => {
    expect(
      parseHostedCheckoutPaymentApproved({
        type: "PAYMENT",
        status: "APPROVED",
        id: "X",
      }),
    ).toBeNull();
  });
});
