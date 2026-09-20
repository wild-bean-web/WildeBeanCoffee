import { z } from "zod";

import {
  canonicalDecimal,
  deepFreeze,
  DomainDecimal,
  NonNegativeDecimalStringSchema,
  NonZeroDecimalStringSchema,
  UnitDefinitionSchema,
  type DeepReadonly,
  type UnitDefinition,
} from "./uom";

export const InventoryMovementTypeSchema = z.enum([
  "opening_balance",
  "receipt",
  "customer_return",
  "transfer_in",
  "production_output",
  "count_gain",
  "sale_depletion",
  "waste",
  "vendor_return",
  "transfer_out",
  "production_input",
  "count_loss",
  "adjustment",
  "reversal",
]);

export type InventoryMovementType = z.infer<
  typeof InventoryMovementTypeSchema
>;

const POSITIVE_MOVEMENT_TYPES = new Set<InventoryMovementType>([
  "opening_balance",
  "receipt",
  "customer_return",
  "transfer_in",
  "production_output",
  "count_gain",
]);

const NEGATIVE_MOVEMENT_TYPES = new Set<InventoryMovementType>([
  "sale_depletion",
  "waste",
  "vendor_return",
  "transfer_out",
  "production_input",
  "count_loss",
]);

export const MovementSourceSchema = z.strictObject({
  eventType: z.string().trim().min(1).max(80),
  eventId: z.string().trim().min(1).max(160),
});

export const InventoryMovementSchema = z
  .strictObject({
    movementId: z.string().trim().min(1).max(160),
    itemId: z.string().trim().min(1).max(160),
    locationId: z.string().trim().min(1).max(160),
    occurredAt: z.string().datetime({ offset: true }),
    movementType: InventoryMovementTypeSchema,
    /**
     * Signed quantity in the snapshotted stocking unit. Inbound is positive
     * and outbound is negative.
     */
    quantityDelta: NonZeroDecimalStringSchema,
    stockingUnit: UnitDefinitionSchema,
    unitCostCents: NonNegativeDecimalStringSchema.optional(),
    source: MovementSourceSchema,
    transferId: z.string().trim().min(1).max(160).optional(),
    reversalOfMovementId: z.string().trim().min(1).max(160).optional(),
    reversalReason: z.string().trim().min(1).max(500).optional(),
    note: z.string().trim().min(1).max(500).optional(),
  })
  .superRefine((movement, context) => {
    const quantity = new DomainDecimal(movement.quantityDelta);

    if (
      POSITIVE_MOVEMENT_TYPES.has(movement.movementType) &&
      !quantity.isPositive()
    ) {
      context.addIssue({
        code: "custom",
        path: ["quantityDelta"],
        message: `${movement.movementType} must have a positive quantity`,
      });
    }

    if (
      NEGATIVE_MOVEMENT_TYPES.has(movement.movementType) &&
      !quantity.isNegative()
    ) {
      context.addIssue({
        code: "custom",
        path: ["quantityDelta"],
        message: `${movement.movementType} must have a negative quantity`,
      });
    }

    const isTransfer =
      movement.movementType === "transfer_in" ||
      movement.movementType === "transfer_out";
    if (isTransfer !== (movement.transferId !== undefined)) {
      context.addIssue({
        code: "custom",
        path: ["transferId"],
        message: isTransfer
          ? "Transfer movements require a transferId"
          : "Only transfer movements may have a transferId",
      });
    }

    const isReversal = movement.movementType === "reversal";
    if (
      isReversal !==
      (movement.reversalOfMovementId !== undefined &&
        movement.reversalReason !== undefined)
    ) {
      context.addIssue({
        code: "custom",
        path: ["reversalOfMovementId"],
        message: isReversal
          ? "Reversals require an original movement and reason"
          : "Only reversals may reference an original movement",
      });
    }

    if (
      !isReversal &&
      (movement.reversalOfMovementId !== undefined ||
        movement.reversalReason !== undefined)
    ) {
      context.addIssue({
        code: "custom",
        path: ["reversalReason"],
        message: "Non-reversal movements cannot contain reversal fields",
      });
    }
  });

export type InventoryMovement = DeepReadonly<
  z.output<typeof InventoryMovementSchema>
>;

export interface InventoryMovementInput {
  readonly movementId: string;
  readonly itemId: string;
  readonly locationId: string;
  readonly occurredAt: string;
  readonly movementType: InventoryMovementType;
  readonly quantityDelta: string;
  readonly stockingUnit: UnitDefinition;
  readonly unitCostCents?: string;
  readonly source: Readonly<z.input<typeof MovementSourceSchema>>;
  readonly transferId?: string;
  readonly reversalOfMovementId?: string;
  readonly reversalReason?: string;
  readonly note?: string;
}

export class InventoryInvariantError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "InventoryInvariantError";
  }
}

export function createInventoryMovement(
  input: InventoryMovementInput,
): InventoryMovement {
  return deepFreeze(InventoryMovementSchema.parse(input));
}

export interface CreateInventoryReversalInput {
  readonly movementId: string;
  readonly occurredAt: string;
  readonly reason: string;
  readonly source: Readonly<z.input<typeof MovementSourceSchema>>;
  readonly existingMovements?: readonly InventoryMovement[];
}

/**
 * Reversals are append-only compensating movements. The original record is
 * never edited, and a movement can be reversed at most once.
 */
export function createInventoryReversal(
  originalInput: InventoryMovement,
  input: CreateInventoryReversalInput,
): InventoryMovement {
  const original = InventoryMovementSchema.parse(originalInput);

  if (original.movementType === "reversal") {
    throw new InventoryInvariantError("A reversal cannot itself be reversed");
  }

  if (
    input.existingMovements?.some(
      (movement) =>
        movement.reversalOfMovementId === original.movementId &&
        movement.movementType === "reversal",
    )
  ) {
    throw new InventoryInvariantError(
      `Movement ${original.movementId} has already been reversed`,
    );
  }

  if (Date.parse(input.occurredAt) < Date.parse(original.occurredAt)) {
    throw new InventoryInvariantError(
      "A reversal cannot occur before its original movement",
    );
  }

  return createInventoryMovement({
    movementId: input.movementId,
    itemId: original.itemId,
    locationId: original.locationId,
    occurredAt: input.occurredAt,
    movementType: "reversal",
    quantityDelta: canonicalDecimal(
      new DomainDecimal(original.quantityDelta).neg(),
    ),
    stockingUnit: original.stockingUnit,
    ...(original.unitCostCents === undefined
      ? {}
      : { unitCostCents: original.unitCostCents }),
    source: input.source,
    reversalOfMovementId: original.movementId,
    reversalReason: input.reason,
  });
}

function assertSameStockingUnit(
  first: InventoryMovement,
  second: InventoryMovement,
  context: string,
): void {
  if (
    first.stockingUnit.code !== second.stockingUnit.code ||
    first.stockingUnit.dimension !== second.stockingUnit.dimension ||
    first.stockingUnit.definitionVersion !==
      second.stockingUnit.definitionVersion
  ) {
    throw new InventoryInvariantError(
      `${context} must use the same snapshotted stocking unit`,
    );
  }
}

export function validateTransferPair(
  firstInput: InventoryMovement,
  secondInput: InventoryMovement,
): readonly [InventoryMovement, InventoryMovement] {
  const first = InventoryMovementSchema.parse(firstInput);
  const second = InventoryMovementSchema.parse(secondInput);
  const movements = [first, second] as const;
  const inbound = movements.find(
    (movement) => movement.movementType === "transfer_in",
  );
  const outbound = movements.find(
    (movement) => movement.movementType === "transfer_out",
  );

  if (
    inbound === undefined ||
    outbound === undefined ||
    inbound.transferId !== outbound.transferId
  ) {
    throw new InventoryInvariantError(
      "A transfer requires one matching outbound and inbound movement",
    );
  }

  if (
    inbound.itemId !== outbound.itemId ||
    inbound.locationId === outbound.locationId
  ) {
    throw new InventoryInvariantError(
      "Transfer movements must move one item between different locations",
    );
  }

  assertSameStockingUnit(inbound, outbound, "Transfer movements");

  if (
    !new DomainDecimal(inbound.quantityDelta)
      .plus(outbound.quantityDelta)
      .isZero()
  ) {
    throw new InventoryInvariantError(
      "Transfer quantities must be equal and opposite",
    );
  }
  if (inbound.unitCostCents !== outbound.unitCostCents) {
    throw new InventoryInvariantError(
      "Transfer movements must preserve the unit cost",
    );
  }

  return deepFreeze([outbound, inbound] as const);
}

/**
 * Validates invariants that require ledger context: unique identities,
 * one-to-one reversals, exact reversal effects, and complete transfers.
 */
export function validateInventoryLedger(
  movementInputs: readonly InventoryMovement[],
): readonly InventoryMovement[] {
  const movements = movementInputs.map((movement) =>
    InventoryMovementSchema.parse(movement),
  );
  const byId = new Map<string, InventoryMovement>();

  for (const movement of movements) {
    if (byId.has(movement.movementId)) {
      throw new InventoryInvariantError(
        `Duplicate movementId ${movement.movementId}`,
      );
    }
    byId.set(movement.movementId, movement);
  }

  const reversalByOriginal = new Map<string, InventoryMovement>();
  for (const reversal of movements.filter(
    (movement) => movement.movementType === "reversal",
  )) {
    const originalId = reversal.reversalOfMovementId;
    if (originalId === undefined) {
      throw new InventoryInvariantError("Reversal is missing its original");
    }

    const original = byId.get(originalId);
    if (original === undefined) {
      throw new InventoryInvariantError(
        `Reversal references unknown movement ${originalId}`,
      );
    }
    if (original.movementType === "reversal") {
      throw new InventoryInvariantError("A reversal cannot reverse a reversal");
    }
    if (reversalByOriginal.has(originalId)) {
      throw new InventoryInvariantError(
        `Movement ${originalId} has more than one reversal`,
      );
    }
    if (
      reversal.itemId !== original.itemId ||
      reversal.locationId !== original.locationId
    ) {
      throw new InventoryInvariantError(
        "A reversal must preserve the item and location",
      );
    }

    assertSameStockingUnit(reversal, original, "Reversal");

    if (
      !new DomainDecimal(reversal.quantityDelta)
        .plus(original.quantityDelta)
        .isZero()
    ) {
      throw new InventoryInvariantError(
        "A reversal must exactly negate the original quantity",
      );
    }
    if (reversal.unitCostCents !== original.unitCostCents) {
      throw new InventoryInvariantError(
        "A reversal must preserve the original unit cost",
      );
    }
    if (Date.parse(reversal.occurredAt) < Date.parse(original.occurredAt)) {
      throw new InventoryInvariantError(
        "A reversal cannot predate its original movement",
      );
    }

    reversalByOriginal.set(originalId, reversal);
  }

  const transfers = new Map<string, InventoryMovement[]>();
  for (const movement of movements) {
    if (movement.transferId !== undefined) {
      const group = transfers.get(movement.transferId) ?? [];
      group.push(movement);
      transfers.set(movement.transferId, group);
    }
  }

  for (const [transferId, pair] of transfers) {
    if (pair.length !== 2) {
      throw new InventoryInvariantError(
        `Transfer ${transferId} must have exactly two movements`,
      );
    }
    validateTransferPair(pair[0], pair[1]);

    const reversedSides = pair.filter((movement) =>
      reversalByOriginal.has(movement.movementId),
    ).length;
    if (reversedSides === 1) {
      throw new InventoryInvariantError(
        `Transfer ${transferId} must reverse both sides together`,
      );
    }
  }

  return deepFreeze(movements);
}

export function inventoryQuantityImpact(
  movements: readonly InventoryMovement[],
): string {
  const quantity = movements.reduce(
    (total, movement) => total.plus(movement.quantityDelta),
    new DomainDecimal(0),
  );
  return canonicalDecimal(quantity);
}
