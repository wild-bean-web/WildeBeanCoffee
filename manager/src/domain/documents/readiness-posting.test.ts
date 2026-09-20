import { describe, expect, it } from "vitest";

import { createPostingCommand } from "./posting";
import {
  decideDocumentReadiness,
  detectDocumentAnomalies,
  ReadinessInput,
} from "./readiness";

const readyInput: ReadinessInput = {
  status: "validated",
  documentType: "invoice",
  totalCents: 10_000,
  documentDate: "2026-09-15",
  evaluationDate: "2026-09-15",
  knownVendor: true,
  duplicateEvidence: "none",
  arithmeticValid: true,
  confidencePasses: true,
  lineMatchResolutions: ["exact"],
  externalAnomalies: [],
};

const approvedSnapshot = {
  schemaVersion: 1 as const,
  source: "approved_snapshot" as const,
  status: "approved" as const,
  documentId: "doc-1",
  approvedRevision: 8,
  documentType: "invoice" as const,
  vendorId: "vendor-1",
  currency: "CAD",
  subtotalCents: 10_000,
  taxCents: 750,
  totalCents: 10_750,
  lines: [
    {
      sourceLineId: "line-1",
      catalogItemId: "item-1",
      quantity: "2.000",
      lineTotalCents: 10_000,
    },
  ],
  approval: {
    approvalId: "approval-1",
    approvedBy: "manager-1",
    approvedAt: "2026-09-17T21:00:00Z",
  },
};

describe("anomaly and auto-ready policy", () => {
  it("marks a fully validated document auto-ready but never postable", () => {
    expect(decideDocumentReadiness(readyInput)).toEqual({
      targetStatus: "auto_ready",
      autoReady: true,
      mayPost: false,
      reasonCodes: [],
      anomalies: [],
    });
  });

  it("routes arithmetic and ambiguous-match failures to review", () => {
    const result = decideDocumentReadiness({
      ...readyInput,
      arithmeticValid: false,
      lineMatchResolutions: ["ambiguous_exact"],
    });

    expect(result.targetStatus).toBe("needs_review");
    expect(result.mayPost).toBe(false);
    expect(result.reasonCodes).toEqual([
      "arithmetic_invalid",
      "ambiguous_exact_match",
    ]);
    expect(result.anomalies.map((anomaly) => anomaly.severity)).toEqual([
      "blocking",
      "blocking",
    ]);
  });

  it("routes candidate-only matching and low confidence to review", () => {
    const result = decideDocumentReadiness({
      ...readyInput,
      confidencePasses: false,
      lineMatchResolutions: ["candidate"],
    });

    expect(result.targetStatus).toBe("needs_review");
    expect(result.reasonCodes).toEqual([
      "confidence_below_policy",
      "candidate_only_match",
    ]);
  });

  it("marks only exact duplicate evidence duplicate", () => {
    expect(
      decideDocumentReadiness({
        ...readyInput,
        duplicateEvidence: "exact",
      }).targetStatus,
    ).toBe("duplicate");
    expect(
      decideDocumentReadiness({
        ...readyInput,
        duplicateEvidence: "strong",
      }).targetStatus,
    ).toBe("needs_review");
  });

  it("detects vendor, amount, and date anomalies with explicit dates", () => {
    const anomalies = detectDocumentAnomalies(
      {
        ...readyInput,
        knownVendor: false,
        totalCents: 300_000,
        documentDate: "2026-09-18",
        evaluationDate: "2026-09-17",
      },
      { maximumAutoReadyTotalCents: 250_000 },
    );

    expect(anomalies.map((anomaly) => anomaly.code)).toEqual([
      "unknown_vendor",
      "total_over_auto_limit",
      "future_document_date",
    ]);
  });

  it("handles warning-only rules according to policy", () => {
    const input = {
      ...readyInput,
      externalAnomalies: [
        {
          code: "external_rule" as const,
          severity: "warning" as const,
          detail: "Unusual memo",
        },
      ],
    };

    expect(decideDocumentReadiness(input).targetStatus).toBe("auto_ready");
    expect(
      decideDocumentReadiness(input, { allowWarnings: false }).targetStatus,
    ).toBe("needs_review");
  });
});

describe("approved posting boundary", () => {
  it("builds a deterministic command only from an approved snapshot", () => {
    const command = createPostingCommand(
      approvedSnapshot,
      "primary-ledger",
    );

    expect(command.kind).toBe("post_approved_document");
    expect(command.source).toBe("approved_snapshot");
    expect(command.snapshot.status).toBe("approved");
    expect(command.idempotencyKey).toMatch(/^posting:v1:[a-f0-9]{64}$/);
    expect(
      createPostingCommand(approvedSnapshot, "primary-ledger").idempotencyKey,
    ).toBe(command.idempotencyKey);
  });

  it("rejects an extracted document even when its arithmetic is valid", () => {
    expect(() =>
      createPostingCommand(
        {
          schemaVersion: 1,
          source: "extracted",
          status: "extracted",
          documentId: "doc-1",
          documentType: "invoice",
          vendor: { name: "Vendor" },
          subtotalCents: 10_000,
          taxCents: 750,
          totalCents: 10_750,
        },
        "primary-ledger",
      ),
    ).toThrow();
  });

  it("rejects auto-ready and AI-derived snapshots", () => {
    expect(() =>
      createPostingCommand(
        { ...approvedSnapshot, status: "auto_ready" },
        "primary-ledger",
      ),
    ).toThrow();
    expect(() =>
      createPostingCommand(
        { ...approvedSnapshot, source: "ai" },
        "primary-ledger",
      ),
    ).toThrow();
  });

  it("rejects unknown AI or extraction fields on an approved snapshot", () => {
    expect(() =>
      createPostingCommand(
        { ...approvedSnapshot, aiCandidateRank: 1 },
        "primary-ledger",
      ),
    ).toThrow();
    expect(() =>
      createPostingCommand(
        { ...approvedSnapshot, extractedTotalCents: 10_750 },
        "primary-ledger",
      ),
    ).toThrow();
  });

  it("requires approval identity and rejects posting key reuse across approvals", () => {
    expect(() =>
      createPostingCommand(
        { ...approvedSnapshot, approval: undefined },
        "primary-ledger",
      ),
    ).toThrow();

    const first = createPostingCommand(approvedSnapshot, "primary-ledger");
    const second = createPostingCommand(
      {
        ...approvedSnapshot,
        approval: {
          ...approvedSnapshot.approval,
          approvalId: "approval-2",
        },
      },
      "primary-ledger",
    );
    expect(second.idempotencyKey).not.toBe(first.idempotencyKey);
  });
});
