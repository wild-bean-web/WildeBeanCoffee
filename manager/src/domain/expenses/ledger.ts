export const expenseGroups = [
  "operating",
  "personal",
  "cash",
  "unknown",
  "unassigned",
] as const;

export type ExpenseGroup = (typeof expenseGroups)[number];

export const expenseGroupLabels: Record<ExpenseGroup, string> = {
  operating: "Cafe operating",
  personal: "Personal, paid by the business",
  cash: "ATM/counter withdrawals",
  unknown: "Unknown card purchases",
  unassigned: "Needs a payee",
};

export interface LedgerLine {
  date: string;
  description: string;
  group: string;
  category: string;
  signedCents: number;
}

export interface ExpenseEntry {
  isoDate: string;
  description: string;
  group: ExpenseGroup;
  category: string;
  /** Positive when money left the account. A refund is negative. */
  amountCents: number;
}

export interface ExpenseCategoryTotal {
  category: string;
  group: ExpenseGroup;
  amountCents: number;
}

export interface ExpenseSummary {
  totalCents: number;
  byGroup: { group: ExpenseGroup; amountCents: number }[];
  byCategory: ExpenseCategoryTotal[];
  entries: ExpenseEntry[];
}

const ISO_FROM_STATEMENT = /^(\d{2})\/(\d{2})\/(\d{4})$/;

export function statementDateToIso(value: string): string | null {
  const match = ISO_FROM_STATEMENT.exec(value.trim());
  if (!match) return null;
  const iso = `${match[3]}-${match[1]}-${match[2]}`;
  const parsed = new Date(`${iso}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== iso) {
    return null;
  }
  return iso;
}

export function isExpenseGroup(value: string): value is ExpenseGroup {
  return (expenseGroups as readonly string[]).includes(value);
}

export function expenseSearchParams(input: {
  from?: string;
  to?: string;
  group?: ExpenseGroup | "all";
  category?: string;
}): string {
  const params = new URLSearchParams();
  if (input.from) params.set("from", input.from);
  if (input.to) params.set("to", input.to);
  if (input.group && input.group !== "all") params.set("group", input.group);
  if (input.category) params.set("category", input.category);
  return params.toString();
}

export function categoryNames(summary: ExpenseSummary): string[] {
  return [...new Set(summary.entries.map((entry) => entry.category))].sort((left, right) =>
    left.localeCompare(right),
  );
}

export interface ExpenseQuarterTotal {
  label: string;
  startsOn: string;
  endsOn: string;
  amountCents: number;
  byCategory: { category: string; amountCents: number }[];
}

function quarterOf(isoDate: string): Omit<ExpenseQuarterTotal, "amountCents" | "byCategory"> {
  const year = Number.parseInt(isoDate.slice(0, 4), 10);
  const month = Number.parseInt(isoDate.slice(5, 7), 10);
  const quarter = Math.floor((month - 1) / 3) + 1;
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  const endDay = new Date(Date.UTC(year, endMonth, 0)).getUTCDate();
  const pad = (value: number) => String(value).padStart(2, "0");
  return {
    label: `${year} Q${quarter}`,
    startsOn: `${year}-${pad(startMonth)}-01`,
    endsOn: `${year}-${pad(endMonth)}-${pad(endDay)}`,
  };
}

export function quarterlyExpenseTotals(entries: ExpenseEntry[]): ExpenseQuarterTotal[] {
  const quarters = new Map<string, ExpenseQuarterTotal>();
  for (const entry of entries) {
    const quarter = quarterOf(entry.isoDate);
    const current = quarters.get(quarter.label) ?? {
      ...quarter,
      amountCents: 0,
      byCategory: [],
    };
    current.amountCents += entry.amountCents;
    const category = current.byCategory.find((row) => row.category === entry.category);
    if (category) category.amountCents += entry.amountCents;
    else current.byCategory.push({ category: entry.category, amountCents: entry.amountCents });
    quarters.set(quarter.label, current);
  }
  return [...quarters.values()]
    .map((quarter) => ({
      ...quarter,
      byCategory: quarter.byCategory.sort(
        (left, right) => right.amountCents - left.amountCents || left.category.localeCompare(right.category),
      ),
    }))
    .sort((left, right) => left.startsOn.localeCompare(right.startsOn));
}

function rollup(entries: ExpenseEntry[]): ExpenseSummary {
  const ordered = [...entries].sort((left, right) => {
    if (left.isoDate !== right.isoDate) return right.isoDate.localeCompare(left.isoDate);
    if (left.category !== right.category) return left.category.localeCompare(right.category);
    return left.description.localeCompare(right.description);
  });
  const categoryTotals = new Map<string, ExpenseCategoryTotal>();
  const groupTotals = new Map<ExpenseGroup, number>();
  for (const groupKey of expenseGroups) groupTotals.set(groupKey, 0);

  let totalCents = 0;
  for (const entry of ordered) {
    totalCents += entry.amountCents;
    groupTotals.set(entry.group, (groupTotals.get(entry.group) ?? 0) + entry.amountCents);
    const key = `${entry.group}\u0000${entry.category}`;
    const current = categoryTotals.get(key);
    if (current) current.amountCents += entry.amountCents;
    else {
      categoryTotals.set(key, {
        category: entry.category,
        group: entry.group,
        amountCents: entry.amountCents,
      });
    }
  }

  return {
    totalCents,
    byGroup: expenseGroups.map((groupKey) => ({
      group: groupKey,
      amountCents: groupTotals.get(groupKey) ?? 0,
    })),
    byCategory: [...categoryTotals.values()].sort(
      (left, right) => right.amountCents - left.amountCents || left.category.localeCompare(right.category),
    ),
    entries: ordered,
  };
}

export function filterExpensesByCategory(
  summary: ExpenseSummary,
  category: string,
): ExpenseSummary {
  return rollup(summary.entries.filter((entry) => entry.category === category));
}

export function summarizeExpenses(
  lines: LedgerLine[],
  range: { startsOn: string; endsOn: string } | null,
  group: ExpenseGroup | "all" = "all",
): ExpenseSummary {
  const entries: ExpenseEntry[] = [];
  for (const line of lines) {
    if (!isExpenseGroup(line.group)) continue;
    if (group !== "all" && line.group !== group) continue;
    const isoDate = statementDateToIso(line.date);
    if (!isoDate) continue;
    if (range && (isoDate < range.startsOn || isoDate > range.endsOn)) continue;
    const description = line.description.trim();
    const category = line.category.trim();
    if (!description || !category || !Number.isInteger(line.signedCents)) continue;
    entries.push({
      isoDate,
      description,
      group: line.group,
      category,
      amountCents: -line.signedCents,
    });
  }
  return rollup(entries);
}
