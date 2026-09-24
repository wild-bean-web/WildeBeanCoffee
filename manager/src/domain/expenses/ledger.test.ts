import { describe, expect, it } from "vitest";
import {
  filterExpensesByCategory,
  quarterlyExpenseTotals,
  statementDateToIso,
  summarizeExpenses,
} from "./ledger";

describe("statementDateToIso", () => {
  it("converts a statement date to an ISO date", () => {
    expect(statementDateToIso("08/26/2026")).toBe("2026-08-26");
  });

  it("rejects a date that is not on the calendar", () => {
    expect(statementDateToIso("02/31/2026")).toBeNull();
  });
});

describe("summarizeExpenses", () => {
  const lines = [
    {
      date: "08/11/2026",
      description: "YSI*MD",
      group: "operating",
      category: "Rent",
      signedCents: -344074,
    },
    {
      date: "08/12/2026",
      description: "WEB PMT BOA ALEM",
      group: "personal",
      category: "Personal expenses paid by the business",
      signedCents: -500000,
    },
    {
      date: "08/26/2026",
      description: "REFUND 08/13 WEB PMT BOA ALEM",
      group: "personal",
      category: "Personal expenses paid by the business",
      signedCents: 200000,
    },
    {
      date: "08/04/2026",
      description: "MTBMERCHANT DEPOSIT",
      group: "income",
      category: "Card deposits",
      signedCents: 100000,
    },
    {
      date: "03/11/2025",
      description: "1001 CHECK NUMBER",
      group: "unassigned",
      category: "Checks, payee not on statement",
      signedCents: -1223400,
    },
    {
      date: "01/31/2025",
      description: "M&T BANK LOAN TRANS",
      group: "financing",
      category: "Debt payments",
      signedCents: -100000,
    },
  ];

  it("keeps income and loan payments off the expense totals", () => {
    const summary = summarizeExpenses(lines, null);
    expect(summary.totalCents).toBe(344074 + 500000 - 200000 + 1223400);
    expect(summary.entries.map((entry) => entry.group)).not.toContain("income");
    expect(summary.byCategory.map((row) => row.category)).not.toContain("Debt payments");
  });

  it("filters by posted date and expense group", () => {
    const august = summarizeExpenses(
      lines,
      { startsOn: "2026-08-01", endsOn: "2026-08-31" },
      "personal",
    );
    expect(august.totalCents).toBe(300000);
    expect(august.entries).toHaveLength(2);
    expect(august.byCategory[0]?.category).toBe(
      "Personal expenses paid by the business",
    );
  });

  it("narrows posted lines to one category and can return to the full set", () => {
    const summary = summarizeExpenses(lines, null);
    const rent = filterExpensesByCategory(summary, "Rent");
    expect(rent.entries).toHaveLength(1);
    expect(rent.totalCents).toBe(344074);
    expect(filterExpensesByCategory(summary, "Missing")).toEqual(
      expect.objectContaining({ totalCents: 0, entries: [] }),
    );
  });

  it("rolls filtered lines into calendar quarters", () => {
    const summary = summarizeExpenses(lines, null);
    const quarters = quarterlyExpenseTotals(summary.entries);
    expect(quarters.map((quarter) => quarter.label)).toEqual(["2025 Q1", "2026 Q3"]);
    expect(quarters[1]?.amountCents).toBe(344074 + 300000);
    expect(quarters[1]?.byCategory[0]?.category).toBe("Rent");
  });
});
