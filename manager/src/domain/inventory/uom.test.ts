import { describe, expect, it } from "vitest";

import {
  ConversionSnapshotSchema,
  convertQuantity,
  createConversionSnapshot,
  createUnitDefinition,
  invertConversionSnapshot,
} from "./uom";

const capturedAt = "2026-09-17T12:00:00.000Z";

const gram = createUnitDefinition({
  code: "g",
  name: "gram",
  symbol: "g",
  dimension: "mass",
  toBaseFactor: "1",
  definitionVersion: 1,
  quantityScale: 3,
});

const kilogram = createUnitDefinition({
  code: "kg",
  name: "kilogram",
  symbol: "kg",
  dimension: "mass",
  toBaseFactor: "1000",
  definitionVersion: 1,
  quantityScale: 6,
});

describe("dimension-safe UOM conversion snapshots", () => {
  it("converts exactly with decimal arithmetic", () => {
    const snapshot = createConversionSnapshot({
      snapshotId: "kg-to-g-v1",
      capturedAt,
      fromUnit: kilogram,
      toUnit: gram,
    });

    expect(snapshot.multiplier).toBe("1000");
    expect(convertQuantity("1.2345", snapshot)).toBe("1234.5");
  });

  it("rejects conversion across measurement dimensions", () => {
    const litre = createUnitDefinition({
      code: "L",
      name: "litre",
      symbol: "L",
      dimension: "volume",
      toBaseFactor: "1000",
      definitionVersion: 1,
      quantityScale: 3,
    });

    expect(() =>
      createConversionSnapshot({
        snapshotId: "invalid",
        capturedAt,
        fromUnit: litre,
        toUnit: gram,
      }),
    ).toThrow(/Cannot convert volume to mass/);
  });

  it("rejects a forged multiplier when parsing stored data", () => {
    const valid = createConversionSnapshot({
      snapshotId: "kg-to-g-v1",
      capturedAt,
      fromUnit: kilogram,
      toUnit: gram,
    });

    expect(() =>
      ConversionSnapshotSchema.parse({ ...valid, multiplier: "999" }),
    ).toThrow(/Multiplier does not match/);
  });

  it("deep-freezes the complete snapshot", () => {
    const snapshot = createConversionSnapshot({
      snapshotId: "kg-to-g-v1",
      capturedAt,
      fromUnit: kilogram,
      toUnit: gram,
    });

    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.fromUnit)).toBe(true);
    expect(Object.isFrozen(snapshot.toUnit)).toBe(true);
  });

  it("keeps historical conversion facts after a catalog version changes", () => {
    const oldSnapshot = createConversionSnapshot({
      snapshotId: "case-v1",
      capturedAt,
      fromUnit: createUnitDefinition({
        code: "case",
        name: "old case",
        symbol: "case",
        dimension: "count",
        toBaseFactor: "12",
        definitionVersion: 1,
        quantityScale: 0,
      }),
      toUnit: createUnitDefinition({
        code: "each",
        name: "each",
        symbol: "ea",
        dimension: "count",
        toBaseFactor: "1",
        definitionVersion: 1,
        quantityScale: 0,
      }),
    });
    const newSnapshot = createConversionSnapshot({
      snapshotId: "case-v2",
      capturedAt: "2026-10-01T12:00:00.000Z",
      fromUnit: createUnitDefinition({
        code: "case",
        name: "new case",
        symbol: "case",
        dimension: "count",
        toBaseFactor: "10",
        definitionVersion: 2,
        quantityScale: 0,
      }),
      toUnit: oldSnapshot.toUnit,
    });

    expect(convertQuantity("2", oldSnapshot)).toBe("24");
    expect(convertQuantity("2", newSnapshot)).toBe("20");
    expect(oldSnapshot.multiplier).toBe("12");
  });

  it("builds an exact inverse snapshot", () => {
    const forward = createConversionSnapshot({
      snapshotId: "kg-to-g",
      capturedAt,
      fromUnit: kilogram,
      toUnit: gram,
    });
    const inverse = invertConversionSnapshot(forward, {
      snapshotId: "g-to-kg",
      capturedAt,
    });

    expect(inverse.multiplier).toBe("0.001");
    expect(convertQuantity(convertQuantity("2.5", forward), inverse)).toBe(
      "2.5",
    );
  });
});
