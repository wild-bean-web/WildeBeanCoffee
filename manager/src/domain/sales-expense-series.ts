import { addDaysIso, sundayOfIsoDate } from "@/lib/date-range";
import {
  chooseSalesDay,
  productSalesCents,
  type RecordedSalesDay,
} from "@/domain/statement-pnl";

export const graphSpans = [
  { id: "days", label: "Days" },
  { id: "weeks", label: "Weeks" },
  { id: "months", label: "Months" },
  { id: "ytd", label: "Year to date" },
  { id: "all", label: "All time" },
] as const;

export type GraphSpan = (typeof graphSpans)[number]["id"];

export interface DailyFlowPoint {
  isoDate: string;
  salesCents: number;
  /** Null when that day is outside the recorded expense ledger. */
  expenseCents: number | null;
}

export interface SalesExpensePoint {
  isoDate: string;
  salesCents: number;
  expenseCents: number | null;
}

export interface SalesExpenseSeries {
  grain: "day" | "week" | "month";
  points: SalesExpensePoint[];
}

const DAY_WINDOW = 30;
const WEEK_WINDOW = 26;
const MONTH_WINDOW = 12;

function daysInclusive(startsOn: string, endsOn: string): number {
  const start = Date.parse(`${startsOn}T12:00:00.000Z`);
  const end = Date.parse(`${endsOn}T12:00:00.000Z`);
  return Math.round((end - start) / 86_400_000) + 1;
}

function eachDay(startsOn: string, endsOn: string): string[] {
  const dates: string[] = [];
  let current = startsOn;
  const limit = Math.max(daysInclusive(startsOn, endsOn), 1);
  for (let index = 0; index < limit; index += 1) {
    dates.push(current);
    if (current >= endsOn) break;
    current = addDaysIso(current, 1);
  }
  return dates;
}

function monthStart(isoDate: string): string {
  return `${isoDate.slice(0, 7)}-01`;
}

function shiftMonth(isoDate: string, months: number): string {
  const year = Number.parseInt(isoDate.slice(0, 4), 10);
  const month = Number.parseInt(isoDate.slice(5, 7), 10) - 1 + months;
  const next = new Date(Date.UTC(year, month, 1));
  const nextYear = next.getUTCFullYear();
  const nextMonth = next.getUTCMonth() + 1;
  return `${String(nextYear).padStart(4, "0")}-${String(nextMonth).padStart(2, "0")}-01`;
}

function eachMonth(startsOn: string, endsOn: string): string[] {
  const months: string[] = [];
  let current = monthStart(startsOn);
  const last = monthStart(endsOn);
  while (current <= last && months.length < 240) {
    months.push(current);
    current = shiftMonth(current, 1);
  }
  return months;
}

function combine(days: DailyFlowPoint[], isoDate: string): SalesExpensePoint {
  const known = days.filter((day) => day.expenseCents !== null);
  return {
    isoDate,
    salesCents: days.reduce((sum, day) => sum + day.salesCents, 0),
    expenseCents:
      known.length === 0
        ? null
        : known.reduce((sum, day) => sum + (day.expenseCents ?? 0), 0),
  };
}

export function dailyFlows(input: {
  today: string;
  sales: RecordedSalesDay[];
  expenses: { isoDate: string; amountCents: number }[];
}): DailyFlowPoint[] {
  const salesByDate = new Map<string, RecordedSalesDay>();
  for (const day of input.sales) {
    salesByDate.set(day.businessDate, chooseSalesDay(salesByDate.get(day.businessDate), day));
  }
  const expenseByDate = new Map<string, number>();
  for (const entry of input.expenses) {
    expenseByDate.set(
      entry.isoDate,
      (expenseByDate.get(entry.isoDate) ?? 0) + entry.amountCents,
    );
  }
  const expenseDates = [...expenseByDate.keys()].sort();
  const firstExpense = expenseDates[0];
  const lastExpense = expenseDates.at(-1);
  const known = [
    ...salesByDate.keys(),
    ...expenseDates,
    input.today,
  ].sort();
  const startsOn = known[0];
  const endsOn = known.at(-1);
  if (!startsOn || !endsOn) return [];

  return eachDay(startsOn, endsOn).map((isoDate) => {
    const sale = salesByDate.get(isoDate);
    const recorded =
      firstExpense !== undefined &&
      lastExpense !== undefined &&
      isoDate >= firstExpense &&
      isoDate <= lastExpense;
    return {
      isoDate,
      salesCents: sale ? productSalesCents(sale) : 0,
      expenseCents: recorded ? expenseByDate.get(isoDate) ?? 0 : null,
    };
  });
}

export function graphSpanSeries(
  days: DailyFlowPoint[],
  span: GraphSpan,
  today: string,
): SalesExpenseSeries {
  const byDate = new Map(days.map((day) => [day.isoDate, day]));
  const lookup = (isoDate: string): DailyFlowPoint =>
    byDate.get(isoDate) ?? { isoDate, salesCents: 0, expenseCents: null };

  if (span === "days") {
    const startsOn = addDaysIso(today, -(DAY_WINDOW - 1));
    return {
      grain: "day",
      points: eachDay(startsOn, today).map((isoDate) => combine([lookup(isoDate)], isoDate)),
    };
  }

  if (span === "weeks" || span === "ytd") {
    const end = today;
    const start =
      span === "ytd"
        ? `${today.slice(0, 4)}-01-01`
        : addDaysIso(sundayOfIsoDate(today), -7 * (WEEK_WINDOW - 1));
    const points: SalesExpensePoint[] = [];
    let week = sundayOfIsoDate(start);
    while (week <= end && points.length < 80) {
      const weekEnd = addDaysIso(week, 6);
      const from = week < start ? start : week;
      const to = weekEnd > end ? end : weekEnd;
      points.push(combine(eachDay(from, to).map(lookup), from));
      week = addDaysIso(week, 7);
    }
    return { grain: "week", points };
  }

  const end = span === "all" ? (days.at(-1)?.isoDate ?? today) : today;
  const start =
    span === "all"
      ? (days[0]?.isoDate ?? monthStart(today))
      : shiftMonth(monthStart(today), -(MONTH_WINDOW - 1));
  return {
    grain: "month",
    points: eachMonth(start, end).map((isoDate) => {
      const month = isoDate.slice(0, 7);
      const monthDays = eachDay(isoDate, addDaysIso(shiftMonth(isoDate, 1), -1))
        .filter((iso) => iso <= end)
        .map(lookup);
      const inMonth = monthDays.filter((day) => day.isoDate.startsWith(month));
      return combine(inMonth, isoDate);
    }),
  };
}
