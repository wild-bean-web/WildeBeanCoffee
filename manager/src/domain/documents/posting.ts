import { z } from "zod";

import {
  CurrencyCodeSchema,
  IsoDateTimeSchema,
  NonNegativeCentsSchema,
  OpaqueIdSchema,
  PositiveFixedDecimalStringSchema,
} from "../shared";
import { buildPostingJobKey, IdempotentJobKeySchema } from "./jobs";
import {
  DocumentTypeSchema,
  assertPostableDocumentStatus,
} from "./lifecycle";

export const ApprovedPostingLineSchema = z
  .object({
    sourceLineId: z.string().trim().min(1).max(128),
    catalogItemId: OpaqueIdSchema,
    quantity: PositiveFixedDecimalStringSchema,
    lineTotalCents: NonNegativeCentsSchema,
  })
  .strict();

export const ApprovedPostingSnapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    source: z.literal("approved_snapshot"),
    status: z.literal("approved"),
    documentId: OpaqueIdSchema,
    approvedRevision: z.number().int().min(1),
    documentType: DocumentTypeSchema,
    vendorId: OpaqueIdSchema,
    currency: CurrencyCodeSchema,
    subtotalCents: NonNegativeCentsSchema,
    taxCents: NonNegativeCentsSchema,
    totalCents: NonNegativeCentsSchema,
    lines: z.array(ApprovedPostingLineSchema).max(1_000),
    approval: z
      .object({
        approvalId: OpaqueIdSchema,
        approvedBy: OpaqueIdSchema,
        approvedAt: IsoDateTimeSchema,
      })
      .strict(),
  })
  .strict();

export type ApprovedPostingSnapshot = z.infer<
  typeof ApprovedPostingSnapshotSchema
>;

export const PostingCommandSchema = z
  .object({
    kind: z.literal("post_approved_document"),
    source: z.literal("approved_snapshot"),
    idempotencyKey: IdempotentJobKeySchema,
    ledgerTarget: z.string().trim().min(1).max(128),
    snapshot: ApprovedPostingSnapshotSchema,
  })
  .strict();

export type PostingCommand = z.infer<typeof PostingCommandSchema>;

export function createPostingCommand(
  input: unknown,
  ledgerTarget: string,
): PostingCommand {
  const snapshot = ApprovedPostingSnapshotSchema.parse(input);
  assertPostableDocumentStatus(snapshot.status);
  const parsedLedgerTarget = z.string().trim().min(1).max(128).parse(
    ledgerTarget,
  );

  return PostingCommandSchema.parse({
    kind: "post_approved_document",
    source: "approved_snapshot",
    idempotencyKey: buildPostingJobKey({
      documentId: snapshot.documentId,
      approvalId: snapshot.approval.approvalId,
      approvedRevision: snapshot.approvedRevision,
      ledgerTarget: parsedLedgerTarget,
    }),
    ledgerTarget: parsedLedgerTarget,
    snapshot,
  });
}
