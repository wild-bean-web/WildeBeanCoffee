import { parse } from "csv-parse/sync";

const monthNames = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
] as const;

type MonthName = (typeof monthNames)[number];

export interface UtilityExpenseCandidate {
  sourceRow: number;
  category: string;
  vendor: string | null;
  accountLastFour: string | null;
  monthlyBudgetCents: number | null;
  monthlyAmountsCents: Record<MonthName, number>;
  annualTotalCents: number;
  dueDateText: string | null;
  autoPay: boolean | null;
  notes: string | null;
  issues: string[];
}

function cents(value: string): number | null {
  const normalized = value.replace(/[$,\s]/g, "");
  if (!normalized) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? Math.round(number * 100) : null;
}

function lastFour(value: string): string | null {
  const normalized = value.replace(/\D/g, "");
  return normalized ? normalized.slice(-4) : null;
}

function autoPay(value: string): boolean | null {
  const normalized = value.trim().toLowerCase();
  if (["yes", "y", "true"].includes(normalized)) return true;
  if (["no", "n", "false"].includes(normalized)) return false;
  return null;
}

export function parseUtilitiesCsv(csv: string): UtilityExpenseCandidate[] {
  const rows = parse(csv, {
    bom: true,
    relax_column_count: true,
    skip_empty_lines: false,
  }) as string[][];
  const headerIndex = rows.findIndex(
    (row) =>
      row[0]?.trim() === "Expense Category" &&
      row.some((cell) => cell.trim() === "Annual Total ($)"),
  );
  if (headerIndex < 0) {
    throw new Error("Utilities header row was not found.");
  }

  const headers = rows[headerIndex].map((header) => header.trim());
  const byHeader = new Map(headers.map((header, index) => [header, index]));
  const candidates: UtilityExpenseCandidate[] = [];

  for (let index = headerIndex + 1; index < rows.length; index += 1) {
    const row = rows[index].map((cell) => String(cell ?? "").trim());
    const category = row[byHeader.get("Expense Category") ?? 0];
    if (!category || category.toUpperCase().startsWith("TOTAL")) continue;

    const monthlyAmountsCents = Object.fromEntries(
      monthNames.map((month) => {
        const header = `${month[0].toUpperCase()}${month.slice(1)} ($)`;
        return [month, cents(row[byHeader.get(header) ?? -1] ?? "") ?? 0];
      }),
    ) as Record<MonthName, number>;

    const monthSum = Object.values(monthlyAmountsCents).reduce(
      (sum, amount) => sum + amount,
      0,
    );
    const annualTotalCents =
      cents(row[byHeader.get("Annual Total ($)") ?? -1] ?? "") ?? 0;
    const issues: string[] = [];

    if (Math.abs(monthSum - annualTotalCents) > 2) {
      issues.push("annual_total_does_not_reconcile");
    }

    const nonzeroMonths = Object.values(monthlyAmountsCents).filter(
      (amount) => amount > 0,
    );
    if (nonzeroMonths.length >= 2) {
      const sorted = [...nonzeroMonths].sort((left, right) => left - right);
      const median = sorted[Math.floor(sorted.length / 2)];
      if (Math.max(...nonzeroMonths) > median * 4) {
        issues.push("unusual_monthly_amount");
      }
    }

    candidates.push({
      sourceRow: index + 1,
      category,
      vendor:
        row[byHeader.get("Vendor / Company") ?? -1]?.trim() || null,
      accountLastFour: lastFour(row[byHeader.get("Account #") ?? -1] ?? ""),
      monthlyBudgetCents: cents(
        row[byHeader.get("Monthly Budget ($)") ?? -1] ?? "",
      ),
      monthlyAmountsCents,
      annualTotalCents,
      dueDateText: row[byHeader.get("Due Date") ?? -1]?.trim() || null,
      autoPay: autoPay(row[byHeader.get("Auto-Pay (Yes/No)") ?? -1] ?? ""),
      notes: row[byHeader.get("Notes") ?? -1]?.trim() || null,
      issues,
    });
  }

  return candidates;
}
