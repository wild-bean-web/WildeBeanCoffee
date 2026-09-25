import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { statementExpenseLines } from "@/db/schema";
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

function isoToStatementDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${month}/${day}/${year}`;
}

async function readDatabaseLines(organizationId: string): Promise<LedgerLine[]> {
  const rows = await getDb()
    .select({
      businessDate: statementExpenseLines.businessDate,
      description: statementExpenseLines.description,
      group: statementExpenseLines.expenseGroup,
      category: statementExpenseLines.category,
      signedCents: statementExpenseLines.signedCents,
    })
    .from(statementExpenseLines)
    .where(eq(statementExpenseLines.organizationId, organizationId));

  return rows.map((row) => ({
    date: isoToStatementDate(row.businessDate),
    description: row.description,
    group: row.group,
    category: row.category,
    signedCents: row.signedCents,
  }));
}

export async function loadStatementExpenses(
  organizationId: string | null,
  range: { startsOn: string; endsOn: string } | null,
  group: ExpenseGroup | "all",
): Promise<ExpenseSummary> {
  if (organizationId && process.env.DATABASE_URL) {
    try {
      const stored = await readDatabaseLines(organizationId);
      if (stored.length > 0) return summarizeExpenses(stored, range, group);
    } catch {
      // The local file ledgers remain available before the table is migrated.
    }
  }

  const lines = LEDGER_FILES.flatMap(readLedgerFile);
  return summarizeExpenses(lines, range, group);
}
