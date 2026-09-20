import { describe, expect, it } from "vitest";

import { evaluateConfidence } from "./confidence";

describe("confidence policy", () => {
  it("passes complete high-confidence critical fields", () => {
    const result = evaluateConfidence(
      [
        {
          fieldPath: "vendor.name",
          confidenceBps: 9_900,
          source: "ocr",
          weight: 2,
          critical: true,
        },
        {
          fieldPath: "totalCents",
          confidenceBps: 9_800,
          source: "parser",
          weight: 3,
          critical: true,
        },
      ],
      { requiredFieldPaths: ["vendor.name", "totalCents"] },
    );

    expect(result.passes).toBe(true);
    expect(result.aggregateBps).toBe(9_840);
    expect(result.failures).toEqual([]);
  });

  it("reports missing required fields deterministically", () => {
    const result = evaluateConfidence(
      [
        {
          fieldPath: "vendor.name",
          confidenceBps: 9_900,
          source: "ocr",
          weight: 1,
          critical: true,
        },
      ],
      {
        requiredFieldPaths: ["totalCents", "invoiceNumber", "vendor.name"],
      },
    );

    expect(
      result.failures
        .filter((failure) => failure.code === "missing_required_field")
        .map((failure) => failure.fieldPath),
    ).toEqual(["invoiceNumber", "totalCents"]);
  });

  it("fails low critical fields even when the aggregate is high", () => {
    const result = evaluateConfidence([
      {
        fieldPath: "invoiceNumber",
        confidenceBps: 9_400,
        source: "ocr",
        weight: 1,
        critical: true,
      },
      {
        fieldPath: "lines.0.description",
        confidenceBps: 10_000,
        source: "parser",
        weight: 20,
        critical: false,
      },
    ]);

    expect(result.aggregateBps).toBeGreaterThan(9_200);
    expect(result.passes).toBe(false);
    expect(result.failures).toContainEqual({
      code: "critical_field_below_minimum",
      fieldPath: "invoiceNumber",
      actualBps: 9_400,
      requiredBps: 9_500,
    });
  });

  it("caps AI confidence and does not let AI self-certify a critical field", () => {
    const result = evaluateConfidence([
      {
        fieldPath: "totalCents",
        confidenceBps: 10_000,
        source: "ai",
        weight: 1,
        critical: true,
      },
    ]);

    expect(result.effectiveConfidenceByField.totalCents).toBe(9_000);
    expect(result.passes).toBe(false);
    expect(result.failures.map((failure) => failure.code)).toContain(
      "critical_field_below_minimum",
    );
    expect(result.failures.map((failure) => failure.code)).toContain(
      "aggregate_below_minimum",
    );
  });

  it("counts low-confidence fields against the configured allowance", () => {
    const observations = [
      {
        fieldPath: "lines.0.vendorSku",
        confidenceBps: 7_900,
        source: "ocr" as const,
        weight: 1,
        critical: false,
      },
      {
        fieldPath: "lines.1.vendorSku",
        confidenceBps: 7_800,
        source: "ocr" as const,
        weight: 1,
        critical: false,
      },
    ];
    const result = evaluateConfidence(observations, {
      minimumAggregateBps: 8_000,
      minimumFieldBps: 8_000,
      minimumCriticalFieldBps: 9_000,
      maximumLowConfidenceFields: 1,
    });

    expect(result.lowConfidenceFieldPaths).toEqual([
      "lines.0.vendorSku",
      "lines.1.vendorSku",
    ]);
    expect(result.failures).toContainEqual({
      code: "too_many_low_confidence_fields",
      actualBps: 2,
      requiredBps: 1,
    });
  });

  it("rejects duplicate field observations instead of inflating confidence", () => {
    expect(() =>
      evaluateConfidence([
        {
          fieldPath: "totalCents",
          confidenceBps: 9_900,
          source: "parser",
          weight: 1,
          critical: true,
        },
        {
          fieldPath: "totalCents",
          confidenceBps: 10_000,
          source: "ai",
          weight: 100,
          critical: false,
        },
      ]),
    ).toThrow(/Duplicate confidence observation/);
  });
});
