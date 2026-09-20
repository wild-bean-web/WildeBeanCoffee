import { describe, expect, it } from "vitest";

import {
  businessDateInTimezone,
  costingFromPersistedPeriod,
  countSectionCodeForCategory,
  parseWasteReason,
  planCountLineMovement,
  planWasteQuantity,
  summarizePersistedPeriod,
  toDomainMovementType,
  toPersistedMovementType,
  wasteSourceSystem,
} from "./persistence";

const line = {
  countLineId: "11111111-1111-4111-8111-111111111111",
  productId: "22222222-2222-4222-8222-222222222222",
  uomId: "33333333-3333-4333-8333-333333333333",
} as const;

describe("inventory persistence mapping", () => {
  it("maps domain movement types onto the PostgreSQL enum", () => {
    expect(toPersistedMovementType("receipt")).toBe("goods_receipt");
    expect(toPersistedMovementType("sale_depletion")).toBe("sale");
    expect(toPersistedMovementType("count_gain")).toBe("count_adjustment");
    expect(toPersistedMovementType("count_loss")).toBe("count_adjustment");
    expect(toPersistedMovementType("waste")).toBe("waste");
    expect(toPersistedMovementType("opening_balance")).toBe("opening_balance");
  });

  it("restores count direction from the signed quantity", () => {
    expect(toDomainMovementType("count_adjustment", "2")).toBe("count_gain");
    expect(toDomainMovementType("count_adjustment", "-2")).toBe("count_loss");
    expect(toDomainMovementType("goods_receipt", "4")).toBe("receipt");
  });

  it("posts the first count as an opening balance and later counts as adjustments", () => {
    expect(
      planCountLineMovement({
        ...line,
        countedQuantity: "8",
        expectedQuantity: "0",
        hasOpeningBalance: false,
      }),
    ).toEqual({
      skip: false,
      movementType: "opening_balance",
      quantity: "8",
    });
    expect(
      planCountLineMovement({
        ...line,
        countedQuantity: "0",
        expectedQuantity: "0",
        hasOpeningBalance: false,
      }),
    ).toEqual({ skip: true, reason: "zero_quantity" });
    expect(
      planCountLineMovement({
        ...line,
        countedQuantity: "6",
        expectedQuantity: "8",
        hasOpeningBalance: true,
      }),
    ).toEqual({
      skip: false,
      movementType: "count_adjustment",
      quantity: "-2",
    });
    expect(
      planCountLineMovement({
        ...line,
        countedQuantity: "8",
        expectedQuantity: "8",
        hasOpeningBalance: true,
      }),
    ).toEqual({ skip: true, reason: "no_variance" });
  });

  it("stores waste as a negative quantity and encodes the reason in sourceSystem", () => {
    expect(planWasteQuantity("1.5")).toBe("-1.5");
    expect(wasteSourceSystem("unsold_pastry")).toBe(
      "manager_waste:unsold_pastry",
    );
    expect(parseWasteReason("manager_waste:spoilage")).toBe("spoilage");
    expect(parseWasteReason("manager_count")).toBeNull();
  });

  it("routes products onto the store walking path from category text", () => {
    expect(countSectionCodeForCategory("Dairy")).toBe("walk_in");
    expect(countSectionCodeForCategory("Espresso beans")).toBe("bar");
    expect(countSectionCodeForCategory("Frozen fruit")).toBe("freezer");
    expect(countSectionCodeForCategory("Cupware")).toBe("dry");
    expect(countSectionCodeForCategory(null)).toBe("dry");
  });

  it("derives the store business date in the location timezone", () => {
    expect(
      businessDateInTimezone(
        "2026-09-18T03:30:00.000Z",
        "America/New_York",
      ),
    ).toBe("2026-09-17");
  });

  it("assembles periodic costing from persisted rows without double-counting waste", () => {
    const summary = summarizePersistedPeriod([
      {
        movementType: "opening_balance",
        quantity: "10",
        unitCostCents: "100",
        extendedCostCents: null,
        sourceEventId: "open-1",
      },
      {
        movementType: "goods_receipt",
        quantity: "10",
        unitCostCents: "200",
        extendedCostCents: null,
        sourceEventId: "receipt-1",
      },
      {
        movementType: "waste",
        quantity: "-2",
        unitCostCents: null,
        extendedCostCents: null,
        sourceEventId: "waste-1",
      },
    ]);

    expect(summary.openingQuantity).toBe("10");
    expect(summary.openingValueCents).toBe(1_000);
    expect(summary.recordedWasteQuantity).toBe("2");

    const costing = costingFromPersistedPeriod(
      [
        {
          movementType: "opening_balance",
          quantity: "10",
          unitCostCents: "100",
          extendedCostCents: null,
          sourceEventId: "open-1",
        },
        {
          movementType: "goods_receipt",
          quantity: "10",
          unitCostCents: "200",
          extendedCostCents: null,
          sourceEventId: "receipt-1",
        },
        {
          movementType: "waste",
          quantity: "-2",
          unitCostCents: null,
          extendedCostCents: null,
          sourceEventId: "waste-1",
        },
      ],
      "8",
    );

    expect(costing?.cogsQuantity).toBe("10");
    expect(costing?.recordedWasteQuantity).toBe("2");
    expect(costing?.postingValueCents).toEqual({
      cogs: 1_500,
      waste: 300,
      endingInventory: 1_200,
    });
  });

  it("refuses to invent a valued close when a receipt has no cost", () => {
    expect(
      costingFromPersistedPeriod(
        [
          {
            movementType: "opening_balance",
            quantity: "1",
            unitCostCents: "100",
            extendedCostCents: null,
            sourceEventId: "open-1",
          },
          {
            movementType: "goods_receipt",
            quantity: "1",
            unitCostCents: null,
            extendedCostCents: null,
            sourceEventId: "receipt-1",
          },
        ],
        "1",
      ),
    ).toBeNull();
  });
});
