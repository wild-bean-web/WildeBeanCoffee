import { z } from "zod";

import {
  IsoDateSchema,
  NonNegativeCentsSchema,
} from "../shared";
import { DocumentTypeSchema, assertDocumentTransition } from "./lifecycle";

export const DuplicateEvidenceSchema = z.enum([
  "none",
  "heuristic",
  "strong",
  "exact",
]);
export type DuplicateEvidence = z.infer<typeof DuplicateEvidenceSchema>;

export const LineMatchResolutionSchema = z.enum([
  "exact",
  "candidate",
  "unmatched",
  "ambiguous_exact",
]);
export type LineMatchResolution = z.infer<
  typeof LineMatchResolutionSchema
>;

export const AnomalySeveritySchema = z.enum([
  "warning",
  "review",
  "blocking",
]);
export type AnomalySeverity = z.infer<typeof AnomalySeveritySchema>;

export const AnomalyCodeSchema = z.enum([
  "exact_duplicate",
  "possible_duplicate",
  "arithmetic_invalid",
  "confidence_below_policy",
  "unknown_vendor",
  "zero_total",
  "total_over_auto_limit",
  "future_document_date",
  "candidate_only_match",
  "unmatched_line",
  "ambiguous_exact_match",
  "external_rule",
]);
export type AnomalyCode = z.infer<typeof AnomalyCodeSchema>;

export const DocumentAnomalySchema = z
  .object({
    code: AnomalyCodeSchema,
    severity: AnomalySeveritySchema,
    path: z.string().trim().min(1).max(256).optional(),
    detail: z.string().trim().min(1).max(512).optional(),
  })
  .strict();

export type DocumentAnomaly = z.infer<typeof DocumentAnomalySchema>;

export const ReadinessInputSchema = z
  .object({
    status: z.literal("validated"),
    documentType: DocumentTypeSchema,
    totalCents: NonNegativeCentsSchema,
    documentDate: IsoDateSchema,
    evaluationDate: IsoDateSchema,
    knownVendor: z.boolean(),
    duplicateEvidence: DuplicateEvidenceSchema.default("none"),
    arithmeticValid: z.boolean(),
    confidencePasses: z.boolean(),
    lineMatchResolutions: z.array(LineMatchResolutionSchema).max(1_000),
    externalAnomalies: z.array(DocumentAnomalySchema).max(100).default([]),
  })
  .strict();

export type ReadinessInput = z.infer<typeof ReadinessInputSchema>;

export const AutoReadyPolicySchema = z
  .object({
    maximumAutoReadyTotalCents: NonNegativeCentsSchema,
    futureDateGraceDays: z.number().int().min(0).max(30),
    allowWarnings: z.boolean(),
  })
  .strict();

export type AutoReadyPolicy = z.infer<typeof AutoReadyPolicySchema>;

export const DEFAULT_AUTO_READY_POLICY: Readonly<AutoReadyPolicy> =
  Object.freeze({
    maximumAutoReadyTotalCents: 250_000,
    futureDateGraceDays: 0,
    allowWarnings: true,
  });

export type ReadinessTargetStatus =
  | "auto_ready"
  | "needs_review"
  | "duplicate";

export interface ReadinessDecision {
  readonly targetStatus: ReadinessTargetStatus;
  readonly autoReady: boolean;
  readonly mayPost: false;
  readonly reasonCodes: readonly AnomalyCode[];
  readonly anomalies: readonly DocumentAnomaly[];
}

export function detectDocumentAnomalies(
  input: ReadinessInput,
  policyOverrides: Partial<AutoReadyPolicy> = {},
): readonly DocumentAnomaly[] {
  const parsed = ReadinessInputSchema.parse(input);
  const policy = AutoReadyPolicySchema.parse({
    ...DEFAULT_AUTO_READY_POLICY,
    ...policyOverrides,
  });
  const anomalies: DocumentAnomaly[] = [];

  if (parsed.duplicateEvidence === "exact") {
    anomalies.push({
      code: "exact_duplicate",
      severity: "blocking",
    });
  } else if (
    parsed.duplicateEvidence === "strong" ||
    parsed.duplicateEvidence === "heuristic"
  ) {
    anomalies.push({
      code: "possible_duplicate",
      severity: "review",
    });
  }

  if (!parsed.arithmeticValid) {
    anomalies.push({
      code: "arithmetic_invalid",
      severity: "blocking",
    });
  }
  if (!parsed.confidencePasses) {
    anomalies.push({
      code: "confidence_below_policy",
      severity: "review",
    });
  }
  if (!parsed.knownVendor) {
    anomalies.push({
      code: "unknown_vendor",
      severity: "review",
    });
  }
  if (parsed.totalCents === 0) {
    anomalies.push({
      code: "zero_total",
      severity: "review",
      path: "totalCents",
    });
  } else if (parsed.totalCents > policy.maximumAutoReadyTotalCents) {
    anomalies.push({
      code: "total_over_auto_limit",
      severity: "review",
      path: "totalCents",
    });
  }

  if (
    differenceInUtcDays(parsed.documentDate, parsed.evaluationDate) >
    policy.futureDateGraceDays
  ) {
    anomalies.push({
      code: "future_document_date",
      severity: "review",
      path:
        parsed.documentType === "invoice" ? "issuedDate" : "transactionDate",
    });
  }

  parsed.lineMatchResolutions.forEach((resolution, index) => {
    if (resolution === "candidate") {
      anomalies.push({
        code: "candidate_only_match",
        severity: "review",
        path: `lines.${index}`,
      });
    } else if (resolution === "unmatched") {
      anomalies.push({
        code: "unmatched_line",
        severity: "review",
        path: `lines.${index}`,
      });
    } else if (resolution === "ambiguous_exact") {
      anomalies.push({
        code: "ambiguous_exact_match",
        severity: "blocking",
        path: `lines.${index}`,
      });
    }
  });

  anomalies.push(
    ...parsed.externalAnomalies.sort(
      (left, right) =>
        compareStrings(left.code, right.code) ||
        compareStrings(left.path ?? "", right.path ?? ""),
    ),
  );

  return anomalies;
}

export function decideDocumentReadiness(
  input: ReadinessInput,
  policyOverrides: Partial<AutoReadyPolicy> = {},
): ReadinessDecision {
  const parsed = ReadinessInputSchema.parse(input);
  const policy = AutoReadyPolicySchema.parse({
    ...DEFAULT_AUTO_READY_POLICY,
    ...policyOverrides,
  });
  const anomalies = detectDocumentAnomalies(parsed, policy);

  let targetStatus: ReadinessTargetStatus;
  if (parsed.duplicateEvidence === "exact") {
    targetStatus = "duplicate";
  } else {
    const requiresReview = anomalies.some(
      (anomaly) =>
        anomaly.severity === "blocking" ||
        anomaly.severity === "review" ||
        (anomaly.severity === "warning" && !policy.allowWarnings),
    );
    targetStatus = requiresReview ? "needs_review" : "auto_ready";
  }

  assertDocumentTransition(parsed.status, targetStatus);

  return {
    targetStatus,
    autoReady: targetStatus === "auto_ready",
    mayPost: false,
    reasonCodes: [...new Set(anomalies.map((anomaly) => anomaly.code))],
    anomalies,
  };
}

function differenceInUtcDays(laterDate: string, earlierDate: string): number {
  return (
    (Date.parse(`${laterDate}T00:00:00.000Z`) -
      Date.parse(`${earlierDate}T00:00:00.000Z`)) /
    86_400_000
  );
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
