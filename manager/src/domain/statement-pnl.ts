import type { ExpenseSummary } from "@/domain/expenses/ledger";

export interface RecordedSalesDay {
  businessDate: string;
  sourceSystem: string;
  grossCents: number;
  discountCents: number;
  refundCents: number;
  taxCents: number;
  tipCents: number;
  netCollectedCents: number;
}

export interface StatementPnl {
  salesCents: number;
  salesDays: number;
  salesFirst: string | null;
  salesLast: string | null;
  tipCents: number;
  taxCents: number;
  operatingCents: number;
  personalCents: number;
  cashCents: number;
  otherCents: number;
  expenseCents: number;
  storeLeftoverCents: number;
  afterAllOutflowsCents: number;
  expenseFirst: string | null;
  expenseLast: string | null;
  booksThrough: string | null;
  salesInsideBooksCents: number;
  salesOutsideBooksCents: number;
  comparableLeftoverCents: number | null;
  comparableAfterAllCents: number | null;
  operatingCategories: { category: string; amountCents: number }[];
}

/** Product sales. Clover's collected total includes tips and sales tax. */
export function productSalesCents(
  day: Pick<RecordedSalesDay, "netCollectedCents" | "taxCents" | "tipCents">,
): number {
  return Math.max(day.netCollectedCents - day.taxCents - day.tipCents, 0);
}

export function chooseSalesDay(
  current: RecordedSalesDay | undefined,
  next: RecordedSalesDay,
): RecordedSalesDay {
  if (!current) return next;
  const currentClover = /clover/i.test(current.sourceSystem);
  const nextClover = /clover/i.test(next.sourceSystem);
  if (nextClover && !currentClover) return next;
  if (currentClover && !nextClover) return current;
  return next.netCollectedCents > current.netCollectedCents ? next : current;
}

function groupAmount(expenses: ExpenseSummary, group: ExpenseSummary["byGroup"][number]["group"]): number {
  return expenses.byGroup.find((row) => row.group === group)?.amountCents ?? 0;
}

export function buildStatementPnl(
  days: RecordedSalesDay[],
  expenses: ExpenseSummary,
): StatementPnl {
  const byDate = new Map<string, RecordedSalesDay>();
  for (const day of days) {
    byDate.set(day.businessDate, chooseSalesDay(byDate.get(day.businessDate), day));
  }
  const chosen = [...byDate.values()].sort((left, right) =>
    left.businessDate.localeCompare(right.businessDate),
  );

  let salesCents = 0;
  let tipCents = 0;
  let taxCents = 0;
  for (const day of chosen) {
    salesCents += productSalesCents(day);
    tipCents += day.tipCents;
    taxCents += day.taxCents;
  }

  const operatingCents = groupAmount(expenses, "operating");
  const personalCents = groupAmount(expenses, "personal");
  const cashCents = groupAmount(expenses, "cash");
  const otherCents =
    groupAmount(expenses, "unknown") + groupAmount(expenses, "unassigned");
  const expenseCents = expenses.totalCents;

  let expenseFirst: string | null = null;
  let expenseLast: string | null = null;
  for (const entry of expenses.entries) {
    if (!expenseFirst || entry.isoDate < expenseFirst) expenseFirst = entry.isoDate;
    if (!expenseLast || entry.isoDate > expenseLast) expenseLast = entry.isoDate;
  }

  let salesInsideBooksCents = 0;
  if (expenseLast) {
    for (const day of chosen) {
      if (day.businessDate <= expenseLast) {
        salesInsideBooksCents += productSalesCents(day);
      }
    }
  }
  const salesOutsideBooksCents = expenseLast ? salesCents - salesInsideBooksCents : 0;

  return {
    salesCents,
    salesDays: chosen.length,
    salesFirst: chosen[0]?.businessDate ?? null,
    salesLast: chosen.at(-1)?.businessDate ?? null,
    tipCents,
    taxCents,
    operatingCents,
    personalCents,
    cashCents,
    otherCents,
    expenseCents,
    storeLeftoverCents: salesCents - operatingCents,
    afterAllOutflowsCents: salesCents - expenseCents,
    expenseFirst,
    expenseLast,
    booksThrough: expenseLast,
    salesInsideBooksCents,
    salesOutsideBooksCents,
    comparableLeftoverCents: expenseLast ? salesInsideBooksCents - operatingCents : null,
    comparableAfterAllCents: expenseLast ? salesInsideBooksCents - expenseCents : null,
    operatingCategories: expenses.byCategory
      .filter((row) => row.group === "operating" && row.amountCents !== 0)
      .map((row) => ({ category: row.category, amountCents: row.amountCents })),
  };
}

export function presentedLeftover(pnl: StatementPnl): {
  leftoverCents: number | null;
  afterAllCents: number | null;
  limitedToBooks: boolean;
} {
  if (
    pnl.booksThrough &&
    pnl.salesOutsideBooksCents > 0 &&
    pnl.comparableLeftoverCents !== null
  ) {
    return {
      leftoverCents: pnl.comparableLeftoverCents,
      afterAllCents: pnl.comparableAfterAllCents,
      limitedToBooks: true,
    };
  }
  if (!pnl.booksThrough && pnl.salesCents > 0) {
    return { leftoverCents: null, afterAllCents: null, limitedToBooks: false };
  }
  return {
    leftoverCents: pnl.storeLeftoverCents,
    afterAllCents: pnl.afterAllOutflowsCents,
    limitedToBooks: false,
  };
}

export function salesGap(pnl: StatementPnl): "missing" | "partial" | null {
  if (pnl.salesDays === 0) return "missing";
  const expensesOutside =
    (pnl.expenseFirst !== null && pnl.salesFirst !== null && pnl.expenseFirst < pnl.salesFirst) ||
    (pnl.expenseLast !== null && pnl.salesLast !== null && pnl.expenseLast > pnl.salesLast);
  return expensesOutside ? "partial" : null;
}
