import { describe, expect, it } from "vitest";
import type { ExpenseSummary } from "@/domain/expenses/ledger";
import {
  buildStatementPnl,
  productSalesCents,
  salesGap,
  type RecordedSalesDay,
} from "./statement-pnl";

function day(overrides: Partial<RecordedSalesDay> = {}): RecordedSalesDay {
  return {
    businessDate: "2026-09-01",
    sourceSystem: "clover",
    grossCents: 10000,
    discountCents: 100,
    refundCents: 50,
    taxCents: 400,
    tipCents: 200,
    netCollectedCents: 9000,
    ...overrides,
  };
}

function expenses(partial: Partial<ExpenseSummary> = {}): ExpenseSummary {
  return {
    totalCents: 0,
    byGroup: [
      { group: "operating", amountCents: 0 },
      { group: "personal", amountCents: 0 },
      { group: "cash", amountCents: 0 },
      { group: "unknown", amountCents: 0 },
      { group: "unassigned", amountCents: 0 },
    ],
    byCategory: [],
    entries: [],
    ...partial,
  };
}

describe("productSalesCents", () => {
  it("uses collected money after tips and sales tax", () => {
    expect(productSalesCents(day())).toBe(8400);
  });

  it("does not go below zero", () => {
    expect(
      productSalesCents(day({ netCollectedCents: 100, taxCents: 400, tipCents: 200 })),
    ).toBe(0);
  });
});

describe("buildStatementPnl", () => {
  it("keeps one Clover day when another source reports the same date", () => {
    const pnl = buildStatementPnl(
      [
        day({ sourceSystem: "website", grossCents: 5000, discountCents: 0, refundCents: 0 }),
        day(),
      ],
      expenses({
        totalCents: 4000,
        byGroup: [
          { group: "operating", amountCents: 3000 },
          { group: "personal", amountCents: 500 },
          { group: "cash", amountCents: 300 },
          { group: "unknown", amountCents: 200 },
          { group: "unassigned", amountCents: 0 },
        ],
        byCategory: [
          { category: "Rent", group: "operating", amountCents: 3000 },
        ],
        entries: [
          {
            isoDate: "2026-08-11",
            description: "Rent",
            group: "operating",
            category: "Rent",
            amountCents: 3000,
          },
        ],
      }),
    );

    expect(pnl.salesCents).toBe(8400);
    expect(pnl.salesDays).toBe(1);
    expect(pnl.storeLeftoverCents).toBe(5400);
    expect(pnl.afterAllOutflowsCents).toBe(4400);
    expect(pnl.operatingCategories).toEqual([
      { category: "Rent", amountCents: 3000 },
    ]);
  });

  it("is negative when cafe expenses are higher than recorded sales", () => {
    const pnl = buildStatementPnl(
      [],
      expenses({
        totalCents: 1000,
        byGroup: [
          { group: "operating", amountCents: 1000 },
          { group: "personal", amountCents: 0 },
          { group: "cash", amountCents: 0 },
          { group: "unknown", amountCents: 0 },
          { group: "unassigned", amountCents: 0 },
        ],
      }),
    );
    expect(pnl.storeLeftoverCents).toBe(-1000);
    expect(salesGap(pnl)).toBe("missing");
  });
});
