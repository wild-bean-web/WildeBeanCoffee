import { z } from "zod";

import {
  CurrencyCodeSchema,
  hashCanonicalKeyParts,
  IsoDateSchema,
  NonBlankStringSchema,
  NonNegativeCentsSchema,
  Sha256HexSchema,
  sha256Hex,
} from "../shared";
import { DocumentType, DocumentTypeSchema } from "./lifecycle";

export const DEDUPE_FINGERPRINT_KINDS = [
  "content",
  "source",
  "business_identity",
  "transaction",
] as const;

export const DedupeFingerprintKindSchema = z.enum(
  DEDUPE_FINGERPRINT_KINDS,
);
export type DedupeFingerprintKind = z.infer<
  typeof DedupeFingerprintKindSchema
>;

export const DedupeFingerprintStrengthSchema = z.enum([
  "exact",
  "strong",
  "heuristic",
]);
export type DedupeFingerprintStrength = z.infer<
  typeof DedupeFingerprintStrengthSchema
>;

export const DedupeFingerprintSchema = z
  .object({
    kind: DedupeFingerprintKindSchema,
    strength: DedupeFingerprintStrengthSchema,
    digest: Sha256HexSchema,
    key: z.string().regex(
      /^(?:content|source|business_identity|transaction):[a-f0-9]{64}$/,
    ),
  })
  .strict()
  .refine(
    (fingerprint) =>
      fingerprint.key === `${fingerprint.kind}:${fingerprint.digest}`,
    "Fingerprint key must contain its kind and digest",
  )
  .refine(
    (fingerprint) =>
      fingerprint.strength === expectedStrength(fingerprint.kind),
    "Fingerprint strength does not match its layer",
  );

export type DedupeFingerprint = z.infer<typeof DedupeFingerprintSchema>;

export interface SourceIdentity {
  readonly sourceSystem: string;
  readonly externalId: string;
}

export interface BusinessIdentity {
  readonly documentType: DocumentType;
  readonly vendorKey: string;
  readonly documentNumber: string;
}

export interface TransactionIdentity {
  readonly documentType: DocumentType;
  readonly vendorKey: string;
  readonly documentDate: string;
  readonly totalCents: number;
  readonly currency: string;
}

export interface LayeredDedupeInput {
  readonly content: string | Uint8Array;
  readonly source?: SourceIdentity;
  readonly businessIdentity?: BusinessIdentity;
  readonly transactionIdentity?: TransactionIdentity;
}

export interface DedupeFingerprintMatch {
  readonly kind: DedupeFingerprintKind;
  readonly strength: DedupeFingerprintStrength;
  readonly digest: string;
}

const KIND_PRIORITY: Readonly<Record<DedupeFingerprintKind, number>> = {
  content: 400,
  source: 300,
  business_identity: 200,
  transaction: 100,
};

export function buildContentFingerprint(
  content: string | Uint8Array,
): DedupeFingerprint {
  return makeFingerprint("content", "exact", sha256Hex(content));
}

export function buildSourceFingerprint(
  source: SourceIdentity,
): DedupeFingerprint {
  const sourceSystem = normalizeSourceSystem(source.sourceSystem);
  const externalId = normalizeExternalId(source.externalId);
  return makeFingerprint(
    "source",
    "exact",
    hashCanonicalKeyParts("document-source-v1", [sourceSystem, externalId]),
  );
}

export function buildBusinessIdentityFingerprint(
  identity: BusinessIdentity,
): DedupeFingerprint {
  const documentType = DocumentTypeSchema.parse(identity.documentType);
  const vendorKey = normalizeVendorKey(identity.vendorKey);
  const documentNumber = normalizeDocumentNumber(identity.documentNumber);
  return makeFingerprint(
    "business_identity",
    "strong",
    hashCanonicalKeyParts("document-business-identity-v1", [
      documentType,
      vendorKey,
      documentNumber,
    ]),
  );
}

export function buildTransactionFingerprint(
  identity: TransactionIdentity,
): DedupeFingerprint {
  const documentType = DocumentTypeSchema.parse(identity.documentType);
  const vendorKey = normalizeVendorKey(identity.vendorKey);
  const documentDate = IsoDateSchema.parse(identity.documentDate);
  const totalCents = NonNegativeCentsSchema.parse(identity.totalCents);
  const currency = CurrencyCodeSchema.parse(identity.currency);

  return makeFingerprint(
    "transaction",
    "heuristic",
    hashCanonicalKeyParts("document-transaction-v1", [
      documentType,
      vendorKey,
      documentDate,
      totalCents,
      currency,
    ]),
  );
}

export function buildLayeredDedupeFingerprints(
  input: LayeredDedupeInput,
): readonly DedupeFingerprint[] {
  const fingerprints: DedupeFingerprint[] = [
    buildContentFingerprint(input.content),
  ];

  if (input.source) {
    fingerprints.push(buildSourceFingerprint(input.source));
  }
  if (input.businessIdentity) {
    fingerprints.push(
      buildBusinessIdentityFingerprint(input.businessIdentity),
    );
  }
  if (input.transactionIdentity) {
    fingerprints.push(
      buildTransactionFingerprint(input.transactionIdentity),
    );
  }

  return fingerprints;
}

export function findStrongestDedupeMatch(
  left: readonly DedupeFingerprint[],
  right: readonly DedupeFingerprint[],
): DedupeFingerprintMatch | null {
  const rightKeys = new Set(
    right.map((fingerprint) => DedupeFingerprintSchema.parse(fingerprint).key),
  );

  const matches = left
    .map((fingerprint) => DedupeFingerprintSchema.parse(fingerprint))
    .filter((fingerprint) => rightKeys.has(fingerprint.key))
    .sort(
      (a, b) =>
        KIND_PRIORITY[b.kind] - KIND_PRIORITY[a.kind] ||
        a.key.localeCompare(b.key, "en"),
    );

  const match = matches[0];
  return match
    ? {
        kind: match.kind,
        strength: match.strength,
        digest: match.digest,
      }
    : null;
}

export function normalizeVendorKey(value: string): string {
  return NonBlankStringSchema.parse(value)
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

export function normalizeDocumentNumber(value: string): string {
  const normalized = NonBlankStringSchema.parse(value)
    .normalize("NFKC")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  if (normalized.length === 0) {
    throw new TypeError("Document number must contain a letter or number");
  }
  return normalized;
}

function normalizeSourceSystem(value: string): string {
  return NonBlankStringSchema.parse(value)
    .normalize("NFKC")
    .trim()
    .toLowerCase();
}

function normalizeExternalId(value: string): string {
  return NonBlankStringSchema.parse(value).normalize("NFKC").trim();
}

function makeFingerprint(
  kind: DedupeFingerprintKind,
  strength: DedupeFingerprintStrength,
  digest: string,
): DedupeFingerprint {
  return DedupeFingerprintSchema.parse({
    kind,
    strength,
    digest,
    key: `${kind}:${digest}`,
  });
}

function expectedStrength(
  kind: DedupeFingerprintKind,
): DedupeFingerprintStrength {
  if (kind === "content" || kind === "source") {
    return "exact";
  }
  return kind === "business_identity" ? "strong" : "heuristic";
}
