import { describe, expect, it } from "vitest";
import {
  categorizeBankLine,
  decideStatementIntake,
  parseBankStatementText,
} from "./statement-intake";

const sample = `
M&T Bank statement 2026
01/12/2026 ADP PAYROLL 2,450.18
01/13/2026 YSI*RENT 3,440.74
01/14/2026 ATM WITHDRAWAL 200.00
01/15/2026 CLOVER DEPOSIT 1,200.00
Beginning balance 10,000.00
01/16/2026 CHECK 1042 85.00
`;

describe("parseBankStatementText", () => {
  it("keeps expenses, drops deposits and balances, and categorizes the lines", () => {
    const lines = parseBankStatementText(sample);
    expect(lines.map((line) => line.category)).toEqual([
      "Payroll",
      "Rent",
      "ATM/counter withdrawals",
      "Checks, payee not on statement",
    ]);
    expect(lines.every((line) => line.signedCents < 0)).toBe(true);
    expect(lines[1]?.group).toBe("operating");
    expect(lines[2]?.group).toBe("cash");
  });
});

describe("categorizeBankLine", () => {
  it("routes a utility debit to operating utilities", () => {
    expect(categorizeBankLine("BGE ELECTRIC")).toEqual({
      group: "operating",
      category: "Utilities",
    });
  });
});

describe("decideStatementIntake", () => {
  const parsed = parseBankStatementText(sample);

  it("rejects the same file", () => {
    expect(
      decideStatementIntake({
        fileAlreadyStored: true,
        parsed,
        existingFingerprints: new Set(),
      }).status,
    ).toBe("rejected_duplicate_file");
  });

  it("rejects a PDF that is not a statement", () => {
    expect(
      decideStatementIntake({
        fileAlreadyStored: false,
        parsed: parsed.slice(0, 2),
        existingFingerprints: new Set(),
      }).status,
    ).toBe("rejected_not_a_statement");
  });

  it("rejects a statement whose transactions are already recorded", () => {
    expect(
      decideStatementIntake({
        fileAlreadyStored: false,
        parsed,
        existingFingerprints: new Set(parsed.map((line) => line.fingerprint)),
      }).status,
    ).toBe("rejected_already_recorded");
  });

  it("adds only the transactions that are not already recorded", () => {
    const decision = decideStatementIntake({
      fileAlreadyStored: false,
      parsed,
      existingFingerprints: new Set([parsed[0]?.fingerprint ?? ""]),
    });
    expect(decision.status).toBe("accepted");
    if (decision.status !== "accepted") return;
    expect(decision.added).toHaveLength(parsed.length - 1);
    expect(decision.skipped).toBe(1);
  });
});
