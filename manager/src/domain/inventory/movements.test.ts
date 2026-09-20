import { describe, expect, it } from "vitest";

import {
  createInventoryMovement,
  createInventoryReversal,
  inventoryQuantityImpact,
  type InventoryMovementInput,
  validateInventoryLedger,
  validateTransferPair,
} from "./movements";
import { createUnitDefinition } from "./uom";

const each = createUnitDefinition({
  code: "each",
  name: "each",
  symbol: "ea",
  dimension: "count",
  toBaseFactor: "1",
  definitionVersion: 1,
  quantityScale: 0,
});

const source = { eventType: "test_event", eventId: "event-1" } as const;

function movement(
  overrides: Partial<InventoryMovementInput> = {},
) {
  return createInventoryMovement({
    movementId: "movement-1",
    itemId: "coffee-bag",
    locationId: "store",
    occurredAt: "2026-09-17T12:00:00.000Z",
    movementType: "receipt",
    quantityDelta: "10",
    stockingUnit: each,
    unitCostCents: "425",
    source,
    ...overrides,
  });
}

describe("inventory movement invariants", () => {
  it("enforces movement direction by type", () => {
    expect(() =>
      movement({
        movementType: "sale_depletion",
        quantityDelta: "1",
      }),
    ).toThrow(/must have a negative quantity/);
    expect(() =>
      movement({
        movementType: "receipt",
        quantityDelta: "-1",
      }),
    ).toThrow(/must have a positive quantity/);

    expect(
      movement({
        movementType: "adjustment",
        quantityDelta: "-0.25",
      }).quantityDelta,
    ).toBe("-0.25");
  });

  it("requires transfers to have an ID and non-transfers not to have one", () => {
    expect(() =>
      movement({
        movementType: "transfer_out",
        quantityDelta: "-2",
      }),
    ).toThrow(/require a transferId/);
    expect(() => movement({ transferId: "transfer-1" })).toThrow(
      /Only transfer movements may have a transferId/,
    );
  });

  it("creates an immutable, exact compensating reversal", () => {
    const original = movement();
    const reversal = createInventoryReversal(original, {
      movementId: "reversal-1",
      occurredAt: "2026-09-18T12:00:00.000Z",
      reason: "duplicate receipt",
      source: { eventType: "manager_correction", eventId: "correction-1" },
      existingMovements: [original],
    });

    expect(reversal.quantityDelta).toBe("-10");
    expect(reversal.unitCostCents).toBe(original.unitCostCents);
    expect(reversal.reversalOfMovementId).toBe(original.movementId);
    expect(Object.isFrozen(reversal)).toBe(true);
    expect(inventoryQuantityImpact([original, reversal])).toBe("0");
    expect(validateInventoryLedger([original, reversal])).toHaveLength(2);
  });

  it("does not allow reversal chains or duplicate reversals", () => {
    const original = movement();
    const reversal = createInventoryReversal(original, {
      movementId: "reversal-1",
      occurredAt: "2026-09-18T12:00:00.000Z",
      reason: "mistake",
      source,
    });

    expect(() =>
      createInventoryReversal(original, {
        movementId: "reversal-2",
        occurredAt: "2026-09-19T12:00:00.000Z",
        reason: "again",
        source,
        existingMovements: [original, reversal],
      }),
    ).toThrow(/already been reversed/);
    expect(() =>
      createInventoryReversal(reversal, {
        movementId: "reversal-of-reversal",
        occurredAt: "2026-09-19T12:00:00.000Z",
        reason: "not allowed",
        source,
      }),
    ).toThrow(/cannot itself be reversed/);
  });

  it("rejects orphaned and inexact reversal records at ledger validation", () => {
    const original = movement();
    const orphan = movement({
      movementId: "orphan",
      movementType: "reversal",
      quantityDelta: "-10",
      reversalOfMovementId: "missing",
      reversalReason: "bad import",
    });
    const inexact = movement({
      movementId: "inexact",
      movementType: "reversal",
      quantityDelta: "-9",
      reversalOfMovementId: original.movementId,
      reversalReason: "bad import",
    });

    expect(() => validateInventoryLedger([orphan])).toThrow(/unknown movement/);
    expect(() => validateInventoryLedger([original, inexact])).toThrow(
      /exactly negate/,
    );
  });

  it("validates a complete, balanced transfer between locations", () => {
    const outbound = movement({
      movementId: "transfer-out",
      movementType: "transfer_out",
      quantityDelta: "-3.5",
      transferId: "transfer-1",
    });
    const inbound = movement({
      movementId: "transfer-in",
      locationId: "warehouse",
      movementType: "transfer_in",
      quantityDelta: "3.5",
      transferId: "transfer-1",
    });

    const pair = validateTransferPair(outbound, inbound);
    expect(pair.map((entry) => entry.movementType)).toEqual([
      "transfer_out",
      "transfer_in",
    ]);
    expect(inventoryQuantityImpact(pair)).toBe("0");
    expect(validateInventoryLedger(pair)).toHaveLength(2);
  });

  it("rejects incomplete, unbalanced, and one-sided transfer reversals", () => {
    const outbound = movement({
      movementId: "transfer-out",
      movementType: "transfer_out",
      quantityDelta: "-3",
      transferId: "transfer-1",
    });
    const inbound = movement({
      movementId: "transfer-in",
      locationId: "warehouse",
      movementType: "transfer_in",
      quantityDelta: "2",
      transferId: "transfer-1",
    });

    expect(() => validateInventoryLedger([outbound])).toThrow(
      /exactly two movements/,
    );
    expect(() => validateTransferPair(outbound, inbound)).toThrow(
      /equal and opposite/,
    );

    const correctedInbound = movement({
      movementId: "transfer-in-correct",
      locationId: "warehouse",
      movementType: "transfer_in",
      quantityDelta: "3",
      transferId: "transfer-1",
    });
    const repricedInbound = movement({
      movementId: "transfer-in-repriced",
      locationId: "warehouse",
      movementType: "transfer_in",
      quantityDelta: "3",
      transferId: "transfer-1",
      unitCostCents: "500",
    });
    expect(() => validateTransferPair(outbound, repricedInbound)).toThrow(
      /preserve the unit cost/,
    );

    const outboundReversal = createInventoryReversal(outbound, {
      movementId: "reverse-out",
      occurredAt: "2026-09-18T12:00:00.000Z",
      reason: "cancel transfer",
      source,
    });
    expect(() =>
      validateInventoryLedger([
        outbound,
        correctedInbound,
        outboundReversal,
      ]),
    ).toThrow(/reverse both sides together/);
  });
});
