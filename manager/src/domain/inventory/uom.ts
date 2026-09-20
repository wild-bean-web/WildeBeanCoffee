import Decimal from "decimal.js";
import { z } from "zod";

export const DomainDecimal = Decimal.clone({
  precision: 40,
  rounding: Decimal.ROUND_HALF_EVEN,
  toExpNeg: -100,
  toExpPos: 100,
});

export type DecimalString = string;

export function canonicalDecimal(value: Decimal.Value): DecimalString {
  const decimal = new DomainDecimal(value);
  if (!decimal.isFinite()) {
    throw new Error("Decimal value must be finite");
  }

  const valueAsString = decimal.toFixed();
  return valueAsString === "-0" ? "0" : valueAsString;
}

function isFiniteDecimal(value: string): boolean {
  try {
    return new DomainDecimal(value).isFinite();
  } catch {
    return false;
  }
}

export const DecimalStringSchema = z
  .string()
  .trim()
  .min(1)
  .refine(isFiniteDecimal, "Must be a finite decimal")
  .transform(canonicalDecimal);

export const NonNegativeDecimalStringSchema = DecimalStringSchema.refine(
  (value) => new DomainDecimal(value).gte(0),
  "Must be non-negative",
);

export const PositiveDecimalStringSchema = DecimalStringSchema.refine(
  (value) => new DomainDecimal(value).gt(0),
  "Must be greater than zero",
);

export const NonZeroDecimalStringSchema = DecimalStringSchema.refine(
  (value) => !new DomainDecimal(value).isZero(),
  "Must not be zero",
);

export const MeasurementDimensionSchema = z.enum([
  "mass",
  "volume",
  "count",
  "length",
  "area",
]);

export type MeasurementDimension = z.infer<
  typeof MeasurementDimensionSchema
>;

export const UnitDefinitionSchema = z.strictObject({
  code: z
    .string()
    .trim()
    .min(1)
    .max(32)
    .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/),
  name: z.string().trim().min(1).max(80),
  symbol: z.string().trim().min(1).max(16),
  dimension: MeasurementDimensionSchema,
  /**
   * Multiplicative factor from this unit to the dimension's canonical base
   * unit (for example, kg -> g is 1000).
   */
  toBaseFactor: PositiveDecimalStringSchema,
  definitionVersion: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  quantityScale: z.number().int().min(0).max(12),
});

export type UnitDefinition = Readonly<
  z.output<typeof UnitDefinitionSchema>
>;

export interface CreateUnitDefinitionInput {
  readonly code: string;
  readonly name: string;
  readonly symbol: string;
  readonly dimension: MeasurementDimension;
  readonly toBaseFactor: string;
  readonly definitionVersion: number;
  readonly quantityScale: number;
}

export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly unknown[]
    ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

export function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }

  return value as DeepReadonly<T>;
}

export function createUnitDefinition(
  input: CreateUnitDefinitionInput,
): UnitDefinition {
  return deepFreeze(UnitDefinitionSchema.parse(input));
}

export const ConversionSnapshotSchema = z
  .strictObject({
    snapshotId: z.string().trim().min(1).max(120),
    capturedAt: z.string().datetime({ offset: true }),
    dimension: MeasurementDimensionSchema,
    fromUnit: UnitDefinitionSchema,
    toUnit: UnitDefinitionSchema,
    multiplier: PositiveDecimalStringSchema,
  })
  .superRefine((snapshot, context) => {
    if (
      snapshot.fromUnit.dimension !== snapshot.dimension ||
      snapshot.toUnit.dimension !== snapshot.dimension
    ) {
      context.addIssue({
        code: "custom",
        message: "Both units must have the snapshot dimension",
      });
      return;
    }

    const expectedMultiplier = new DomainDecimal(
      snapshot.fromUnit.toBaseFactor,
    ).div(snapshot.toUnit.toBaseFactor);

    if (!expectedMultiplier.eq(snapshot.multiplier)) {
      context.addIssue({
        code: "custom",
        path: ["multiplier"],
        message: "Multiplier does not match the snapshotted unit factors",
      });
    }
  });

export type ConversionSnapshot = DeepReadonly<
  z.output<typeof ConversionSnapshotSchema>
>;

export interface CreateConversionSnapshotInput {
  readonly snapshotId: string;
  readonly capturedAt: string;
  readonly fromUnit: UnitDefinition;
  readonly toUnit: UnitDefinition;
}

/**
 * Captures all conversion facts required to replay a transaction. Later
 * edits to a unit catalog cannot alter this snapshot or its multiplier.
 */
export function createConversionSnapshot(
  input: CreateConversionSnapshotInput,
): ConversionSnapshot {
  const fromUnit = UnitDefinitionSchema.parse(input.fromUnit);
  const toUnit = UnitDefinitionSchema.parse(input.toUnit);

  if (fromUnit.dimension !== toUnit.dimension) {
    throw new Error(
      `Cannot convert ${fromUnit.dimension} to ${toUnit.dimension}`,
    );
  }

  const multiplier = canonicalDecimal(
    new DomainDecimal(fromUnit.toBaseFactor).div(toUnit.toBaseFactor),
  );

  return deepFreeze(
    ConversionSnapshotSchema.parse({
      snapshotId: input.snapshotId,
      capturedAt: input.capturedAt,
      dimension: fromUnit.dimension,
      fromUnit: { ...fromUnit },
      toUnit: { ...toUnit },
      multiplier,
    }),
  );
}

export function convertQuantity(
  quantity: string,
  snapshotInput: ConversionSnapshot,
): DecimalString {
  const parsedQuantity = DecimalStringSchema.parse(quantity);
  const snapshot = ConversionSnapshotSchema.parse(snapshotInput);
  return canonicalDecimal(
    new DomainDecimal(parsedQuantity).mul(snapshot.multiplier),
  );
}

export function invertConversionSnapshot(
  snapshotInput: ConversionSnapshot,
  identity: Readonly<{ snapshotId: string; capturedAt: string }>,
): ConversionSnapshot {
  const snapshot = ConversionSnapshotSchema.parse(snapshotInput);
  return createConversionSnapshot({
    ...identity,
    fromUnit: snapshot.toUnit,
    toUnit: snapshot.fromUnit,
  });
}
