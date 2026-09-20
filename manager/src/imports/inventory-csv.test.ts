import { describe, expect, it } from "vitest";
import {
  parseInventoryCsv,
  summarizeInventoryCandidates,
} from "./inventory-csv";

describe("parseInventoryCsv", () => {
  it("finds the embedded header and preserves quoted product names", () => {
    const csv = [
      ",,Wild Bean Coffee — Inventory Tracker",
      "Inventory Date:,00/00/26 - 00/00/26",
      "",
      "Category,Product Name,Units,Units (NUM),Beginning Inventory,Purchased Inventory,Vendor,Vendor Price,Vendor Price / Unit,Purchased Inventory $,Beginning + Purchased Inventory,Ending Inventory,Difference (End - Expected),AKA",
      'Cupware,"Choice Clear Cup, 20 oz.",600/case,600,0,0,The Restaurant Store,$40.99,$0.07,0,0,0,0,20 oz Clear Cold Cup',
    ].join("\n");

    expect(parseInventoryCsv(csv)).toEqual([
      expect.objectContaining({
        sourceRow: 5,
        category: "Cupware",
        productName: "Choice Clear Cup, 20 oz.",
        purchasePackQuantity: "600",
        vendorPriceCents: 4099,
        vendorUnitPriceCents: 7,
      }),
    ]);
  });

  it("flags invalid pack and cost data without inventing values", () => {
    const csv = [
      "Category,Product Name,Units,Units (NUM),Beginning Inventory,Purchased Inventory,Vendor,Vendor Price,Vendor Price / Unit,Purchased Inventory $,Beginning + Purchased Inventory,Ending Inventory,Difference (End - Expected),AKA",
      "Produce,Spinach,pack,0,0,0,Wegmans,unknown,,0,0,0,0,Spinach",
    ].join("\n");

    const [candidate] = parseInventoryCsv(csv);
    expect(candidate.purchasePackQuantity).toBeNull();
    expect(candidate.vendorPriceCents).toBeNull();
    expect(candidate.issues).toEqual(
      expect.arrayContaining([
        "missing_or_invalid_pack_quantity",
        "missing_or_invalid_vendor_price",
      ]),
    );
  });

  it("summarizes categories, vendors, and review issues", () => {
    const candidates = parseInventoryCsv(
      [
        "Category,Product Name,Units,Units (NUM),Beginning Inventory,Purchased Inventory,Vendor,Vendor Price,Vendor Price / Unit,Purchased Inventory $,Beginning + Purchased Inventory,Ending Inventory,Difference (End - Expected),AKA",
        "Dairy,Whole Milk,gallon,1,0,0,Wegmans,$3.99,$3.99,0,0,0,0,Whole Milk",
        "Coffee,Espresso Beans,bag,1,0,0,Restaurant Depot,$20.00,$20.00,0,0,0,0,Espresso",
      ].join("\n"),
    );

    expect(summarizeInventoryCandidates(candidates)).toMatchObject({
      productCandidates: 2,
      vendors: ["Restaurant Depot", "Wegmans"],
      categories: ["Coffee", "Dairy"],
    });
  });
});
