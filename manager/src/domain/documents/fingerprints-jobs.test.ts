import { describe, expect, it } from "vitest";

import {
  buildBusinessIdentityFingerprint,
  buildContentFingerprint,
  buildLayeredDedupeFingerprints,
  buildSourceFingerprint,
  buildTransactionFingerprint,
  DedupeFingerprintSchema,
  findStrongestDedupeMatch,
} from "./fingerprints";
import {
  buildDocumentJobKey,
  buildPostingJobKey,
  DocumentJobKeyInputSchema,
  PostingJobKeyInputSchema,
} from "./jobs";

describe("layered dedupe fingerprints", () => {
  it("uses the raw content SHA-256 as the exact content layer", () => {
    expect(buildContentFingerprint("abc")).toEqual({
      kind: "content",
      strength: "exact",
      digest:
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
      key:
        "content:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    });
  });

  it("normalizes source-system identity while preserving external ID semantics", () => {
    expect(
      buildSourceFingerprint({
        sourceSystem: " Email ",
        externalId: " Message-42 ",
      }),
    ).toEqual(
      buildSourceFingerprint({
        sourceSystem: "email",
        externalId: "Message-42",
      }),
    );
    expect(
      buildSourceFingerprint({
        sourceSystem: "email",
        externalId: "message-42",
      }),
    ).not.toEqual(
      buildSourceFingerprint({
        sourceSystem: "email",
        externalId: "Message-42",
      }),
    );
  });

  it("normalizes formatting variants of vendor and invoice identities", () => {
    const first = buildBusinessIdentityFingerprint({
      documentType: "invoice",
      vendorKey: " North  Shore Foods ",
      documentNumber: " inv-001 / 26 ",
    });
    const second = buildBusinessIdentityFingerprint({
      documentType: "invoice",
      vendorKey: "north shore foods",
      documentNumber: "INV00126",
    });

    expect(first).toEqual(second);
    expect(first.strength).toBe("strong");
  });

  it("keeps transaction fingerprints heuristic and amount-sensitive", () => {
    const base = {
      documentType: "receipt" as const,
      vendorKey: "Corner Market",
      documentDate: "2026-09-15",
      totalCents: 1_000,
      currency: "CAD",
    };
    const first = buildTransactionFingerprint(base);

    expect(first.strength).toBe("heuristic");
    expect(
      buildTransactionFingerprint({ ...base, totalCents: 1_001 }).digest,
    ).not.toBe(first.digest);
  });

  it("builds layers from exact to heuristic without leaking source values", () => {
    const fingerprints = buildLayeredDedupeFingerprints({
      content: "private invoice bytes",
      source: { sourceSystem: "email", externalId: "secret-message-id" },
      businessIdentity: {
        documentType: "invoice",
        vendorKey: "Secret Vendor",
        documentNumber: "PRIVATE-123",
      },
      transactionIdentity: {
        documentType: "invoice",
        vendorKey: "Secret Vendor",
        documentDate: "2026-09-15",
        totalCents: 10_000,
        currency: "CAD",
      },
    });

    expect(fingerprints.map((fingerprint) => fingerprint.kind)).toEqual([
      "content",
      "source",
      "business_identity",
      "transaction",
    ]);
    expect(JSON.stringify(fingerprints)).not.toContain("Secret Vendor");
    expect(JSON.stringify(fingerprints)).not.toContain("PRIVATE-123");
    expect(JSON.stringify(fingerprints)).not.toContain("secret-message-id");
  });

  it("selects the strongest shared layer deterministically", () => {
    const commonBusiness = {
      documentType: "invoice" as const,
      vendorKey: "Vendor",
      documentNumber: "INV-1",
    };
    const left = [
      buildContentFingerprint("left"),
      buildBusinessIdentityFingerprint(commonBusiness),
      buildTransactionFingerprint({
        documentType: "invoice",
        vendorKey: "Vendor",
        documentDate: "2026-09-15",
        totalCents: 1_000,
        currency: "CAD",
      }),
    ];
    const right = [
      buildContentFingerprint("right"),
      buildBusinessIdentityFingerprint(commonBusiness),
      left[2],
    ];

    expect(findStrongestDedupeMatch(left, right)).toEqual({
      kind: "business_identity",
      strength: "strong",
      digest: left[1].digest,
    });
    expect(
      findStrongestDedupeMatch(
        [buildContentFingerprint("one")],
        [buildContentFingerprint("two")],
      ),
    ).toBeNull();
  });

  it("rejects forged keys or strengths that disagree with their layer", () => {
    const content = buildContentFingerprint("content");
    expect(() =>
      DedupeFingerprintSchema.parse({
        ...content,
        key: `content:${"0".repeat(64)}`,
      }),
    ).toThrow();
    expect(() =>
      DedupeFingerprintSchema.parse({
        ...content,
        strength: "heuristic",
      }),
    ).toThrow();
  });
});

describe("idempotent document job keys", () => {
  it("is stable for the same job identity and hides raw IDs", () => {
    const input = {
      stage: "extract" as const,
      documentId: "private-doc-123",
      revision: 2,
    };
    const first = buildDocumentJobKey(input);

    expect(buildDocumentJobKey(input)).toBe(first);
    expect(first).toMatch(/^document:extract:v1:[a-f0-9]{64}$/);
    expect(first).not.toContain(input.documentId);
  });

  it("changes across stages, revisions, and content versions", () => {
    const base = {
      stage: "extract" as const,
      documentId: "doc-1",
      revision: 1,
    };
    const first = buildDocumentJobKey(base);

    expect(buildDocumentJobKey({ ...base, stage: "match" })).not.toBe(first);
    expect(buildDocumentJobKey({ ...base, revision: 2 })).not.toBe(first);
    expect(
      buildDocumentJobKey({
        ...base,
        contentDigest: "a".repeat(64),
      }),
    ).not.toBe(first);
  });

  it("does not expose posting as an ordinary document processing stage", () => {
    expect(() =>
      DocumentJobKeyInputSchema.parse({
        stage: "post",
        documentId: "doc-1",
        revision: 1,
      }),
    ).toThrow();
  });

  it("ties posting idempotency to a specific approval and ledger target", () => {
    const base = {
      documentId: "doc-1",
      approvalId: "approval-1",
      approvedRevision: 8,
      ledgerTarget: "primary-ledger",
    };
    const first = buildPostingJobKey(base);

    expect(buildPostingJobKey(base)).toBe(first);
    expect(first).toMatch(/^posting:v1:[a-f0-9]{64}$/);
    expect(buildPostingJobKey({ ...base, approvalId: "approval-2" })).not.toBe(
      first,
    );
    expect(
      buildPostingJobKey({ ...base, ledgerTarget: "secondary-ledger" }),
    ).not.toBe(first);
  });

  it("rejects extracted or AI fields at the posting-key boundary", () => {
    expect(() =>
      PostingJobKeyInputSchema.parse({
        documentId: "doc-1",
        approvalId: "approval-1",
        approvedRevision: 8,
        ledgerTarget: "ledger",
        extractedTotalCents: 100,
      }),
    ).toThrow();
    expect(() =>
      PostingJobKeyInputSchema.parse({
        documentId: "doc-1",
        approvalId: "approval-1",
        approvedRevision: 8,
        ledgerTarget: "ledger",
        aiRank: 1,
      }),
    ).toThrow();
  });
});
