import Decimal from "decimal.js";
import { z } from "zod";

import {
  deepFreeze,
  DomainDecimal,
  type DeepReadonly,
} from "../inventory/uom";

export const SourceKindSchema = z.enum([
  "system_calculation",
  "bank_feed",
  "point_of_sale",
  "supplier_document",
  "scanned_document",
  "data_import",
  "manual_entry",
]);

export type SourceKind = z.infer<typeof SourceKindSchema>;

const DEFAULT_RELIABILITY_BPS: Readonly<Record<SourceKind, number>> =
  Object.freeze({
    system_calculation: 9_500,
    bank_feed: 9_200,
    point_of_sale: 9_000,
    supplier_document: 8_000,
    scanned_document: 7_000,
    data_import: 6_500,
    manual_entry: 5_500,
  });

const BasisPointsSchema = z
  .number()
  .int()
  .min(0)
  .max(10_000);

export const ProvenanceSourceSchema = z.strictObject({
  sourceId: z.string().trim().min(1).max(160),
  kind: SourceKindSchema,
  /**
   * Sources derived from the same underlying artifact share this key and
   * therefore do not independently boost confidence.
   */
  independenceKey: z.string().trim().min(1).max(160),
  observedAt: z.string().datetime({ offset: true }),
  reliabilityBps: BasisPointsSchema,
  evidenceReference: z.string().trim().min(1).max(500).optional(),
});

export type ProvenanceSource = DeepReadonly<
  z.output<typeof ProvenanceSourceSchema>
>;

export interface CreateProvenanceSourceInput {
  readonly sourceId: string;
  readonly kind: SourceKind;
  readonly independenceKey: string;
  readonly observedAt: string;
  readonly reliabilityBps?: number;
  readonly evidenceReference?: string;
}

export function defaultReliabilityBps(kind: SourceKind): number {
  return DEFAULT_RELIABILITY_BPS[kind];
}

export function createProvenanceSource(
  input: CreateProvenanceSourceInput,
): ProvenanceSource {
  return deepFreeze(
    ProvenanceSourceSchema.parse({
      ...input,
      reliabilityBps:
        input.reliabilityBps ?? defaultReliabilityBps(input.kind),
    }),
  );
}

export const ConfidenceBandSchema = z.enum([
  "very_high",
  "high",
  "medium",
  "low",
  "unverified",
]);

export type ConfidenceBand = z.infer<typeof ConfidenceBandSchema>;

export interface ProvenanceConfidence {
  readonly confidenceBps: number;
  readonly band: ConfidenceBand;
  readonly sourceCount: number;
  readonly independentSourceCount: number;
  readonly sourceIds: readonly string[];
  readonly contradictionPenaltyBps: number;
}

function confidenceBand(confidenceBps: number): ConfidenceBand {
  if (confidenceBps >= 9_500) return "very_high";
  if (confidenceBps >= 8_000) return "high";
  if (confidenceBps >= 6_000) return "medium";
  if (confidenceBps > 0) return "low";
  return "unverified";
}

/**
 * Combines independent observations as 1 - product(1 - reliability). For
 * observations sharing an independence key, only the strongest is counted,
 * preventing duplicate imports of one document from inflating confidence.
 */
export function assessProvenanceConfidence(
  sourceInputs: readonly ProvenanceSource[],
  options: Readonly<{ contradictionPenaltyBps?: number }> = {},
): DeepReadonly<ProvenanceConfidence> {
  const sources = sourceInputs.map((source) =>
    ProvenanceSourceSchema.parse(source),
  );
  const contradictionPenaltyBps = BasisPointsSchema.parse(
    options.contradictionPenaltyBps ?? 0,
  );
  const sourceIds = new Set<string>();
  const strongestByIndependentSource = new Map<string, number>();

  for (const source of sources) {
    if (sourceIds.has(source.sourceId)) {
      throw new Error(`Duplicate provenance source ${source.sourceId}`);
    }
    sourceIds.add(source.sourceId);
    strongestByIndependentSource.set(
      source.independenceKey,
      Math.max(
        strongestByIndependentSource.get(source.independenceKey) ?? 0,
        source.reliabilityBps,
      ),
    );
  }

  let probabilityNotSupported = new DomainDecimal(1);
  for (const reliabilityBps of strongestByIndependentSource.values()) {
    probabilityNotSupported = probabilityNotSupported.mul(
      new DomainDecimal(1).minus(
        new DomainDecimal(reliabilityBps).div(10_000),
      ),
    );
  }

  const supportedProbability = new DomainDecimal(1).minus(
    probabilityNotSupported,
  );
  const afterContradictionPenalty = supportedProbability.mul(
    new DomainDecimal(1).minus(
      new DomainDecimal(contradictionPenaltyBps).div(10_000),
    ),
  );
  const confidenceBps = afterContradictionPenalty
    .mul(10_000)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toNumber();

  return deepFreeze({
    confidenceBps,
    band: confidenceBand(confidenceBps),
    sourceCount: sources.length,
    independentSourceCount: strongestByIndependentSource.size,
    sourceIds: [...sourceIds].sort(),
    contradictionPenaltyBps,
  });
}

export function isProvenanceStale(
  sourceInput: ProvenanceSource,
  asOf: string,
  maxAgeMilliseconds: number,
): boolean {
  const source = ProvenanceSourceSchema.parse(sourceInput);
  const parsedAsOf = z.string().datetime({ offset: true }).parse(asOf);
  if (
    !Number.isSafeInteger(maxAgeMilliseconds) ||
    maxAgeMilliseconds < 0
  ) {
    throw new RangeError("Maximum provenance age must be safe and non-negative");
  }

  const age = Date.parse(parsedAsOf) - Date.parse(source.observedAt);
  if (age < 0) {
    throw new RangeError("Provenance cannot be observed after the as-of time");
  }
  return age > maxAgeMilliseconds;
}
