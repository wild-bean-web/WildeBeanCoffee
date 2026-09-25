export interface LaborPeriod {
  startsOn: string;
  endsOn: string;
  loadedLaborCents: number;
}

export interface LaborCostChoice {
  source: "posted" | "statements" | "none";
  days: { isoDate: string; amountCents: number }[];
  totalCents: number;
}

function eachDay(startsOn: string, endsOn: string): string[] {
  const dates: string[] = [];
  const start = Date.parse(`${startsOn}T12:00:00.000Z`);
  const end = Date.parse(`${endsOn}T12:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return dates;
  const count = Math.round((end - start) / 86_400_000) + 1;
  for (let index = 0; index < count && index < 400; index += 1) {
    dates.push(new Date(start + index * 86_400_000).toISOString().slice(0, 10));
  }
  return dates;
}

export function allocatePayrollToDays(periods: LaborPeriod[]): { isoDate: string; amountCents: number }[] {
  const byDate = new Map<string, number>();
  for (const period of periods) {
    if (!Number.isInteger(period.loadedLaborCents) || period.loadedLaborCents === 0) continue;
    const days = eachDay(period.startsOn, period.endsOn);
    if (days.length === 0) continue;
    const base = Math.trunc(period.loadedLaborCents / days.length);
    let remainder = period.loadedLaborCents - base * days.length;
    for (const isoDate of days) {
      const extra = remainder > 0 ? 1 : remainder < 0 ? -1 : 0;
      if (extra !== 0) remainder -= extra;
      byDate.set(isoDate, (byDate.get(isoDate) ?? 0) + base + extra);
    }
  }
  return [...byDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([isoDate, amountCents]) => ({ isoDate, amountCents }));
}

export function chooseLaborCost(input: {
  posted: LaborPeriod[];
  statementPayroll: { isoDate: string; amountCents: number }[];
}): LaborCostChoice {
  const postedDays = allocatePayrollToDays(input.posted);
  const postedTotal = postedDays.reduce((sum, day) => sum + day.amountCents, 0);
  if (postedTotal > 0) {
    return { source: "posted", days: postedDays, totalCents: postedTotal };
  }
  const byDate = new Map<string, number>();
  for (const line of input.statementPayroll) {
    if (!Number.isInteger(line.amountCents) || line.amountCents === 0) continue;
    byDate.set(line.isoDate, (byDate.get(line.isoDate) ?? 0) + line.amountCents);
  }
  const days = [...byDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([isoDate, amountCents]) => ({ isoDate, amountCents }));
  const totalCents = days.reduce((sum, day) => sum + day.amountCents, 0);
  if (totalCents === 0) return { source: "none", days: [], totalCents: 0 };
  return { source: "statements", days, totalCents };
}
