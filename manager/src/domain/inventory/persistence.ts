import { z } from "zod";

import {
  InventoryMovementTypeSchema,
  type InventoryMovementType,
} from "./movements";
import {
  canonicalDecimal,
  deepFreeze,
  DomainDecimal,
  NonNegativeDecimalStringSchema,
  PositiveDecimalStringSchema,
  type DeepReadonly,
} from "./uom";
import {
  PeriodicWeightedAverageInputSchema,
  calculatePeriodicWeightedAverage,
  type PeriodicWeightedAverageResult,
} from "./valuation";

export const PersistedInventoryMovementTypeSchema = z.enum([
  "opening_balance",
  "goods_receipt",
  "purchase_return",
  "sale",
  "sale_return",
  "waste",
  "transfer_in",
  "transfer_out",
  "count_adjustment",
  "recipe_consumption",
  "recipe_production",
  "manual_adjustment",
  "reversal",
]);

export type PersistedInventoryMovementType = z.infer<
  typeof PersistedInventoryMovementTypeSchema
>;

export const WasteReasonSchema = z.enum([
  "spoilage",
  "remake",
  "staff_meal",
  "donation",
  "breakage",
  "unsold_pastry",
  "other",
]);

export type WasteReason = z.infer<typeof WasteReasonSchema>;

export const COUNT_SECTION_DEFINITIONS = [
  {
    code: "walk_in",
    name: "Walk-in and refrigerators",
    detail: "Milk, dairy alternatives, juice, produce, prepared items",
    cadence: "Weekly",
    keywords: [
      "dairy",
      "milk",
      "produce",
      "juice",
      "yogurt",
      "cream",
      "oat",
      "almond",
      "refrigerat",
    ],
  },
  {
    code: "bar",
    name: "Coffee and bar storage",
    detail: "Beans, matcha, tea, syrups, powders, toppings",
    cadence: "Weekly",
    keywords: [
      "coffee",
      "bean",
      "espresso",
      "matcha",
      "tea",
      "syrup",
      "powder",
      "topping",
      "cocoa",
      "bar",
    ],
  },
  {
    code: "freezer",
    name: "Freezer",
    detail: "Fruit, smoothie ingredients, frozen prep",
    cadence: "Weekly",
    keywords: ["frozen", "freezer", "smoothie"],
  },
  {
    code: "dry",
    name: "Packaging and dry storage",
    detail: "Cups, lids, straws, carriers, napkins, sanitation",
    cadence: "Monthly",
    keywords: [
      "cup",
      "lid",
      "straw",
      "napkin",
      "packag",
      "cupware",
      "sanit",
      "paper",
      "dry",
    ],
  },
] as const;

export type CountSectionCode =
  (typeof COUNT_SECTION_DEFINITIONS)[number]["code"];

const DOMAIN_TO_PERSISTED: Record<
  InventoryMovementType,
  PersistedInventoryMovementType
> = {
  opening_balance: "opening_balance",
  receipt: "goods_receipt",
  customer_return: "sale_return",
  transfer_in: "transfer_in",
  production_output: "recipe_production",
  count_gain: "count_adjustment",
  sale_depletion: "sale",
  waste: "waste",
  vendor_return: "purchase_return",
  transfer_out: "transfer_out",
  production_input: "recipe_consumption",
  count_loss: "count_adjustment",
  adjustment: "manual_adjustment",
  reversal: "reversal",
};

export function toPersistedMovementType(
  movementType: InventoryMovementType,
): PersistedInventoryMovementType {
  return DOMAIN_TO_PERSISTED[InventoryMovementTypeSchema.parse(movementType)];
}

export function toDomainMovementType(
  movementType: PersistedInventoryMovementType,
  quantityDelta: string,
): InventoryMovementType {
  const persisted = PersistedInventoryMovementTypeSchema.parse(movementType);
  const quantity = new DomainDecimal(quantityDelta);

  switch (persisted) {
    case "opening_balance":
      return "opening_balance";
    case "goods_receipt":
      return "receipt";
    case "purchase_return":
      return "vendor_return";
    case "sale":
      return "sale_depletion";
    case "sale_return":
      return "customer_return";
    case "waste":
      return "waste";
    case "transfer_in":
      return "transfer_in";
    case "transfer_out":
      return "transfer_out";
    case "count_adjustment":
      return quantity.isNegative() ? "count_loss" : "count_gain";
    case "recipe_consumption":
      return "production_input";
    case "recipe_production":
      return "production_output";
    case "manual_adjustment":
      return "adjustment";
    case "reversal":
      return "reversal";
  }
}

export function wasteSourceSystem(reason: WasteReason): string {
  return `manager_waste:${WasteReasonSchema.parse(reason)}`;
}

export function parseWasteReason(
  sourceSystem: string | null,
): WasteReason | null {
  if (!sourceSystem?.startsWith("manager_waste:")) return null;
  const parsed = WasteReasonSchema.safeParse(
    sourceSystem.slice("manager_waste:".length),
  );
  return parsed.success ? parsed.data : null;
}

export function countSectionCodeForCategory(
  category: string | null | undefined,
): CountSectionCode {
  const normalized = (category ?? "").trim().toLowerCase();
  if (!normalized) return "dry";

  const freezer = COUNT_SECTION_DEFINITIONS.find(
    (section) => section.code === "freezer",
  );
  if (
    freezer?.keywords.some((keyword) => normalized.includes(keyword))
  ) {
    return "freezer";
  }

  for (const section of COUNT_SECTION_DEFINITIONS) {
    if (section.code === "freezer") continue;
    if (section.keywords.some((keyword) => normalized.includes(keyword))) {
      return section.code;
    }
  }

  return "dry";
}

export const CountPostingLineSchema = z.strictObject({
  countLineId: z.string().uuid(),
  productId: z.string().uuid(),
  uomId: z.string().uuid(),
  countedQuantity: NonNegativeDecimalStringSchema,
  expectedQuantity: NonNegativeDecimalStringSchema,
  hasOpeningBalance: z.boolean(),
});

export type CountPostingLine = z.input<typeof CountPostingLineSchema>;

export type CountLinePostingPlan =
  | DeepReadonly<{ skip: true; reason: "zero_quantity" | "no_variance" }>
  | DeepReadonly<{
      skip: false;
      movementType: "opening_balance" | "count_adjustment";
      quantity: string;
    }>;

export function planCountLineMovement(
  input: CountPostingLine,
): CountLinePostingPlan {
  const line = CountPostingLineSchema.parse(input);
  const counted = new DomainDecimal(line.countedQuantity);
  const expected = new DomainDecimal(line.expectedQuantity);

  if (!line.hasOpeningBalance) {
    if (counted.isZero()) {
      return deepFreeze({ skip: true, reason: "zero_quantity" });
    }
    return deepFreeze({
      skip: false,
      movementType: "opening_balance",
      quantity: canonicalDecimal(counted),
    });
  }

  const variance = counted.minus(expected);
  if (variance.isZero()) {
    return deepFreeze({ skip: true, reason: "no_variance" });
  }
  return deepFreeze({
    skip: false,
    movementType: "count_adjustment",
    quantity: canonicalDecimal(variance),
  });
}

export function planWasteQuantity(quantity: string): string {
  const parsed = PositiveDecimalStringSchema.parse(quantity);
  return canonicalDecimal(new DomainDecimal(parsed).neg());
}

export function businessDateInTimezone(
  occurredAt: Date | string,
  timezone: string,
): string {
  const timestamp =
    occurredAt instanceof Date ? occurredAt.toISOString() : occurredAt;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  const year = value("year");
  const month = value("month");
  const day = value("day");
  if (!year || !month || !day) {
    throw new Error("Unable to derive a business date from the timestamp");
  }
  return `${year}-${month}-${day}`;
}

export const PersistedInventoryRowSchema = z.strictObject({
  movementType: PersistedInventoryMovementTypeSchema,
  quantity: z.string(),
  unitCostCents: z.string().nullable(),
  extendedCostCents: z.number().int().nullable(),
  sourceEventId: z.string().trim().min(1).max(160),
});

export type PersistedInventoryRow = z.input<typeof PersistedInventoryRowSchema>;

function movementValueCents(
  quantity: InstanceType<typeof DomainDecimal>,
  unitCostCents: string | null,
  extendedCostCents: number | null,
): number | null {
  if (extendedCostCents !== null) {
    return Math.abs(extendedCostCents);
  }
  if (unitCostCents === null) return null;
  const value = quantity.abs().mul(unitCostCents).toDecimalPlaces(0);
  if (value.gt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError("Inventory value exceeds safe integer cents");
  }
  return value.toNumber();
}

export interface ProductPeriodPosition {
  readonly openingQuantity: string;
  readonly openingValueCents: number | null;
  readonly receivedLayers: readonly {
    readonly receiptEventId: string;
    readonly quantity: string;
    readonly valueCents: number;
  }[];
  readonly recordedWasteQuantity: string;
  readonly unvaluedReceipts: number;
}

export function summarizePersistedPeriod(
  rowsInput: readonly PersistedInventoryRow[],
): DeepReadonly<ProductPeriodPosition> {
  const rows = rowsInput.map((row) => PersistedInventoryRowSchema.parse(row));
  let openingQuantity = new DomainDecimal(0);
  let openingValueCents: number | null = 0;
  let wasteQuantity = new DomainDecimal(0);
  const receivedLayers: ProductPeriodPosition["receivedLayers"][number][] = [];
  let unvaluedReceipts = 0;

  for (const row of rows) {
    const quantity = new DomainDecimal(row.quantity);
    if (row.movementType === "opening_balance") {
      openingQuantity = openingQuantity.plus(quantity);
      const value = movementValueCents(
        quantity,
        row.unitCostCents,
        row.extendedCostCents,
      );
      if (value === null || openingValueCents === null) {
        openingValueCents = null;
      } else {
        openingValueCents += value;
      }
    } else if (row.movementType === "goods_receipt") {
      const value = movementValueCents(
        quantity,
        row.unitCostCents,
        row.extendedCostCents,
      );
      if (value === null) {
        unvaluedReceipts += 1;
        continue;
      }
      receivedLayers.push({
        receiptEventId: row.sourceEventId,
        quantity: canonicalDecimal(quantity.abs()),
        valueCents: value,
      });
    } else if (row.movementType === "waste") {
      wasteQuantity = wasteQuantity.plus(quantity.abs());
    }
  }

  return deepFreeze({
    openingQuantity: canonicalDecimal(openingQuantity),
    openingValueCents,
    receivedLayers,
    recordedWasteQuantity: canonicalDecimal(wasteQuantity),
    unvaluedReceipts,
  });
}

export function costingFromPersistedPeriod(
  rows: readonly PersistedInventoryRow[],
  closingQuantity: string,
): DeepReadonly<PeriodicWeightedAverageResult> | null {
  const summary = summarizePersistedPeriod(rows);
  if (summary.openingValueCents === null || summary.unvaluedReceipts > 0) {
    return null;
  }

  return calculatePeriodicWeightedAverage(
    PeriodicWeightedAverageInputSchema.parse({
      opening: {
        quantity: summary.openingQuantity,
        valueCents: summary.openingValueCents,
      },
      receivedLayers: summary.receivedLayers,
      closingQuantity,
      recordedWasteQuantity: summary.recordedWasteQuantity,
    }),
  );
}
