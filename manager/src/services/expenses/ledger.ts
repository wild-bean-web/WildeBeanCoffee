import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  summarizeExpenses,
  type ExpenseGroup,
  type ExpenseSummary,
  type LedgerLine,
} from "@/domain/expenses/ledger";

const ledgerFileSchema = z.object({
  lines: z.array(
    z.object({
      date: z.string(),
      description: z.string(),
      group: z.string(),
      category: z.string(),
      signedCents: z.number(),
    }),
  ),
});

const LEDGER_FILES = [
  "mt-expense-ledger-2024-2025.json",
  "mt-expense-ledger-2026.json",
];

function readLedgerFile(filename: string): LedgerLine[] {
  const filePath = path.join(process.cwd(), ".manager-data", filename);
  try {
    const parsed = ledgerFileSchema.parse(JSON.parse(readFileSync(filePath, "utf8")));
    return parsed.lines;
  } catch {
    return [];
  }
}

export function loadStatementExpenses(
  range: { startsOn: string; endsOn: string } | null,
  group: ExpenseGroup | "all",
): ExpenseSummary {
  const lines = LEDGER_FILES.flatMap(readLedgerFile);
  return summarizeExpenses(lines, range, group);
}
