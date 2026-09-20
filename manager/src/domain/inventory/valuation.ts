import { z } from "zod";

import {
  type InventoryMovement,
  validateInventoryLedger,
} from "./movements";
import {
  canonicalDecimal,
  deepFreeze,
  DomainDecimal,
  NonNegativeDecimalStringSchema,
  PositiveDecimalStringSchema,
  type DeepReadonly,
} from "./uom";

export const SafeNonNegativeCentsSchema = z
  .number()
  .int()
  .min(0)
  .max(Number.MAX_SAFE_INTEGER);

export const InventoryPositionSchema = z.strictObject({
  quantity: NonNegativeDecimalStringSchema,
  valueCents: SafeNonNegativeCentsSchema,
});

export const ReceivedCostLayerSchema = z.strictObject({
  receiptEventId: z.string().trim().min(1).max(160),
  quantity: PositiveDecimalStringSchema,
  valueCents: SafeNonNegativeCentsSchema,
});

export const PeriodicWeightedAverageInputSchema = z
  .strictObject({
    opening: InventoryPositionSchema,
    receivedLayers: z.array(ReceivedCostLayerSchema),
    closingQuantity: NonNegativeDecimalStringSchema,
    recordedWasteQuantity: NonNegativeDecimalStringSchema,
  })
  .superRefine((input, context) => {
    if (
      new DomainDecimal(input.opening.quantity).isZero() &&
      input.opening.valueCents !== 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["opening", "valueCents"],
        message: "Zero opening quantity must have zero value",
      });
    }

    const receiptIds = new Set<string>();
    for (const [index, layer] of input.receivedLayers.entries()) {
      if (receiptIds.has(layer.receiptEventId)) {
        context.addIssue({
          code: "custom",
          path: ["receivedLayers", index, "receiptEventId"],
          message: "Receipt cost layers must be unique",
        });
      }
      receiptIds.add(layer.receiptEventId);
    }
  });

export type PeriodicWeightedAverageInput = z.input<
  typeof PeriodicWeightedAverageInputSchema
>;

interface ValueBuckets<T> {
  readonly cogs: T;
  readonly waste: T;
  readonly endingInventory: T;
}

export interface PeriodicWeightedAverageResult {
  readonly method: "periodic_weighted_average";
  readonly availableQuantity: string;
  readonly availableValueCents: number;
  readonly averageUnitCostCents: string;
  readonly physicalDepletionQuantity: string;
  /**
   * Sale/production depletion only. Recorded waste is explicitly excluded so
   * it cannot be posted both to COGS and to a waste expense.
   */
  readonly cogsQuantity: string;
  readonly recordedWasteQuantity: string;
  readonly closingQuantity: string;
  readonly exactValueCents: ValueBuckets<string>;
  /**
   * Whole-cent allocation using largest remainders. The three values always
   * sum exactly to availableValueCents.
   */
  readonly postingValueCents: ValueBuckets<number>;
}

function addSafeCents(total: number, amount: number): number {
  if (amount > Number.MAX_SAFE_INTEGER - total) {
    throw new RangeError("Inventory value exceeds safe integer cents");
  }
  return total + amount;
}

function allocateWholeCents(
  totalValueCents: number,
  exactValues: ValueBuckets<InstanceType<typeof DomainDecimal>>,
): ValueBuckets<number> {
  type BucketName = keyof ValueBuckets<number>;
  const stableOrder: readonly BucketName[] = [
    "cogs",
    "waste",
    "endingInventory",
  ];
  const allocations = new Map<BucketName, number>();
  const remainders: Array<{
    readonly name: BucketName;
    readonly remainder: InstanceType<typeof DomainDecimal>;
    readonly order: number;
  }> = [];

  let allocated = 0;
  stableOrder.forEach((name, order) => {
    const floored = exactValues[name].floor().toNumber();
    allocations.set(name, floored);
    allocated = addSafeCents(allocated, floored);
    remainders.push({
      name,
      remainder: exactValues[name].minus(floored),
      order,
    });
  });

  const remaining = totalValueCents - allocated;
  if (remaining < 0 || remaining > remainders.length) {
    throw new Error("Unable to allocate inventory value in whole cents");
  }

  remainders.sort(
    (left, right) =>
      right.remainder.comparedTo(left.remainder) ||
      left.order - right.order,
  );

  for (let index = 0; index < remaining; index += 1) {
    const bucket = remainders[index];
    if (bucket === undefined) {
      throw new Error("Missing valuation allocation bucket");
    }
    allocations.set(bucket.name, (allocations.get(bucket.name) ?? 0) + 1);
  }

  return {
    cogs: allocations.get("cogs") ?? 0,
    waste: allocations.get("waste") ?? 0,
    endingInventory: allocations.get("endingInventory") ?? 0,
  };
}

/**
 * Calculates a period-end weighted average from opening inventory plus goods
 * actually received. Purchase orders and supplier payments are deliberately
 * not cost layers.
 */
export function calculatePeriodicWeightedAverage(
  input: PeriodicWeightedAverageInput,
): DeepReadonly<PeriodicWeightedAverageResult> {
  const parsed = PeriodicWeightedAverageInputSchema.parse(input);
  const availableQuantity = parsed.receivedLayers.reduce(
    (total, layer) => total.plus(layer.quantity),
    new DomainDecimal(parsed.opening.quantity),
  );
  const availableValueCents = parsed.receivedLayers.reduce(
    (total, layer) => addSafeCents(total, layer.valueCents),
    parsed.opening.valueCents,
  );
  const closingQuantity = new DomainDecimal(parsed.closingQuantity);
  const wasteQuantity = new DomainDecimal(parsed.recordedWasteQuantity);

  if (closingQuantity.gt(availableQuantity)) {
    throw new RangeError("Closing quantity cannot exceed available quantity");
  }

  const physicalDepletion = availableQuantity.minus(closingQuantity);
  if (wasteQuantity.gt(physicalDepletion)) {
    throw new RangeError(
      "Recorded waste cannot exceed the period's physical depletion",
    );
  }

  if (availableQuantity.isZero()) {
    if (availableValueCents !== 0) {
      throw new Error("Zero available quantity must have zero value");
    }

    return deepFreeze({
      method: "periodic_weighted_average",
      availableQuantity: "0",
      availableValueCents: 0,
      averageUnitCostCents: "0",
      physicalDepletionQuantity: "0",
      cogsQuantity: "0",
      recordedWasteQuantity: "0",
      closingQuantity: "0",
      exactValueCents: {
        cogs: "0",
        waste: "0",
        endingInventory: "0",
      },
      postingValueCents: {
        cogs: 0,
        waste: 0,
        endingInventory: 0,
      },
    } satisfies PeriodicWeightedAverageResult);
  }

  const averageUnitCost = new DomainDecimal(availableValueCents).div(
    availableQuantity,
  );
  const cogsQuantity = physicalDepletion.minus(wasteQuantity);
  const exactValues = {
    cogs: cogsQuantity.mul(averageUnitCost),
    waste: wasteQuantity.mul(averageUnitCost),
    endingInventory: closingQuantity.mul(averageUnitCost),
  };
  const postingValueCents = allocateWholeCents(
    availableValueCents,
    exactValues,
  );

  return deepFreeze({
    method: "periodic_weighted_average",
    availableQuantity: canonicalDecimal(availableQuantity),
    availableValueCents,
    averageUnitCostCents: canonicalDecimal(averageUnitCost),
    physicalDepletionQuantity: canonicalDecimal(physicalDepletion),
    cogsQuantity: canonicalDecimal(cogsQuantity),
    recordedWasteQuantity: canonicalDecimal(wasteQuantity),
    closingQuantity: canonicalDecimal(closingQuantity),
    exactValueCents: {
      cogs: canonicalDecimal(exactValues.cogs),
      waste: canonicalDecimal(exactValues.waste),
      endingInventory: canonicalDecimal(exactValues.endingInventory),
    },
    postingValueCents,
  } satisfies PeriodicWeightedAverageResult);
}

export interface DepletionMovementSummary {
  readonly cogsQuantity: string;
  readonly wasteQuantity: string;
  readonly totalPhysicalDepletionQuantity: string;
}

/**
 * Classifies outbound depletion and applies reversals back to the category of
 * their original movement. Waste remains separate from COGS.
 */
export function summarizeDepletionMovements(
  movementInputs: readonly InventoryMovement[],
): DeepReadonly<DepletionMovementSummary> {
  const movements = validateInventoryLedger(movementInputs);
  const byId = new Map(
    movements.map((movement) => [movement.movementId, movement] as const),
  );
  let cogsQuantity = new DomainDecimal(0);
  let wasteQuantity = new DomainDecimal(0);

  for (const movement of movements) {
    let classifiedType = movement.movementType;
    if (
      movement.movementType === "reversal" &&
      movement.reversalOfMovementId !== undefined
    ) {
      classifiedType = byId.get(
        movement.reversalOfMovementId,
      )?.movementType ?? movement.movementType;
    }

    if (classifiedType === "sale_depletion") {
      cogsQuantity = cogsQuantity.minus(movement.quantityDelta);
    } else if (classifiedType === "waste") {
      wasteQuantity = wasteQuantity.minus(movement.quantityDelta);
    }
  }

  return deepFreeze({
    cogsQuantity: canonicalDecimal(cogsQuantity),
    wasteQuantity: canonicalDecimal(wasteQuantity),
    totalPhysicalDepletionQuantity: canonicalDecimal(
      cogsQuantity.plus(wasteQuantity),
    ),
  });
}
