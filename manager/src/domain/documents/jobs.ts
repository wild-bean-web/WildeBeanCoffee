import { z } from "zod";

import {
  hashCanonicalKeyParts,
  OpaqueIdSchema,
  Sha256HexSchema,
} from "../shared";

export const DOCUMENT_JOB_STAGES = [
  "receive",
  "quarantine",
  "classify",
  "extract",
  "dedupe",
  "match",
  "validate",
  "readiness",
] as const;

export const DocumentJobStageSchema = z.enum(DOCUMENT_JOB_STAGES);
export type DocumentJobStage = z.infer<typeof DocumentJobStageSchema>;

export const DocumentJobKeyInputSchema = z
  .object({
    stage: DocumentJobStageSchema,
    documentId: OpaqueIdSchema,
    revision: z.number().int().min(0),
    contentDigest: Sha256HexSchema.optional(),
  })
  .strict();

export type DocumentJobKeyInput = z.infer<
  typeof DocumentJobKeyInputSchema
>;

export const PostingJobKeyInputSchema = z
  .object({
    documentId: OpaqueIdSchema,
    approvalId: OpaqueIdSchema,
    approvedRevision: z.number().int().min(1),
    ledgerTarget: z.string().trim().min(1).max(128),
  })
  .strict();

export type PostingJobKeyInput = z.infer<typeof PostingJobKeyInputSchema>;

export const IdempotentJobKeySchema = z.string().regex(
  /^(?:document:(?:receive|quarantine|classify|extract|dedupe|match|validate|readiness)|posting):v1:[a-f0-9]{64}$/,
  "Invalid document-domain idempotency key",
);

export function buildDocumentJobKey(input: DocumentJobKeyInput): string {
  const parsed = DocumentJobKeyInputSchema.parse(input);
  const digest = hashCanonicalKeyParts("document-job-v1", [
    parsed.stage,
    parsed.documentId,
    parsed.revision,
    parsed.contentDigest ?? null,
  ]);
  return IdempotentJobKeySchema.parse(
    `document:${parsed.stage}:v1:${digest}`,
  );
}

export function buildPostingJobKey(input: PostingJobKeyInput): string {
  const parsed = PostingJobKeyInputSchema.parse(input);
  const digest = hashCanonicalKeyParts("approved-posting-job-v1", [
    parsed.documentId,
    parsed.approvalId,
    parsed.approvedRevision,
    parsed.ledgerTarget,
  ]);
  return IdempotentJobKeySchema.parse(`posting:v1:${digest}`);
}
