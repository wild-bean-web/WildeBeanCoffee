import { describe, expect, it } from "vitest";
import {
  parseOneTimePurchasesCsv,
  summarizeHistoricalPurchases,
} from "./one-time-purchases-csv";

describe("parseOneTimePurchasesCsv", () => {
  it("normalizes dates and preserves accounting components", () => {
    const csv = [
      "Wild Bean Coffee — One-Time Purchases",
      "",
      "Purchase Date,Category,Item / Description,Vendor,Order #,Invoice #,Qty,Unit Cost,Tax,Shipping/Freight,All-In Total",
      "Major Equipment,,,,,,,,,,",
      '12/30/2025,Major Equipment,"Espresso Machine, Tall",Seller,NA,NA,1,"$4,700.00",$0.00,$0.00,"$4,700.00"',
    ].join("\n");

    expect(parseOneTimePurchasesCsv(csv)).toEqual([
      expect.objectContaining({
        purchaseDate: "2025-12-30",
        description: "Espresso Machine, Tall",
        quantity: "1",
        unitCostCents: 470000,
        allInTotalCents: 470000,
        issues: [],
      }),
    ]);
  });

  it("flags source lines that cannot safely post", () => {
    const csv = [
      "Purchase Date,Category,Item / Description,Vendor,Order #,Invoice #,Qty,Unit Cost,Tax,Shipping/Freight,All-In Total",
      "01/11/2026,Major Equipment,Display Case,The Restaurant Store,123,456,0,$2449.00,$146.94,$0.00,$146.94",
    ].join("\n");

    const [candidate] = parseOneTimePurchasesCsv(csv);
    expect(candidate.issues).toContain("zero_quantity_with_nonzero_total");
    expect(candidate.issues).not.toContain("line_total_does_not_reconcile");
  });

  it("summarizes imported source totals without correcting them", () => {
    const candidates = parseOneTimePurchasesCsv(
      [
        "Purchase Date,Category,Item / Description,Vendor,Order #,Invoice #,Qty,Unit Cost,Tax,Shipping/Freight,All-In Total",
        "01/01/2026,Tools,Scale,Vendor A,,,1,$40.00,$2.40,$0.00,$42.40",
        "01/02/2026,Tools,Pitcher,Vendor A,,,2,$10.00,$1.20,$0.00,$21.20",
      ].join("\n"),
    );

    expect(summarizeHistoricalPurchases(candidates)).toMatchObject({
      purchaseLines: 2,
      importedTotalCents: 6360,
      vendors: ["Vendor A"],
    });
  });
});
