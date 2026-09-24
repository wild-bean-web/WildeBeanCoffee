import { describe, expect, it } from "vitest";
import {
  catalogDraftFromInventoryRow,
  countSheetNameFromImport,
  inventoryImportSku,
  purchasePackCode,
} from "./inventory-post";

describe("inventoryImportSku", () => {
  it("stays unique per source row inside a spreadsheet hash", () => {
    const hash = "562eb5f91678c541ea2f71493b4d92100b46c77be288d1ac7d512088731e8ec4";
    expect(inventoryImportSku(hash, 5)).toBe("INV-562eb5f916-0005");
    expect(inventoryImportSku(hash, 6)).toBe("INV-562eb5f916-0006");
  });
});

describe("countSheetNameFromImport", () => {
  it("uses the spreadsheet AKA on the count sheet", () => {
    expect(
      countSheetNameFromImport(
        'Choice 12 oz. White Poly Paper Hot Cup',
        "12 oz Hot Coffee Cup",
      ),
    ).toBe("12 oz Hot Coffee Cup");
  });

  it("falls back to a shortened vendor name when AKA is blank", () => {
    expect(
      countSheetNameFromImport(
        "Choice Clear PET Customizable Plastic Cold Cup - 16 oz. - 1,000/Case",
        null,
      ),
    ).toBe("16 oz Plastic Cold Cup");
  });
});

describe("catalogDraftFromInventoryRow", () => {
  it("counts each and keeps the purchase pack of each", () => {
    const draft = catalogDraftFromInventoryRow({
      sourceSha256: "562eb5f91678c541ea2f71493b4d92100b46c77be288d1ac7d512088731e8ec4",
      sourceRow: 7,
      row: {
        category: "Cupware",
        productName: "Choice 12 oz. White Poly Paper Hot Cup",
        alias: "12 oz Hot Coffee Cup",
        vendorName: "The Restaurant Store",
        purchasePackLabel: "1000/case",
        purchasePackQuantity: "1000",
        vendorPriceCents: 4399,
        vendorUnitPriceCents: 4,
      },
    });

    expect(draft).toMatchObject({
      sku: "INV-562eb5f916-0007",
      countSheetName: "12 oz Hot Coffee Cup",
      vendorDescription: "Choice 12 oz. White Poly Paper Hot Cup",
      category: "Cupware",
      vendorName: "The Restaurant Store",
      packCode: "1000-case",
      packQuantity: "1000",
      unitCostCents: "4",
    });
  });

  it("skips a pack when the spreadsheet has no quantity", () => {
    expect(purchasePackCode("pack", null)).toBeNull();
    expect(
      catalogDraftFromInventoryRow({
        sourceSha256: "aa".repeat(32),
        sourceRow: 2,
        row: {
          category: "Produce",
          productName: "Spinach",
          alias: "Spinach",
          vendorName: "Wegmans",
          purchasePackLabel: "pack",
          purchasePackQuantity: null,
          vendorPriceCents: null,
          vendorUnitPriceCents: null,
        },
      }).packCode,
    ).toBeNull();
  });
});
