import { describe, expect, it } from "vitest";
import type { RecordedSalesDay } from "@/domain/statement-pnl";
import { dailyFlows, graphSpanSeries } from "./sales-expense-series";

function sale(overrides: Partial<RecordedSalesDay> = {}): RecordedSalesDay {
  return {
    businessDate: "2026-09-15",
    sourceSystem: "clover",
    grossCents: 0,
    discountCents: 0,
    refundCents: 0,
    taxCents: 100,
    tipCents: 200,
    netCollectedCents: 1500,
    ...overrides,
  };
}

const today = "2026-09-23";

function sampleDays() {
  return dailyFlows({
    today,
    sales: [
      sale(),
      sale({ sourceSystem: "website", netCollectedCents: 9000, taxCents: 0, tipCents: 0 }),
    ],
    expenses: [
      { isoDate: "2026-08-11", amountCents: 4000 },
      { isoDate: "2026-08-20", amountCents: 500 },
    ],
  });
}

describe("dailyFlows", () => {
  it("keeps Clover product sales and leaves days after the ledger blank", () => {
    const days = sampleDays();
    const august12 = days.find((day) => day.isoDate === "2026-08-12");
    const september = days.find((day) => day.isoDate === "2026-09-15");

    expect(august12?.expenseCents).toBe(0);
    expect(september).toMatchObject({ salesCents: 1200, expenseCents: null });
  });
});

describe("graphSpanSeries", () => {
  const days = sampleDays();

  it("uses the last 30 days", () => {
    const series = graphSpanSeries(days, "days", today);
    expect(series.grain).toBe("day");
    expect(series.points).toHaveLength(30);
    expect(series.points.at(-1)?.isoDate).toBe(today);
    expect(series.points.every((point) => point.expenseCents === null)).toBe(true);
  });

  it("does not draw a month with no expenses as zero", () => {
    const series = graphSpanSeries(days, "months", today);
    const september = series.points.find((point) => point.isoDate === "2026-09-01");
    const august = series.points.find((point) => point.isoDate === "2026-08-01");

    expect(series.points).toHaveLength(12);
    expect(september).toMatchObject({ salesCents: 1200, expenseCents: null });
    expect(august?.expenseCents).toBe(4500);
  });

  it("starts year to date in January", () => {
    const series = graphSpanSeries(days, "ytd", today);
    expect(series.grain).toBe("week");
    expect(series.points[0]?.isoDate.startsWith("2026-01")).toBe(true);
    expect(series.points.at(-1)?.isoDate <= today).toBe(true);
  });
});
