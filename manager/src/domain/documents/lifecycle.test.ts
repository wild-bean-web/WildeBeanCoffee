import { describe, expect, it } from "vitest";

import {
  DOCUMENT_STATUSES,
  IllegalDocumentTransitionError,
  allowedDocumentTransitions,
  assertPostableDocumentStatus,
  canTransitionDocument,
  isPostableDocumentStatus,
  isTerminalDocumentStatus,
  transitionDocument,
} from "./lifecycle";

describe("document lifecycle", () => {
  it("defines every staged and terminal status exactly once", () => {
    expect(DOCUMENT_STATUSES).toEqual([
      "received",
      "quarantined",
      "classified",
      "extracted",
      "matched",
      "validated",
      "needs_review",
      "auto_ready",
      "approved",
      "posted",
      "duplicate",
      "failure",
      "voided",
    ]);
    expect(new Set(DOCUMENT_STATUSES).size).toBe(DOCUMENT_STATUSES.length);
  });

  it("allows the secure happy path", () => {
    const path = [
      "received",
      "quarantined",
      "classified",
      "extracted",
      "matched",
      "validated",
      "auto_ready",
      "approved",
      "posted",
    ] as const;

    for (let index = 0; index < path.length - 1; index += 1) {
      expect(canTransitionDocument(path[index], path[index + 1])).toBe(true);
    }
  });

  it("does not allow quarantine, extraction, validation, or approval to be skipped", () => {
    expect(canTransitionDocument("received", "classified")).toBe(false);
    expect(canTransitionDocument("quarantined", "extracted")).toBe(false);
    expect(canTransitionDocument("extracted", "validated")).toBe(false);
    expect(canTransitionDocument("validated", "approved")).toBe(false);
  });

  it("only allows approved documents to enter posted", () => {
    for (const status of DOCUMENT_STATUSES) {
      expect(canTransitionDocument(status, "posted")).toBe(
        status === "approved",
      );
      expect(isPostableDocumentStatus(status)).toBe(status === "approved");
    }

    expect(() => assertPostableDocumentStatus("extracted")).toThrow(
      IllegalDocumentTransitionError,
    );
    expect(() => assertPostableDocumentStatus("auto_ready")).toThrow(
      IllegalDocumentTransitionError,
    );
    expect(() => assertPostableDocumentStatus("approved")).not.toThrow();
  });

  it("supports review remediation without making review an approval", () => {
    expect(canTransitionDocument("needs_review", "matched")).toBe(true);
    expect(canTransitionDocument("needs_review", "validated")).toBe(true);
    expect(canTransitionDocument("needs_review", "approved")).toBe(true);
    expect(canTransitionDocument("needs_review", "posted")).toBe(false);
  });

  it("keeps posted and voided terminal, and lets owners void duplicates", () => {
    expect(isTerminalDocumentStatus("posted")).toBe(true);
    expect(isTerminalDocumentStatus("voided")).toBe(true);
    expect(isTerminalDocumentStatus("duplicate")).toBe(true);
    expect(allowedDocumentTransitions("posted")).toEqual([]);
    expect(allowedDocumentTransitions("voided")).toEqual([]);
    expect(canTransitionDocument("duplicate", "voided")).toBe(true);
    expect(canTransitionDocument("failure", "voided")).toBe(true);
    expect(canTransitionDocument("needs_review", "voided")).toBe(true);
    expect(canTransitionDocument("posted", "voided")).toBe(false);
  });

  it("returns a new revision and does not mutate current state", () => {
    const current = {
      documentId: "doc-1",
      status: "received" as const,
      revision: 0,
    };
    const next = transitionDocument(current, "quarantined");

    expect(next).toEqual({
      documentId: "doc-1",
      status: "quarantined",
      revision: 1,
    });
    expect(current).toEqual({
      documentId: "doc-1",
      status: "received",
      revision: 0,
    });
  });

  it("throws a domain error for an illegal transition", () => {
    expect(() =>
      transitionDocument(
        {
          documentId: "doc-1",
          status: "extracted",
          revision: 4,
        },
        "posted",
      ),
    ).toThrow(IllegalDocumentTransitionError);
  });
});
