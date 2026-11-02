import { selectHostedCheckoutPayment } from "../services/hostedCheckoutPaymentMatch.js";

describe("selectHostedCheckoutPayment", () => {
  const draftCreated = new Date("2026-09-24T23:00:00.000Z");
  const ashleyDraft = {
    createdAt: draftCreated,
    amountCents: 880,
    orderDraft: {
      items: [{ name: "Iced Mango Matcha Latte", price: 8.3, quantity: 1 }],
    },
  };

  it("matches Clover's pretax charge when the draft total includes tax", () => {
    const result = selectHostedCheckoutPayment(
      [
        {
          id: "YSY7FXZNH2N7A",
          amount: 830,
          result: "SUCCESS",
          createdTime: new Date("2026-09-24T23:04:23.000Z").getTime(),
          employee: { id: "DFLTEMPLOYEE" },
        },
      ],
      ashleyDraft,
      new Date("2026-09-24T23:10:00.000Z").getTime(),
    );
    expect(result).toEqual({ ok: true, paymentId: "YSY7FXZNH2N7A" });
  });

  it("does not treat a same-priced in-store tap as this website checkout", () => {
    const result = selectHostedCheckoutPayment(
      [
        {
          id: "INSTORE",
          amount: 830,
          result: "SUCCESS",
          createdTime: new Date("2026-09-24T23:04:23.000Z").getTime(),
          employee: { id: "ADELINE" },
        },
      ],
      ashleyDraft,
      new Date("2026-09-24T23:10:00.000Z").getTime(),
    );
    expect(result).toEqual({ ok: false, reason: "no_match" });
  });

  it("does not match a later website order with the same pretax amount", () => {
    const result = selectHostedCheckoutPayment(
      [
        {
          id: "LATER",
          amount: 830,
          result: "SUCCESS",
          createdTime: new Date("2026-09-25T18:00:00.000Z").getTime(),
          employee: { id: "DFLTEMPLOYEE" },
        },
      ],
      ashleyDraft,
      new Date("2026-09-25T18:05:00.000Z").getTime(),
    );
    expect(result).toEqual({ ok: false, reason: "no_match" });
  });

  it("refuses two website charges for the same amount in the checkout window", () => {
    const paidAt = new Date("2026-09-24T23:04:23.000Z").getTime();
    const result = selectHostedCheckoutPayment(
      [
        {
          id: "ONE",
          amount: 830,
          result: "SUCCESS",
          createdTime: paidAt,
          employee: { id: "DFLTEMPLOYEE" },
        },
        {
          id: "TWO",
          amount: 830,
          result: "SUCCESS",
          createdTime: paidAt + 60 * 1000,
          employee: { id: "DFLTEMPLOYEE" },
        },
      ],
      ashleyDraft,
      paidAt + 5 * 60 * 1000,
    );
    expect(result).toEqual({ ok: false, reason: "ambiguous" });
  });
});
