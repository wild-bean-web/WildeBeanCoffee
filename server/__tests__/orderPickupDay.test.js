import {
  canUnmarkPickedUp,
  getStoreCalendarDate,
} from "../utils/orderPickupDay.js";

describe("orderPickupDay", () => {
  const storeTz = "America/New_York";

  it("formats calendar dates in store timezone", () => {
    // 2026-08-16 23:30 UTC = still Aug 16 evening ET
    expect(getStoreCalendarDate("2026-08-16T23:30:00.000Z", storeTz)).toBe(
      "2026-08-16",
    );
    // 2026-08-17 03:30 UTC = Aug 16 evening ET (EDT)
    expect(getStoreCalendarDate("2026-08-17T03:30:00.000Z", storeTz)).toBe(
      "2026-08-16",
    );
  });

  it("allows unmark only for completed orders on the pickup day", () => {
    const pickupTime = "2026-08-16T19:00:00.000Z"; // 3 PM ET
    const order = {
      status: "completed",
      paymentStatus: "paid",
      pickupTime,
      createdAt: "2026-08-16T15:00:00.000Z",
    };

    expect(
      canUnmarkPickedUp(order, new Date("2026-08-16T20:00:00.000Z")),
    ).toBe(true);
    expect(
      canUnmarkPickedUp(order, new Date("2026-08-17T14:00:00.000Z")),
    ).toBe(false);
    expect(
      canUnmarkPickedUp(
        { ...order, status: "ready" },
        new Date("2026-08-16T20:00:00.000Z"),
      ),
    ).toBe(false);
  });

  it("falls back to createdAt when pickupTime is missing", () => {
    const order = {
      status: "completed",
      paymentStatus: "paid",
      createdAt: "2026-08-16T15:00:00.000Z",
    };
    expect(
      canUnmarkPickedUp(order, new Date("2026-08-16T22:00:00.000Z")),
    ).toBe(true);
    expect(
      canUnmarkPickedUp(order, new Date("2026-08-17T15:00:00.000Z")),
    ).toBe(false);
  });
});
