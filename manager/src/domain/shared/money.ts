import Decimal from "decimal.js";

import {
  IntegerCentsSchema,
  MAX_CENTS,
  MoneyDecimalStringSchema,
  NonNegativeCentsSchema,
  PositiveFixedDecimalStringSchema,
} from "./scalars";

const ExactDecimal = Decimal.clone({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -40,
  toExpPos: 40,
});

export function moneyDecimalToCents(value: string): number {
  const parsed = MoneyDecimalStringSchema.parse(value);
  return assertSupportedCents(
    new ExactDecimal(parsed).times(100).toNumber(),
    "Money decimal",
  );
}

export function centsToMoneyDecimal(cents: number): string {
  const parsed = IntegerCentsSchema.parse(cents);
  return new ExactDecimal(parsed).dividedBy(100).toFixed(2);
}

export function multiplyCentsByQuantity(
  unitPriceCents: number,
  quantity: string,
): number {
  const parsedPrice = NonNegativeCentsSchema.parse(unitPriceCents);
  const parsedQuantity = PositiveFixedDecimalStringSchema.parse(quantity);
  const result = new ExactDecimal(parsedPrice)
    .times(parsedQuantity)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toNumber();

  return assertSupportedCents(result, "Extended line amount");
}

export function sumCents(values: readonly number[]): number {
  const total = values.reduce(
    (sum, value) => sum.plus(IntegerCentsSchema.parse(value)),
    new ExactDecimal(0),
  );

  return assertSupportedCents(total.toNumber(), "Cents sum");
}

export function centsDifference(
  expectedCents: number,
  actualCents: number,
): number {
  const expected = IntegerCentsSchema.parse(expectedCents);
  const actual = IntegerCentsSchema.parse(actualCents);
  return assertSupportedCents(actual - expected, "Cents difference");
}

export function isWithinCentsTolerance(
  expectedCents: number,
  actualCents: number,
  toleranceCents = 0,
): boolean {
  const tolerance = NonNegativeCentsSchema.parse(toleranceCents);
  return Math.abs(centsDifference(expectedCents, actualCents)) <= tolerance;
}

function assertSupportedCents(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || Math.abs(value) > MAX_CENTS) {
    throw new RangeError(`${label} exceeds the supported integer-cent range`);
  }

  return value;
}
