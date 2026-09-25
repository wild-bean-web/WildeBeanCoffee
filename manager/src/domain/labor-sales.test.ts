import { describe, expect, it } from "vitest";
import { allocatePayrollToDays, chooseLaborCost } from "./labor-sales";

describe("allocatePayrollToDays", () => {
  it("spreads a pay period across its days without losing cents", () => {
    const days = allocatePayrollToDays([
      { startsOn: "2026-09-01", endsOn: "2026-09-03", loadedLaborCents: 1000 },
    ]);
    expect(days.map((day) => day.amountCents)).toEqual([334, 333, 333]);
    expect(days.reduce((sum, day) => sum + day.amountCents, 0)).toBe(1000);
  });
});

describe("chooseLaborCost", () => {
  it("uses posted payroll and leaves statement payroll out", () => {
    const choice = chooseLaborCost({
      posted: [{ startsOn: "2026-09-01", endsOn: "2026-09-01", loadedLaborCents: 500 }],
      statementPayroll: [{ isoDate: "2026-09-01", amountCents: 900 }],
    });
    expect(choice.source).toBe("posted");
    expect(choice.totalCents).toBe(500);
  });

  it("uses bank-statement payroll when nothing is posted", () => {
    const choice = chooseLaborCost({
      posted: [],
      statementPayroll: [{ isoDate: "2026-09-02", amountCents: 900 }],
    });
    expect(choice.source).toBe("statements");
    expect(choice.totalCents).toBe(900);
  });
});
