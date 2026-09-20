import { describe, expect, it } from "vitest";

import {
  createInventoryMovement,
  createInventoryReversal,
} from "./movements";
import { createUnitDefinition } from "./uom";
import {
  calculatePeriodicWeightedAverage,
  summarizeDepletionMovements,
} from "./valuation";

describe("periodic weighted-average valuation", () => {
  it("weights opening value and received costs", () => {
    const result = calculatePeriodicWeightedAverage({
      opening: { quantity: "100", valueCents: 10_000 },
      receivedLayers: [
        { receiptEventId: "receipt-1", quantity: "100", valueCents: 14_000 },
      ],
      closingQuantity: "50",
      recordedWasteQuantity: "10",
    });

    expect(result.availableQuantity).toBe("200");
    expect(result.availableValueCents).toBe(24_000);
    expect(result.averageUnitCostCents).toBe("120");
    expect(result.physicalDepletionQuantity).toBe("150");
    expect(result.cogsQuantity).toBe("140");
    expect(result.exactValueCents).toEqual({
      cogs: "16800",
      waste: "1200",
      endingInventory: "6000",
    });
    expect(result.postingValueCents).toEqual({
      cogs: 16_800,
      waste: 1_200,
      endingInventory: 6_000,
    });
  });

  it("separates waste from sale depletion instead of double-counting it", () => {
    const result = calculatePeriodicWeightedAverage({
      opening: { quantity: "10", valueCents: 1_000 },
      receivedLayers: [],
      closingQuantity: "4",
      recordedWasteQuantity: "2",
    });

    expect(result.physicalDepletionQuantity).toBe("6");
    expect(result.cogsQuantity).toBe("4");
    expect(result.postingValueCents.cogs).toBe(400);
    expect(result.postingValueCents.waste).toBe(200);
    expect(
      result.postingValueCents.cogs +
        result.postingValueCents.waste +
        result.postingValueCents.endingInventory,
    ).toBe(result.availableValueCents);
  });

  it("uses deterministic largest-remainder cent allocation", () => {
    const result = calculatePeriodicWeightedAverage({
      opening: { quantity: "3", valueCents: 1 },
      receivedLayers: [],
      closingQuantity: "1",
      recordedWasteQuantity: "1",
    });

    expect(result.exactValueCents.cogs).toMatch(/^0\.333/);
    expect(result.postingValueCents).toEqual({
      cogs: 1,
      waste: 0,
      endingInventory: 0,
    });
  });

  it("handles an empty period without dividing by zero", () => {
    expect(
      calculatePeriodicWeightedAverage({
        opening: { quantity: "0", valueCents: 0 },
        receivedLayers: [],
        closingQuantity: "0",
        recordedWasteQuantity: "0",
      }),
    ).toMatchObject({
      averageUnitCostCents: "0",
      cogsQuantity: "0",
      availableValueCents: 0,
    });
  });

  it("rejects impossible physical balances", () => {
    expect(() =>
      calculatePeriodicWeightedAverage({
        opening: { quantity: "10", valueCents: 500 },
        receivedLayers: [],
        closingQuantity: "11",
        recordedWasteQuantity: "0",
      }),
    ).toThrow(/Closing quantity cannot exceed/);

    expect(() =>
      calculatePeriodicWeightedAverage({
        opening: { quantity: "10", valueCents: 500 },
        receivedLayers: [],
        closingQuantity: "8",
        recordedWasteQuantity: "3",
      }),
    ).toThrow(/waste cannot exceed/);
  });

  it("rejects zero quantity with value and duplicate receipt layers", () => {
    expect(() =>
      calculatePeriodicWeightedAverage({
        opening: { quantity: "0", valueCents: 1 },
        receivedLayers: [],
        closingQuantity: "0",
        recordedWasteQuantity: "0",
      }),
    ).toThrow(/Zero opening quantity/);

    expect(() =>
      calculatePeriodicWeightedAverage({
        opening: { quantity: "0", valueCents: 0 },
        receivedLayers: [
          { receiptEventId: "same", quantity: "1", valueCents: 10 },
          { receiptEventId: "same", quantity: "1", valueCents: 10 },
        ],
        closingQuantity: "2",
        recordedWasteQuantity: "0",
      }),
    ).toThrow(/must be unique/);
  });
});

describe("movement depletion classification", () => {
  const gram = createUnitDefinition({
    code: "g",
    name: "gram",
    symbol: "g",
    dimension: "mass",
    toBaseFactor: "1",
    definitionVersion: 1,
    quantityScale: 3,
  });
  const source = { eventType: "test", eventId: "source" } as const;

  it("keeps waste out of COGS and applies reversals to the original category", () => {
    const sale = createInventoryMovement({
      movementId: "sale",
      itemId: "beans",
      locationId: "store",
      occurredAt: "2026-09-17T10:00:00.000Z",
      movementType: "sale_depletion",
      quantityDelta: "-3",
      stockingUnit: gram,
      source,
    });
    const waste = createInventoryMovement({
      movementId: "waste",
      itemId: "beans",
      locationId: "store",
      occurredAt: "2026-09-17T11:00:00.000Z",
      movementType: "waste",
      quantityDelta: "-2",
      stockingUnit: gram,
      source,
    });
    const reverseWaste = createInventoryReversal(waste, {
      movementId: "reverse-waste",
      occurredAt: "2026-09-17T12:00:00.000Z",
      reason: "duplicate waste report",
      source,
    });

    expect(summarizeDepletionMovements([sale, waste, reverseWaste])).toEqual({
      cogsQuantity: "3",
      wasteQuantity: "0",
      totalPhysicalDepletionQuantity: "3",
    });
  });
});
