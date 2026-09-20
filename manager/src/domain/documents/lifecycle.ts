import { z } from "zod";

import { OpaqueIdSchema } from "../shared";

export const DOCUMENT_TYPES = ["invoice", "receipt"] as const;
export const DocumentTypeSchema = z.enum(DOCUMENT_TYPES);
export type DocumentType = z.infer<typeof DocumentTypeSchema>;

export const DOCUMENT_STATUSES = [
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
] as const;

export const DocumentStatusSchema = z.enum(DOCUMENT_STATUSES);
export type DocumentStatus = z.infer<typeof DocumentStatusSchema>;

export const DocumentLifecycleSchema = z
  .object({
    documentId: OpaqueIdSchema,
    documentType: DocumentTypeSchema.optional(),
    status: DocumentStatusSchema,
    revision: z.number().int().min(0),
  })
  .strict();

export type DocumentLifecycle = z.infer<typeof DocumentLifecycleSchema>;

export const LEGAL_DOCUMENT_TRANSITIONS: Readonly<
  Record<DocumentStatus, readonly DocumentStatus[]>
> = Object.freeze({
  received: frozenStatuses("quarantined", "duplicate", "failure", "voided"),
  quarantined: frozenStatuses("classified", "duplicate", "failure", "voided"),
  classified: frozenStatuses(
    "extracted",
    "needs_review",
    "duplicate",
    "failure",
    "voided",
  ),
  extracted: frozenStatuses(
    "matched",
    "needs_review",
    "duplicate",
    "failure",
    "voided",
  ),
  matched: frozenStatuses(
    "validated",
    "needs_review",
    "duplicate",
    "failure",
    "voided",
  ),
  validated: frozenStatuses(
    "auto_ready",
    "needs_review",
    "duplicate",
    "failure",
    "voided",
  ),
  needs_review: frozenStatuses(
    "classified",
    "extracted",
    "matched",
    "validated",
    "approved",
    "failure",
    "voided",
  ),
  auto_ready: frozenStatuses("approved", "needs_review", "voided"),
  approved: frozenStatuses("posted", "voided"),
  posted: frozenStatuses(),
  duplicate: frozenStatuses("voided"),
  failure: frozenStatuses("voided"),
  voided: frozenStatuses(),
});

const TERMINAL_STATUSES = new Set<DocumentStatus>([
  "posted",
  "duplicate",
  "failure",
  "voided",
]);

export class IllegalDocumentTransitionError extends Error {
  readonly from: DocumentStatus;
  readonly to: DocumentStatus;

  constructor(from: DocumentStatus, to: DocumentStatus) {
    super(`Illegal document transition: ${from} -> ${to}`);
    this.name = "IllegalDocumentTransitionError";
    this.from = from;
    this.to = to;
  }
}

export function allowedDocumentTransitions(
  from: DocumentStatus,
): readonly DocumentStatus[] {
  return LEGAL_DOCUMENT_TRANSITIONS[DocumentStatusSchema.parse(from)];
}

export function canTransitionDocument(
  from: DocumentStatus,
  to: DocumentStatus,
): boolean {
  const parsedFrom = DocumentStatusSchema.parse(from);
  const parsedTo = DocumentStatusSchema.parse(to);
  return LEGAL_DOCUMENT_TRANSITIONS[parsedFrom].includes(parsedTo);
}

export const canTransition = canTransitionDocument;

export function assertDocumentTransition(
  from: DocumentStatus,
  to: DocumentStatus,
): void {
  if (!canTransitionDocument(from, to)) {
    throw new IllegalDocumentTransitionError(from, to);
  }
}

export function transitionDocument(
  current: DocumentLifecycle,
  to: DocumentStatus,
): DocumentLifecycle {
  const parsed = DocumentLifecycleSchema.parse(current);
  const parsedTarget = DocumentStatusSchema.parse(to);
  assertDocumentTransition(parsed.status, parsedTarget);

  return {
    ...parsed,
    status: parsedTarget,
    revision: parsed.revision + 1,
  };
}

export function isTerminalDocumentStatus(status: DocumentStatus): boolean {
  return TERMINAL_STATUSES.has(DocumentStatusSchema.parse(status));
}

export function isPostableDocumentStatus(status: DocumentStatus): boolean {
  return DocumentStatusSchema.parse(status) === "approved";
}

export function assertPostableDocumentStatus(status: DocumentStatus): void {
  const parsed = DocumentStatusSchema.parse(status);
  if (!isPostableDocumentStatus(parsed)) {
    throw new IllegalDocumentTransitionError(parsed, "posted");
  }
}

function frozenStatuses(
  ...statuses: DocumentStatus[]
): readonly DocumentStatus[] {
  return Object.freeze(statuses);
}
