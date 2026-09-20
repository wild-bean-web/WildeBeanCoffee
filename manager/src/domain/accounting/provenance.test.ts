import { describe, expect, it } from "vitest";

import {
  assessProvenanceConfidence,
  createProvenanceSource,
  defaultReliabilityBps,
  isProvenanceStale,
} from "./provenance";

function supplierSource(
  overrides: Partial<Parameters<typeof createProvenanceSource>[0]> = {},
) {
  return createProvenanceSource({
    sourceId: "supplier-pdf",
    kind: "supplier_document",
    independenceKey: "invoice-100",
    observedAt: "2026-09-17T12:00:00.000Z",
    evidenceReference: "invoice.pdf",
    ...overrides,
  });
}

describe("source and provenance confidence", () => {
  it("applies explicit default reliability by source kind", () => {
    const source = supplierSource();

    expect(source.reliabilityBps).toBe(
      defaultReliabilityBps("supplier_document"),
    );
    expect(Object.isFrozen(source)).toBe(true);
  });

  it("combines independent support without floating point drift", () => {
    const confidence = assessProvenanceConfidence([
      supplierSource({ sourceId: "supplier", independenceKey: "supplier" }),
      supplierSource({
        sourceId: "receiving-document",
        independenceKey: "receiving-document",
      }),
    ]);

    // 1 - (1 - 0.8)^2 = 0.96.
    expect(confidence).toMatchObject({
      confidenceBps: 9_600,
      band: "very_high",
      sourceCount: 2,
      independentSourceCount: 2,
    });
  });

  it("does not inflate confidence for duplicate derivations", () => {
    const confidence = assessProvenanceConfidence([
      supplierSource({
        sourceId: "ocr",
        kind: "scanned_document",
        reliabilityBps: 7_000,
      }),
      supplierSource({
        sourceId: "manual-review",
        kind: "manual_entry",
        reliabilityBps: 8_500,
      }),
    ]);

    expect(confidence.confidenceBps).toBe(8_500);
    expect(confidence.independentSourceCount).toBe(1);
  });

  it("applies contradiction penalties and reports no-source confidence", () => {
    expect(
      assessProvenanceConfidence([
        supplierSource({ reliabilityBps: 8_000 }),
      ], { contradictionPenaltyBps: 5_000 }),
    ).toMatchObject({
      confidenceBps: 4_000,
      band: "low",
      contradictionPenaltyBps: 5_000,
    });

    expect(assessProvenanceConfidence([])).toMatchObject({
      confidenceBps: 0,
      band: "unverified",
      sourceCount: 0,
    });
  });

  it("rejects duplicate source identities", () => {
    const source = supplierSource();
    expect(() => assessProvenanceConfidence([source, source])).toThrow(
      /Duplicate provenance source/,
    );
  });

  it("checks source freshness with explicit boundary behavior", () => {
    const source = supplierSource();
    const oneHour = 60 * 60 * 1_000;

    expect(
      isProvenanceStale(
        source,
        "2026-09-17T13:00:00.000Z",
        oneHour,
      ),
    ).toBe(false);
    expect(
      isProvenanceStale(
        source,
        "2026-09-17T13:00:00.001Z",
        oneHour,
      ),
    ).toBe(true);
    expect(() =>
      isProvenanceStale(
        source,
        "2026-09-17T11:59:59.999Z",
        oneHour,
      ),
    ).toThrow(/after the as-of time/);
  });
});
