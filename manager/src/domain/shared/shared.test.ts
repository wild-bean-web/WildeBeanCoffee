import { describe, expect, it } from "vitest";

import {
  canonicalizeFixedDecimal,
  centsToMoneyDecimal,
  encodeCanonicalKeyParts,
  fixedDecimalsEqual,
  FixedDecimalStringSchema,
  IsoDateSchema,
  IsoDateTimeSchema,
  isWithinCentsTolerance,
  moneyDecimalToCents,
  MoneyDecimalStringSchema,
  multiplyCentsByQuantity,
  NonNegativeCentsSchema,
  PositiveFixedDecimalStringSchema,
  sha256Hex,
  sumCents,
} from ".";

describe("shared scalar schemas", () => {
  it("accepts integer cents and rejects floating point money", () => {
    expect(NonNegativeCentsSchema.parse(12_345)).toBe(12_345);
    expect(() => NonNegativeCentsSchema.parse(12.34)).toThrow();
    expect(() => NonNegativeCentsSchema.parse(-1)).toThrow();
  });

  it("requires canonical fixed decimal strings", () => {
    expect(FixedDecimalStringSchema.parse("-12.500")).toBe("-12.500");
    expect(PositiveFixedDecimalStringSchema.parse("0.001")).toBe("0.001");
    expect(() => FixedDecimalStringSchema.parse("12")).toThrow();
    expect(() => FixedDecimalStringSchema.parse("01.00")).toThrow();
    expect(() => FixedDecimalStringSchema.parse("-0.00")).toThrow();
    expect(() => PositiveFixedDecimalStringSchema.parse("0.000")).toThrow();
  });

  it("validates real calendar dates rather than shape alone", () => {
    expect(IsoDateSchema.parse("2024-02-29")).toBe("2024-02-29");
    expect(() => IsoDateSchema.parse("2023-02-29")).toThrow();
    expect(() => IsoDateSchema.parse("2024-13-01")).toThrow();
    expect(
      IsoDateTimeSchema.parse("2024-02-29T12:30:00Z"),
    ).toBe("2024-02-29T12:30:00Z");
    expect(() =>
      IsoDateTimeSchema.parse("2023-02-29T12:30:00Z"),
    ).toThrow();
  });

  it("normalizes fixed decimals for exact quantity comparisons", () => {
    expect(canonicalizeFixedDecimal("10.5000")).toBe("10.5");
    expect(fixedDecimalsEqual("1.0", "1.000000")).toBe(true);
    expect(fixedDecimalsEqual("1.01", "1.010001")).toBe(false);
  });
});

describe("deterministic money helpers", () => {
  it("converts fixed two-place money without binary float arithmetic", () => {
    expect(MoneyDecimalStringSchema.parse("123.45")).toBe("123.45");
    expect(moneyDecimalToCents("123.45")).toBe(12_345);
    expect(centsToMoneyDecimal(12_345)).toBe("123.45");
    expect(centsToMoneyDecimal(-1)).toBe("-0.01");
  });

  it("uses explicit half-up rounding for fractional-cent extensions", () => {
    expect(multiplyCentsByQuantity(1, "0.500")).toBe(1);
    expect(multiplyCentsByQuantity(3, "0.500")).toBe(2);
    expect(multiplyCentsByQuantity(199, "2.500")).toBe(498);
  });

  it("sums cents as integers and compares explicit tolerances", () => {
    expect(sumCents([100, -25, 7])).toBe(82);
    expect(isWithinCentsTolerance(100, 101)).toBe(false);
    expect(isWithinCentsTolerance(100, 101, 1)).toBe(true);
  });
});

describe("SHA-256 helpers", () => {
  it("matches the standard SHA-256 test vector", () => {
    expect(sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("type-tags canonical key parts to prevent ambiguous concatenation", () => {
    expect(encodeCanonicalKeyParts(["1", 2])).not.toBe(
      encodeCanonicalKeyParts([1, "2"]),
    );
    expect(encodeCanonicalKeyParts(["ab", "c"])).not.toBe(
      encodeCanonicalKeyParts(["a", "bc"]),
    );
  });

  it("rejects unsafe numeric key parts", () => {
    expect(() => encodeCanonicalKeyParts([1.5])).toThrow();
    expect(() =>
      encodeCanonicalKeyParts([Number.MAX_SAFE_INTEGER + 1]),
    ).toThrow();
  });
});
