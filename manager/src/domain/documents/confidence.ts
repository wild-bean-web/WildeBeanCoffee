import { z } from "zod";

export const ConfidenceBasisPointsSchema = z.number().int().min(0).max(10_000);

export const ConfidenceSourceSchema = z.enum([
  "ocr",
  "parser",
  "rule",
  "ai",
  "human",
]);
export type ConfidenceSource = z.infer<typeof ConfidenceSourceSchema>;

export const ConfidenceFieldPathSchema = z
  .string()
  .min(1)
  .max(256)
  .regex(
    /^[A-Za-z][A-Za-z0-9_]*(?:\.(?:[A-Za-z][A-Za-z0-9_]*|\d+))*$/,
    "Confidence field paths must use dotted field or array-index segments",
  );

export const ConfidenceObservationSchema = z
  .object({
    fieldPath: ConfidenceFieldPathSchema,
    confidenceBps: ConfidenceBasisPointsSchema,
    source: ConfidenceSourceSchema,
    weight: z.number().int().min(1).max(100).default(1),
    critical: z.boolean().default(false),
  })
  .strict();

export type ConfidenceObservation = z.infer<
  typeof ConfidenceObservationSchema
>;

export const ConfidencePolicySchema = z
  .object({
    requiredFieldPaths: z.array(ConfidenceFieldPathSchema).max(256),
    minimumAggregateBps: ConfidenceBasisPointsSchema,
    minimumFieldBps: ConfidenceBasisPointsSchema,
    minimumCriticalFieldBps: ConfidenceBasisPointsSchema,
    maximumLowConfidenceFields: z.number().int().min(0).max(500),
    maximumAiConfidenceBps: ConfidenceBasisPointsSchema,
  })
  .strict()
  .refine(
    (policy) =>
      policy.minimumCriticalFieldBps >= policy.minimumFieldBps &&
      policy.minimumAggregateBps >= policy.minimumFieldBps,
    {
      message:
        "Critical and aggregate thresholds cannot be below the field threshold",
    },
  );

export type ConfidencePolicy = z.infer<typeof ConfidencePolicySchema>;

export const DEFAULT_CONFIDENCE_POLICY: Readonly<ConfidencePolicy> =
  Object.freeze({
  requiredFieldPaths: [],
  minimumAggregateBps: 9_200,
  minimumFieldBps: 8_000,
  minimumCriticalFieldBps: 9_500,
  maximumLowConfidenceFields: 0,
  maximumAiConfidenceBps: 9_000,
  });

export const ConfidenceFailureCodeSchema = z.enum([
  "missing_required_field",
  "field_below_minimum",
  "critical_field_below_minimum",
  "aggregate_below_minimum",
  "too_many_low_confidence_fields",
]);
export type ConfidenceFailureCode = z.infer<
  typeof ConfidenceFailureCodeSchema
>;

export interface ConfidenceFailure {
  readonly code: ConfidenceFailureCode;
  readonly fieldPath?: string;
  readonly actualBps?: number;
  readonly requiredBps?: number;
}

export interface ConfidenceEvaluation {
  readonly passes: boolean;
  readonly aggregateBps: number;
  readonly effectiveConfidenceByField: Readonly<Record<string, number>>;
  readonly lowConfidenceFieldPaths: readonly string[];
  readonly failures: readonly ConfidenceFailure[];
}

export function evaluateConfidence(
  observations: readonly ConfidenceObservation[],
  policyOverrides: Partial<ConfidencePolicy> = {},
): ConfidenceEvaluation {
  const policy = ConfidencePolicySchema.parse({
    ...DEFAULT_CONFIDENCE_POLICY,
    ...policyOverrides,
  });
  const parsed = z
    .array(ConfidenceObservationSchema)
    .max(500)
    .parse(observations);

  const byField = new Map<string, ConfidenceObservation>();
  for (const observation of parsed) {
    if (byField.has(observation.fieldPath)) {
      throw new TypeError(
        `Duplicate confidence observation for ${observation.fieldPath}`,
      );
    }
    byField.set(observation.fieldPath, observation);
  }

  const failures: ConfidenceFailure[] = [];
  const effectiveConfidenceByField: Record<string, number> = {};
  const lowConfidenceFieldPaths: string[] = [];
  let weightedScore = 0;
  let totalWeight = 0;

  for (const observation of [...parsed].sort((a, b) =>
    a.fieldPath.localeCompare(b.fieldPath, "en"),
  )) {
    const effectiveBps =
      observation.source === "ai"
        ? Math.min(
            observation.confidenceBps,
            policy.maximumAiConfidenceBps,
          )
        : observation.confidenceBps;

    effectiveConfidenceByField[observation.fieldPath] = effectiveBps;
    weightedScore += effectiveBps * observation.weight;
    totalWeight += observation.weight;

    if (effectiveBps < policy.minimumFieldBps) {
      lowConfidenceFieldPaths.push(observation.fieldPath);
      failures.push({
        code: "field_below_minimum",
        fieldPath: observation.fieldPath,
        actualBps: effectiveBps,
        requiredBps: policy.minimumFieldBps,
      });
    }

    if (
      observation.critical &&
      effectiveBps < policy.minimumCriticalFieldBps
    ) {
      failures.push({
        code: "critical_field_below_minimum",
        fieldPath: observation.fieldPath,
        actualBps: effectiveBps,
        requiredBps: policy.minimumCriticalFieldBps,
      });
    }
  }

  for (const requiredFieldPath of [...new Set(policy.requiredFieldPaths)].sort(
    (a, b) => a.localeCompare(b, "en"),
  )) {
    if (!byField.has(requiredFieldPath)) {
      failures.push({
        code: "missing_required_field",
        fieldPath: requiredFieldPath,
      });
    }
  }

  const aggregateBps =
    totalWeight === 0 ? 0 : Math.floor(weightedScore / totalWeight);
  if (aggregateBps < policy.minimumAggregateBps) {
    failures.push({
      code: "aggregate_below_minimum",
      actualBps: aggregateBps,
      requiredBps: policy.minimumAggregateBps,
    });
  }

  if (
    lowConfidenceFieldPaths.length > policy.maximumLowConfidenceFields
  ) {
    failures.push({
      code: "too_many_low_confidence_fields",
      actualBps: lowConfidenceFieldPaths.length,
      requiredBps: policy.maximumLowConfidenceFields,
    });
  }

  return {
    passes: failures.length === 0,
    aggregateBps,
    effectiveConfidenceByField,
    lowConfidenceFieldPaths,
    failures,
  };
}
