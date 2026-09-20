import { z } from "zod";

import {
  fixedDecimalsEqual,
  NonBlankStringSchema,
  NonNegativeCentsSchema,
  OpaqueIdSchema,
} from "../shared";
import { PackSchema } from "./extracted";

const VendorSkuSchema = z.string().trim().min(1).max(128);

export const CatalogProductSchema = z
  .object({
    catalogItemId: OpaqueIdSchema,
    vendorId: OpaqueIdSchema,
    vendorSku: VendorSkuSchema,
    description: NonBlankStringSchema,
    pack: PackSchema,
    unitPriceCents: NonNegativeCentsSchema.optional(),
    active: z.boolean().default(true),
  })
  .strict();

export type CatalogProduct = z.infer<typeof CatalogProductSchema>;

export const MatchableLineSchema = z
  .object({
    sourceLineId: z.string().trim().min(1).max(128),
    vendorId: OpaqueIdSchema,
    vendorSku: VendorSkuSchema.optional(),
    description: NonBlankStringSchema,
    pack: PackSchema.optional(),
    unitPriceCents: NonNegativeCentsSchema.optional(),
  })
  .strict();

export type MatchableLine = z.infer<typeof MatchableLineSchema>;

export const AiCandidateRankSchema = z
  .object({
    catalogItemId: OpaqueIdSchema,
    rank: z.number().int().min(1).max(1_000),
  })
  .strict();

export type AiCandidateRank = z.infer<typeof AiCandidateRankSchema>;

export const CandidateScorePolicySchema = z
  .object({
    minimumSuggestedScore: z.number().int().min(0).max(10_000),
    minimumSuggestionMargin: z.number().int().min(0).max(10_000),
    maximumCandidates: z.number().int().min(1).max(100),
  })
  .strict();

export type CandidateScorePolicy = z.infer<
  typeof CandidateScorePolicySchema
>;

export const DEFAULT_CANDIDATE_SCORE_POLICY: Readonly<CandidateScorePolicy> =
  Object.freeze({
    minimumSuggestedScore: 6_500,
    minimumSuggestionMargin: 750,
    maximumCandidates: 10,
  });

export interface CandidateScoreComponents {
  readonly sku: number;
  readonly description: number;
  readonly pack: number;
  readonly unitPrice: number;
  readonly aiRank: number;
}

export interface ScoredProductCandidate {
  readonly catalogItemId: string;
  readonly score: number;
  readonly components: CandidateScoreComponents;
}

export type ProductMatchResult =
  | {
      readonly kind: "exact";
      readonly sourceLineId: string;
      readonly catalogItemId: string;
      readonly method: "vendor_sku_pack";
    }
  | {
      readonly kind: "ambiguous_exact";
      readonly sourceLineId: string;
      readonly catalogItemIds: readonly string[];
    }
  | {
      readonly kind: "candidates";
      readonly sourceLineId: string;
      readonly candidates: readonly ScoredProductCandidate[];
      readonly suggestedCatalogItemId?: string;
    }
  | {
      readonly kind: "unmatched";
      readonly sourceLineId: string;
      readonly candidates: readonly [];
    };

export interface ProductMatchOptions {
  readonly policy?: Partial<CandidateScorePolicy>;
  readonly aiCandidateRanks?: readonly AiCandidateRank[];
}

export function matchProductLine(
  line: MatchableLine,
  catalog: readonly CatalogProduct[],
  options: ProductMatchOptions = {},
): ProductMatchResult {
  const parsedLine = MatchableLineSchema.parse(line);
  const parsedCatalog = z.array(CatalogProductSchema).parse(catalog);
  const vendorCatalog = parsedCatalog.filter(
    (candidate) =>
      candidate.active && candidate.vendorId === parsedLine.vendorId,
  );
  const lineVendorSku = parsedLine.vendorSku;
  const linePack = parsedLine.pack;

  const exactMatches =
    lineVendorSku && linePack
      ? vendorCatalog.filter(
          (candidate) =>
            normalizeVendorSku(candidate.vendorSku) ===
              normalizeVendorSku(lineVendorSku) &&
            packsEqual(candidate.pack, linePack),
        )
      : [];

  if (exactMatches.length === 1) {
    return {
      kind: "exact",
      sourceLineId: parsedLine.sourceLineId,
      catalogItemId: exactMatches[0].catalogItemId,
      method: "vendor_sku_pack",
    };
  }

  if (exactMatches.length > 1) {
    return {
      kind: "ambiguous_exact",
      sourceLineId: parsedLine.sourceLineId,
      catalogItemIds: exactMatches
        .map((candidate) => candidate.catalogItemId)
        .sort(compareStrings),
    };
  }

  const candidates = rankProductCandidates(
    parsedLine,
    vendorCatalog,
    options,
  );
  if (candidates.length === 0) {
    return {
      kind: "unmatched",
      sourceLineId: parsedLine.sourceLineId,
      candidates: [],
    };
  }

  const policy = CandidateScorePolicySchema.parse({
    ...DEFAULT_CANDIDATE_SCORE_POLICY,
    ...options.policy,
  });
  const first = candidates[0];
  const secondScore = candidates[1]?.score ?? 0;
  const suggestedCatalogItemId =
    first.score >= policy.minimumSuggestedScore &&
    first.score - secondScore >= policy.minimumSuggestionMargin
      ? first.catalogItemId
      : undefined;

  return {
    kind: "candidates",
    sourceLineId: parsedLine.sourceLineId,
    candidates,
    ...(suggestedCatalogItemId ? { suggestedCatalogItemId } : {}),
  };
}

export function rankProductCandidates(
  line: MatchableLine,
  catalog: readonly CatalogProduct[],
  options: ProductMatchOptions = {},
): readonly ScoredProductCandidate[] {
  const parsedLine = MatchableLineSchema.parse(line);
  const parsedCatalog = z.array(CatalogProductSchema).parse(catalog);
  const policy = CandidateScorePolicySchema.parse({
    ...DEFAULT_CANDIDATE_SCORE_POLICY,
    ...options.policy,
  });
  const aiRanks = parseAiRanks(options.aiCandidateRanks ?? []);

  return parsedCatalog
    .filter(
      (candidate) =>
        candidate.active && candidate.vendorId === parsedLine.vendorId,
    )
    .map((candidate) =>
      scoreCandidate(parsedLine, candidate, aiRanks.get(candidate.catalogItemId)),
    )
    .sort(
      (left, right) =>
        right.score - left.score ||
        compareStrings(left.catalogItemId, right.catalogItemId),
    )
    .slice(0, policy.maximumCandidates);
}

export function normalizeVendorSku(value: string): string {
  return VendorSkuSchema.parse(value)
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

export function packsEqual(
  left: z.infer<typeof PackSchema>,
  right: z.infer<typeof PackSchema>,
): boolean {
  const parsedLeft = PackSchema.parse(left);
  const parsedRight = PackSchema.parse(right);
  return (
    fixedDecimalsEqual(parsedLeft.quantity, parsedRight.quantity) &&
    normalizePackUnit(parsedLeft.unit) === normalizePackUnit(parsedRight.unit)
  );
}

function scoreCandidate(
  line: MatchableLine,
  candidate: CatalogProduct,
  aiRank?: number,
): ScoredProductCandidate {
  const sku = scoreSku(line.vendorSku, candidate.vendorSku);
  const description = scoreDescription(
    line.description,
    candidate.description,
  );
  const pack = scorePack(line.pack, candidate.pack);
  const unitPrice = scoreUnitPrice(
    line.unitPriceCents,
    candidate.unitPriceCents,
  );
  const aiRankPoints = aiRank ? Math.max(0, 251 - Math.min(aiRank, 251)) : 0;
  const components = {
    sku,
    description,
    pack,
    unitPrice,
    aiRank: aiRankPoints,
  };

  return {
    catalogItemId: candidate.catalogItemId,
    score:
      components.sku +
      components.description +
      components.pack +
      components.unitPrice +
      components.aiRank,
    components,
  };
}

function scoreSku(lineSku: string | undefined, candidateSku: string): number {
  if (!lineSku) {
    return 0;
  }
  const left = normalizeVendorSku(lineSku);
  const right = normalizeVendorSku(candidateSku);
  if (left === right) {
    return 3_500;
  }
  const maximumLength = Math.max(left.length, right.length);
  const distance = levenshteinDistance(left, right);
  return Math.floor(((maximumLength - distance) * 3_500) / maximumLength);
}

function scoreDescription(left: string, right: string): number {
  const leftTokens = tokenize(left);
  const rightTokens = tokenize(right);
  const intersection = [...leftTokens].filter((token) =>
    rightTokens.has(token),
  ).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union === 0 ? 0 : Math.floor((intersection * 3_500) / union);
}

function scorePack(
  linePack: z.infer<typeof PackSchema> | undefined,
  candidatePack: z.infer<typeof PackSchema>,
): number {
  if (!linePack) {
    return 0;
  }
  return (
    (fixedDecimalsEqual(linePack.quantity, candidatePack.quantity)
      ? 1_250
      : 0) +
    (normalizePackUnit(linePack.unit) === normalizePackUnit(candidatePack.unit)
      ? 750
      : 0)
  );
}

function scoreUnitPrice(
  linePrice: number | undefined,
  candidatePrice: number | undefined,
): number {
  if (linePrice === undefined || candidatePrice === undefined) {
    return 0;
  }
  if (linePrice === candidatePrice) {
    return 750;
  }
  const maximum = Math.max(linePrice, candidatePrice);
  if (maximum === 0) {
    return 750;
  }
  const delta = Math.abs(linePrice - candidatePrice);
  return Math.floor((Math.max(0, maximum - delta) * 750) / maximum);
}

function parseAiRanks(ranks: readonly AiCandidateRank[]): Map<string, number> {
  const parsed = z.array(AiCandidateRankSchema).max(1_000).parse(ranks);
  const result = new Map<string, number>();
  for (const rank of parsed) {
    if (result.has(rank.catalogItemId)) {
      throw new TypeError(`Duplicate AI rank for ${rank.catalogItemId}`);
    }
    result.set(rank.catalogItemId, rank.rank);
  }
  return result;
}

function normalizePackUnit(value: string): string {
  return value.normalize("NFKC").trim().toUpperCase();
}

function tokenize(value: string): Set<string> {
  return new Set(
    value
      .normalize("NFKC")
      .toUpperCase()
      .split(/[^A-Z0-9]+/)
      .filter((token) => token.length > 0),
  );
}

function levenshteinDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] +
          (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
