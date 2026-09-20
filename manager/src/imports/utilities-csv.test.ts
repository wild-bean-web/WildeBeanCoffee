import { describe, expect, it } from "vitest";
import { parseUtilitiesCsv } from "./utilities-csv";

const header =
  "Expense Category,Vendor / Company,Account #,Monthly Budget ($),January ($),February ($),March ($),April ($),May ($),June ($),July ($),August ($),September ($),October ($),November ($),December ($),Annual Total ($),Variance vs Budget ($),Due Date,Auto-Pay (Yes/No),Notes";

describe("parseUtilitiesCsv", () => {
  it("masks account identifiers and reconciles monthly totals", () => {
    const [candidate] = parseUtilitiesCsv(
      [
        "Wild Bean Coffee — Utilities & Fixed Expense Tracker",
        header,
        [
          "Electricity",
          "Pepco",
          "55040498549",
          "",
          "$100.00",
          "$120.00",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "$220.00",
          "",
          "15",
          "Yes",
          "",
        ].join(","),
      ].join("\n"),
    );

    expect(candidate).toMatchObject({
      category: "Electricity",
      vendor: "Pepco",
      accountLastFour: "8549",
      annualTotalCents: 22000,
      autoPay: true,
      issues: [],
    });
    expect(candidate.monthlyAmountsCents.january).toBe(10000);
    expect(candidate.monthlyAmountsCents.february).toBe(12000);
  });

  it("flags totals and unusual month changes for review", () => {
    const [candidate] = parseUtilitiesCsv(
      [
        header,
        [
          "Rent",
          "Landlord",
          "",
          "",
          "100",
          "100",
          "100",
          "1000",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "1200",
          "",
          "",
          "",
          "",
        ].join(","),
      ].join("\n"),
    );

    expect(candidate.issues).toEqual(
      expect.arrayContaining([
        "annual_total_does_not_reconcile",
        "unusual_monthly_amount",
      ]),
    );
  });
});
