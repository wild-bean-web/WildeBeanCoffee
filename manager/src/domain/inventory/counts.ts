import Decimal from "decimal.js";
import { z } from "zod";

import {
  canonicalDecimal,
  deepFreeze,
  DomainDecimal,
  NonNegativeDecimalStringSchema,
  UnitDefinitionSchema,
  type DeepReadonly,
  type UnitDefinition,
} from "./uom";

export const BlindCountLineSchema = z.strictObject({
  lineId: z.string().trim().min(1).max(160),
  itemId: z.string().trim().min(1).max(160),
  locationId: z.string().trim().min(1).max(160),
  displayName: z.string().trim().min(1).max(160),
  countingUnit: UnitDefinitionSchema,
});

export type BlindCountLine = DeepReadonly<
  z.output<typeof BlindCountLineSchema>
>;

export const BlindCountEntrySchema = z.strictObject({
  lineId: z.string().trim().min(1).max(160),
  countedQuantity: NonNegativeDecimalStringSchema,
});

export type BlindCountEntry = DeepReadonly<
  z.output<typeof BlindCountEntrySchema>
>;

export const BlindCountSessionSchema = z
  .strictObject({
    sessionId: z.string().trim().min(1).max(160),
    parentSessionId: z.string().trim().min(1).max(160).optional(),
    round: z.number().int().min(1).max(100),
    assignedCounterId: z.string().trim().min(1).max(160),
    createdAt: z.string().datetime({ offset: true }),
    status: z.enum(["open", "submitted"]),
    lines: z.array(BlindCountLineSchema).min(1),
    submittedAt: z.string().datetime({ offset: true }).optional(),
    entries: z.array(BlindCountEntrySchema).optional(),
  })
  .superRefine((session, context) => {
    const lineIds = new Set<string>();
    const itemLocations = new Set<string>();
    for (const [index, line] of session.lines.entries()) {
      if (lineIds.has(line.lineId)) {
        context.addIssue({
          code: "custom",
          path: ["lines", index, "lineId"],
          message: "Count line IDs must be unique",
        });
      }
      lineIds.add(line.lineId);

      const itemLocation = `${line.itemId}\u0000${line.locationId}`;
      if (itemLocations.has(itemLocation)) {
        context.addIssue({
          code: "custom",
          path: ["lines", index],
          message: "An item/location may only appear once per session",
        });
      }
      itemLocations.add(itemLocation);
    }

    if (session.status === "open") {
      if (session.submittedAt !== undefined || session.entries !== undefined) {
        context.addIssue({
          code: "custom",
          message: "An open count cannot contain submitted results",
        });
      }
      return;
    }

    if (session.submittedAt === undefined || session.entries === undefined) {
      context.addIssue({
        code: "custom",
        message: "A submitted count requires a timestamp and entries",
      });
      return;
    }

    const entryIds = new Set<string>();
    for (const [index, entry] of session.entries.entries()) {
      if (entryIds.has(entry.lineId)) {
        context.addIssue({
          code: "custom",
          path: ["entries", index, "lineId"],
          message: "Each line may be counted only once",
        });
      }
      entryIds.add(entry.lineId);

      if (!lineIds.has(entry.lineId)) {
        context.addIssue({
          code: "custom",
          path: ["entries", index, "lineId"],
          message: "Count entry does not belong to this session",
        });
      }
    }

    if (
      entryIds.size !== lineIds.size ||
      [...lineIds].some((lineId) => !entryIds.has(lineId))
    ) {
      context.addIssue({
        code: "custom",
        path: ["entries"],
        message: "Every session line must be counted exactly once",
      });
    }

    if (Date.parse(session.submittedAt) < Date.parse(session.createdAt)) {
      context.addIssue({
        code: "custom",
        path: ["submittedAt"],
        message: "A count cannot be submitted before it is opened",
      });
    }
  });

export type BlindCountSession = DeepReadonly<
  z.output<typeof BlindCountSessionSchema>
>;

export interface CreateBlindCountSessionInput {
  readonly sessionId: string;
  readonly parentSessionId?: string;
  readonly round?: number;
  readonly assignedCounterId: string;
  readonly createdAt: string;
  readonly lines: readonly Readonly<{
    lineId: string;
    itemId: string;
    locationId: string;
    displayName: string;
    countingUnit: UnitDefinition;
  }>[];
}

/**
 * The counter-facing session type contains no expected quantity or value.
 * Zod strict objects also reject an accidental expectedQuantity property.
 */
export function createBlindCountSession(
  input: CreateBlindCountSessionInput,
): BlindCountSession {
  return deepFreeze(
    BlindCountSessionSchema.parse({
      ...input,
      round: input.round ?? 1,
      status: "open",
    }),
  );
}

export const SubmitBlindCountInputSchema = z.strictObject({
  submittedAt: z.string().datetime({ offset: true }),
  entries: z.array(BlindCountEntrySchema).min(1),
});

export type SubmitBlindCountInput = z.input<
  typeof SubmitBlindCountInputSchema
>;

export function submitBlindCount(
  sessionInput: BlindCountSession,
  submissionInput: SubmitBlindCountInput,
): BlindCountSession {
  const session = BlindCountSessionSchema.parse(sessionInput);
  if (session.status !== "open") {
    throw new Error("A blind count session can only be submitted once");
  }

  const submission = SubmitBlindCountInputSchema.parse(submissionInput);
  const entriesById = new Map(
    submission.entries.map((entry) => [entry.lineId, entry] as const),
  );

  // Normalize to the hidden session ordering without exposing any baseline.
  const entries = session.lines.map((line) => {
    const entry = entriesById.get(line.lineId);
    if (entry === undefined) {
      throw new Error(`Missing count for line ${line.lineId}`);
    }
    return entry;
  });

  if (entriesById.size !== session.lines.length) {
    throw new Error("Count submission contains duplicate or unknown lines");
  }

  return deepFreeze(
    BlindCountSessionSchema.parse({
      ...session,
      status: "submitted",
      submittedAt: submission.submittedAt,
      entries,
    }),
  );
}

export const CountBaselineLineSchema = z.strictObject({
  lineId: z.string().trim().min(1).max(160),
  expectedQuantity: NonNegativeDecimalStringSchema,
  unitCostCents: NonNegativeDecimalStringSchema,
});

export const CountBaselineSchema = z
  .strictObject({
    sessionId: z.string().trim().min(1).max(160),
    capturedAt: z.string().datetime({ offset: true }),
    lines: z.array(CountBaselineLineSchema).min(1),
  })
  .superRefine((baseline, context) => {
    const ids = new Set<string>();
    for (const [index, line] of baseline.lines.entries()) {
      if (ids.has(line.lineId)) {
        context.addIssue({
          code: "custom",
          path: ["lines", index, "lineId"],
          message: "Baseline line IDs must be unique",
        });
      }
      ids.add(line.lineId);
    }
  });

export type CountBaseline = DeepReadonly<
  z.output<typeof CountBaselineSchema>
>;

const SafeNonNegativeCentsSchema = z
  .number()
  .int()
  .min(0)
  .max(Number.MAX_SAFE_INTEGER);

export const RecountPolicySchema = z
  .strictObject({
    absoluteQuantityThreshold: NonNegativeDecimalStringSchema.optional(),
    varianceRatioThreshold: NonNegativeDecimalStringSchema.optional(),
    valueThresholdCents: SafeNonNegativeCentsSchema.optional(),
    recountUnexpectedStock: z.boolean().default(true),
  })
  .refine(
    (policy) =>
      policy.absoluteQuantityThreshold !== undefined ||
      policy.varianceRatioThreshold !== undefined ||
      policy.valueThresholdCents !== undefined ||
      policy.recountUnexpectedStock,
    "A recount policy must enable at least one decision rule",
  );

export type RecountPolicy = z.input<typeof RecountPolicySchema>;

export const RecountReasonSchema = z.enum([
  "absolute_quantity",
  "variance_ratio",
  "inventory_value",
  "unexpected_stock",
]);

export type RecountReason = z.infer<typeof RecountReasonSchema>;

export interface CountVarianceLine {
  readonly lineId: string;
  readonly expectedQuantity: string;
  readonly countedQuantity: string;
  readonly varianceQuantity: string;
  readonly absoluteVarianceQuantity: string;
  /** Absolute variance divided by expected quantity; null when expected is 0. */
  readonly varianceRatio: string | null;
  readonly estimatedValueVarianceCents: number;
  readonly recount: Readonly<{
    required: boolean;
    reasons: readonly RecountReason[];
  }>;
}

export interface CountVarianceEvaluation {
  readonly sessionId: string;
  readonly baselineCapturedAt: string;
  readonly lines: readonly CountVarianceLine[];
  readonly recountRequired: boolean;
  readonly recountLineIds: readonly string[];
}

function toSafeRoundedCents(value: InstanceType<typeof DomainDecimal>): number {
  const rounded = value.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  if (rounded.abs().gt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError("Count variance value exceeds safe integer cents");
  }
  return rounded.toNumber();
}

export function evaluateBlindCount(
  sessionInput: BlindCountSession,
  baselineInput: CountBaseline,
  policyInput: RecountPolicy,
): DeepReadonly<CountVarianceEvaluation> {
  const session = BlindCountSessionSchema.parse(sessionInput);
  if (session.status !== "submitted" || session.entries === undefined) {
    throw new Error("Only a submitted count can be evaluated");
  }

  const baseline = CountBaselineSchema.parse(baselineInput);
  if (baseline.sessionId !== session.sessionId) {
    throw new Error("Count baseline belongs to a different session");
  }
  if (Date.parse(baseline.capturedAt) > Date.parse(session.createdAt)) {
    throw new Error("Count baseline must be captured before the count opens");
  }

  const policy = RecountPolicySchema.parse(policyInput);
  const baselineById = new Map(
    baseline.lines.map((line) => [line.lineId, line] as const),
  );
  const entriesById = new Map(
    session.entries.map((entry) => [entry.lineId, entry] as const),
  );

  if (
    baselineById.size !== session.lines.length ||
    session.lines.some((line) => !baselineById.has(line.lineId))
  ) {
    throw new Error("Count baseline must cover every session line exactly");
  }

  const lines: CountVarianceLine[] = session.lines.map((sessionLine) => {
    const baselineLine = baselineById.get(sessionLine.lineId);
    const entry = entriesById.get(sessionLine.lineId);
    if (baselineLine === undefined || entry === undefined) {
      throw new Error(`Incomplete data for count line ${sessionLine.lineId}`);
    }

    const expected = new DomainDecimal(baselineLine.expectedQuantity);
    const counted = new DomainDecimal(entry.countedQuantity);
    const variance = counted.minus(expected);
    const absoluteVariance = variance.abs();
    const varianceRatio = expected.isZero()
      ? null
      : absoluteVariance.div(expected);
    const estimatedValueVarianceCents = toSafeRoundedCents(
      variance.mul(baselineLine.unitCostCents),
    );
    const reasons: RecountReason[] = [];

    if (
      !absoluteVariance.isZero() &&
      policy.absoluteQuantityThreshold !== undefined &&
      absoluteVariance.gt(policy.absoluteQuantityThreshold)
    ) {
      reasons.push("absolute_quantity");
    }
    if (
      varianceRatio !== null &&
      policy.varianceRatioThreshold !== undefined &&
      varianceRatio.gt(policy.varianceRatioThreshold)
    ) {
      reasons.push("variance_ratio");
    }
    if (
      policy.valueThresholdCents !== undefined &&
      Math.abs(estimatedValueVarianceCents) > policy.valueThresholdCents
    ) {
      reasons.push("inventory_value");
    }
    if (
      policy.recountUnexpectedStock &&
      expected.isZero() &&
      counted.gt(0)
    ) {
      reasons.push("unexpected_stock");
    }

    return {
      lineId: sessionLine.lineId,
      expectedQuantity: canonicalDecimal(expected),
      countedQuantity: canonicalDecimal(counted),
      varianceQuantity: canonicalDecimal(variance),
      absoluteVarianceQuantity: canonicalDecimal(absoluteVariance),
      varianceRatio:
        varianceRatio === null ? null : canonicalDecimal(varianceRatio),
      estimatedValueVarianceCents,
      recount: {
        required: reasons.length > 0,
        reasons,
      },
    };
  });
  const recountLineIds = lines
    .filter((line) => line.recount.required)
    .map((line) => line.lineId);

  return deepFreeze({
    sessionId: session.sessionId,
    baselineCapturedAt: baseline.capturedAt,
    lines,
    recountRequired: recountLineIds.length > 0,
    recountLineIds,
  });
}

export interface CreateRecountSessionInput {
  readonly sessionId: string;
  readonly assignedCounterId: string;
  readonly createdAt: string;
}

/**
 * Builds a fresh blind sheet for only the lines requiring recount. Neither
 * the baseline nor the first count is copied into the new counter-facing
 * session.
 */
export function createRecountSession(
  originalInput: BlindCountSession,
  evaluation: CountVarianceEvaluation,
  input: CreateRecountSessionInput,
): BlindCountSession {
  const original = BlindCountSessionSchema.parse(originalInput);
  if (original.status !== "submitted") {
    throw new Error("A recount requires a submitted original session");
  }
  if (evaluation.sessionId !== original.sessionId) {
    throw new Error("Recount evaluation belongs to a different session");
  }
  if (evaluation.recountLineIds.length === 0) {
    throw new Error("No count lines require a recount");
  }

  const requiredIds = new Set(evaluation.recountLineIds);
  const lines = original.lines.filter((line) => requiredIds.has(line.lineId));
  if (lines.length !== requiredIds.size) {
    throw new Error("Recount evaluation references an unknown line");
  }

  return createBlindCountSession({
    ...input,
    parentSessionId: original.sessionId,
    round: original.round + 1,
    lines,
  });
}
