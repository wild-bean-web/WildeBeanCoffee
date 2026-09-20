import { describe, expect, it } from "vitest";
import {
  contributionAfterPrimeCents,
  largestCostLine,
  primeCostCents,
  salesRatio,
} from "./profit";

describe("location prime cost", () => {
  it("treats loaded labor plus COGS as prime cost", () => {
    expect(primeCostCents(4_000_00, 5_203_55)).toBe(9_203_55);
    expect(contributionAfterPrimeCents(20_000_00, 9_203_55)).toBe(10_796_45);
    expect(salesRatio(5_203_55, 20_000_00)).toBeCloseTo(0.2602, 3);
  });

  it("names the largest complete cost line", () => {
    const largest = largestCostLine([
      { key: "cogs", label: "Cost of goods", cents: 4_000_00, complete: true },
      { key: "labor", label: "Loaded labor", cents: 5_203_55, complete: true },
      { key: "occupancy", label: "Occupancy", cents: 0, complete: false },
    ]);
    expect(largest?.key).toBe("labor");
  });
});
