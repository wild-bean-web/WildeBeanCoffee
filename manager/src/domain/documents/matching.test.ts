import { describe, expect, it } from "vitest";

import {
  matchProductLine,
  packsEqual,
  rankProductCandidates,
} from "./matching";

const line = {
  sourceLineId: "line-1",
  vendorId: "vendor-1",
  vendorSku: " bean-1kg ",
  description: "Arabica coffee beans",
  pack: { quantity: "1.000", unit: "kg" },
  unitPriceCents: 1_500,
};

const catalogProduct = {
  catalogItemId: "item-1",
  vendorId: "vendor-1",
  vendorSku: "BEAN-1KG",
  description: "Arabica coffee beans",
  pack: { quantity: "1.0", unit: "KG" },
  unitPriceCents: 1_500,
  active: true,
};

describe("exact vendor product matching", () => {
  it("matches exact vendor SKU and pack before candidate scoring", () => {
    expect(matchProductLine(line, [catalogProduct])).toEqual({
      kind: "exact",
      sourceLineId: "line-1",
      catalogItemId: "item-1",
      method: "vendor_sku_pack",
    });
  });

  it("compares decimal pack quantities and units canonically", () => {
    expect(
      packsEqual(
        { quantity: "12.0", unit: "EA" },
        { quantity: "12.000000", unit: "ea" },
      ),
    ).toBe(true);
    expect(
      packsEqual(
        { quantity: "12.0", unit: "EA" },
        { quantity: "10.0", unit: "EA" },
      ),
    ).toBe(false);
  });

  it("does not call a SKU match exact when the pack differs", () => {
    const result = matchProductLine(line, [
      {
        ...catalogProduct,
        pack: { quantity: "2.000", unit: "kg" },
      },
    ]);

    expect(result.kind).toBe("candidates");
  });

  it("surfaces duplicate exact catalog keys as ambiguous", () => {
    const result = matchProductLine(line, [
      { ...catalogProduct, catalogItemId: "item-b" },
      { ...catalogProduct, catalogItemId: "item-a" },
    ]);

    expect(result).toEqual({
      kind: "ambiguous_exact",
      sourceLineId: "line-1",
      catalogItemIds: ["item-a", "item-b"],
    });
  });

  it("never matches an inactive or different-vendor catalog item", () => {
    expect(
      matchProductLine(line, [
        { ...catalogProduct, active: false },
        {
          ...catalogProduct,
          catalogItemId: "other-vendor-item",
          vendorId: "vendor-2",
        },
      ]),
    ).toEqual({
      kind: "unmatched",
      sourceLineId: "line-1",
      candidates: [],
    });
  });
});

describe("deterministic candidate scoring", () => {
  it("exposes deterministic score components", () => {
    const candidateLine = {
      ...line,
      vendorSku: undefined,
    };
    const ranked = rankProductCandidates(candidateLine, [catalogProduct], {
      aiCandidateRanks: [{ catalogItemId: "item-1", rank: 1 }],
    });

    expect(ranked).toEqual([
      {
        catalogItemId: "item-1",
        score: 6_500,
        components: {
          sku: 0,
          description: 3_500,
          pack: 2_000,
          unitPrice: 750,
          aiRank: 250,
        },
      },
    ]);
  });

  it("uses catalog item ID as the stable tie breaker", () => {
    const candidateLine = {
      sourceLineId: "line-1",
      vendorId: "vendor-1",
      description: "same description",
    };
    const products = [
      {
        ...catalogProduct,
        catalogItemId: "item-z",
        description: "same description",
      },
      {
        ...catalogProduct,
        catalogItemId: "item-a",
        description: "same description",
      },
    ];

    expect(
      rankProductCandidates(candidateLine, products).map(
        (candidate) => candidate.catalogItemId,
      ),
    ).toEqual(["item-a", "item-z"]);
  });

  it("keeps AI as a bounded optional rank signal, never an exact match", () => {
    const candidateLine = {
      sourceLineId: "line-1",
      vendorId: "vendor-1",
      description: "unrelated extracted text",
    };
    const result = matchProductLine(candidateLine, [catalogProduct], {
      aiCandidateRanks: [{ catalogItemId: "item-1", rank: 1 }],
      policy: {
        minimumSuggestedScore: 0,
        minimumSuggestionMargin: 0,
      },
    });

    expect(result.kind).toBe("candidates");
    if (result.kind !== "candidates") {
      throw new Error("Expected candidates");
    }
    expect(result.candidates[0].components.aiRank).toBe(250);
    expect(result.suggestedCatalogItemId).toBe("item-1");
  });

  it("only suggests a candidate that clears score and margin policy", () => {
    const candidateLine = { ...line, vendorSku: undefined };
    const close = {
      ...catalogProduct,
      catalogItemId: "item-2",
      description: "Arabica coffee beans",
      unitPriceCents: 1_501,
    };
    const result = matchProductLine(candidateLine, [catalogProduct, close]);

    expect(result.kind).toBe("candidates");
    if (result.kind !== "candidates") {
      throw new Error("Expected candidates");
    }
    expect(result.suggestedCatalogItemId).toBeUndefined();
  });

  it("rejects duplicate AI ranks rather than applying an arbitrary value", () => {
    expect(() =>
      rankProductCandidates(
        { ...line, vendorSku: undefined },
        [catalogProduct],
        {
          aiCandidateRanks: [
            { catalogItemId: "item-1", rank: 1 },
            { catalogItemId: "item-1", rank: 2 },
          ],
        },
      ),
    ).toThrow(/Duplicate AI rank/);
  });
});
