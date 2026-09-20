import { z } from "zod";

export const MAX_CENTS = 9_000_000_000_000;

export const OpaqueIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9._:-]*$/,
    "IDs may contain letters, numbers, dots, underscores, colons, and hyphens",
  );

export const NonBlankStringSchema = z.string().trim().min(1).max(512);

export const CurrencyCodeSchema = z
  .string()
  .regex(/^[A-Z]{3}$/, "Currency must be an uppercase ISO 4217 code");

export const IntegerCentsSchema = z
  .number()
  .int()
  .min(-MAX_CENTS)
  .max(MAX_CENTS);

export const NonNegativeCentsSchema = IntegerCentsSchema.min(0);
export const PositiveCentsSchema = IntegerCentsSchema.min(1);

const SIGNED_FIXED_DECIMAL = /^-?(?:0|[1-9]\d*)\.\d{1,6}$/;
const UNSIGNED_FIXED_DECIMAL = /^(?:0|[1-9]\d*)\.\d{1,6}$/;

export const FixedDecimalStringSchema = z
  .string()
  .max(32)
  .regex(
    SIGNED_FIXED_DECIMAL,
    "Value must be a canonical fixed decimal with 1-6 fractional digits",
  )
  .refine((value) => !value.startsWith("-0.") || !/^0+$/.test(value.slice(3)), {
    message: "Negative zero is not canonical",
  });

export const NonNegativeFixedDecimalStringSchema = z
  .string()
  .max(32)
  .regex(
    UNSIGNED_FIXED_DECIMAL,
    "Value must be a non-negative canonical fixed decimal",
  );

export const PositiveFixedDecimalStringSchema =
  NonNegativeFixedDecimalStringSchema.refine(
    (value) => /[1-9]/.test(value.replace(".", "")),
    "Value must be greater than zero",
  );

export const MoneyDecimalStringSchema = z
  .string()
  .max(32)
  .regex(
    /^(?:0|[1-9]\d*)\.\d{2}$/,
    "Money must use a non-negative canonical decimal with exactly two places",
  )
  .refine((value) => {
    const [whole, fraction] = value.split(".");
    if (whole.length > 11) {
      return false;
    }
    return Number(whole) * 100 + Number(fraction) <= MAX_CENTS;
  }, "Money exceeds the supported range");

export const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD")
  .refine(isRealIsoDate, "Date is not a valid calendar date");

export const IsoDateTimeSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/,
    "Timestamp must be an ISO 8601 value with an explicit offset",
  )
  .refine(
    (value) =>
      isRealIsoDate(value.slice(0, 10)) && Number.isFinite(Date.parse(value)),
    "Invalid timestamp",
  );

export type FixedDecimalString = z.infer<typeof FixedDecimalStringSchema>;
export type IsoDate = z.infer<typeof IsoDateSchema>;

export function isRealIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function canonicalizeFixedDecimal(value: string): string {
  const parsed = FixedDecimalStringSchema.parse(value);
  const negative = parsed.startsWith("-");
  const unsigned = negative ? parsed.slice(1) : parsed;
  const [whole, fraction] = unsigned.split(".");
  const trimmedFraction = fraction.replace(/0+$/, "");
  const canonicalFraction = trimmedFraction.length === 0 ? "0" : trimmedFraction;
  const isZero = whole === "0" && canonicalFraction === "0";

  return `${negative && !isZero ? "-" : ""}${whole}.${canonicalFraction}`;
}

export function fixedDecimalsEqual(left: string, right: string): boolean {
  return (
    canonicalizeFixedDecimal(left) === canonicalizeFixedDecimal(right)
  );
}
