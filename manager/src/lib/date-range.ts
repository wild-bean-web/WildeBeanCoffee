const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface DateRange {
  startsOn: string;
  endsOn: string;
}

export function isIsoDate(value: string | null | undefined): value is string {
  if (!value || !ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
  );
}

export function todayIso(timeZone = "America/New_York"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function addDaysIso(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function eachIsoDate(startsOn: string, endsOn: string): string[] {
  const dates: string[] = [];
  let current = startsOn;
  while (current <= endsOn) {
    dates.push(current);
    current = addDaysIso(current, 1);
    if (dates.length > 366) {
      throw new Error("Date range cannot exceed one year.");
    }
  }
  return dates;
}

export function instantToIsoDate(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

export function sundayOfIsoDate(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00.000Z`);
  return addDaysIso(isoDate, -date.getUTCDay());
}

export function zonedDayStartMs(isoDate: string, timeZone: string): number {
  const asUtc = Date.parse(`${isoDate}T00:00:00.000Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(asUtc));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";
  const shownAsUtc = Date.parse(
    `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}:${value("second")}Z`,
  );
  return asUtc - (shownAsUtc - asUtc);
}

export function monthStartIso(isoDate: string): string {
  return `${isoDate.slice(0, 7)}-01`;
}

export function monthEndIso(isoDate: string): string {
  const year = Number.parseInt(isoDate.slice(0, 4), 10);
  const month = Number.parseInt(isoDate.slice(5, 7), 10);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

export function quarterStartIso(isoDate: string): string {
  const month = Number.parseInt(isoDate.slice(5, 7), 10);
  const quarterStart = Math.floor((month - 1) / 3) * 3 + 1;
  return `${isoDate.slice(0, 4)}-${String(quarterStart).padStart(2, "0")}-01`;
}

export function yearStartIso(isoDate: string): string {
  return `${isoDate.slice(0, 4)}-01-01`;
}

export function lastMonthRange(isoDate: string): DateRange {
  const previous = addDaysIso(monthStartIso(isoDate), -1);
  return {
    startsOn: monthStartIso(previous),
    endsOn: previous,
  };
}

export function parseDateRangeParams(
  params: { from?: string | string[]; to?: string | string[] },
): DateRange | null {
  const fromValue = Array.isArray(params.from) ? params.from[0] : params.from;
  const toValue = Array.isArray(params.to) ? params.to[0] : params.to;
  if (!isIsoDate(fromValue) && !isIsoDate(toValue)) return null;
  let startsOn = isIsoDate(fromValue) ? fromValue : (toValue as string);
  let endsOn = isIsoDate(toValue) ? toValue : startsOn;
  if (startsOn > endsOn) {
    const swapped = startsOn;
    startsOn = endsOn;
    endsOn = swapped;
  }
  return { startsOn, endsOn };
}

export function reportRangePresets(today = todayIso()): {
  id: string;
  label: string;
  range: DateRange;
}[] {
  return [
    {
      id: "this-month",
      label: "This month",
      range: { startsOn: monthStartIso(today), endsOn: monthEndIso(today) },
    },
    {
      id: "last-month",
      label: "Last month",
      range: lastMonthRange(today),
    },
    {
      id: "last-14",
      label: "Last 14 days",
      range: { startsOn: addDaysIso(today, -13), endsOn: today },
    },
    {
      id: "last-30",
      label: "Last 30 days",
      range: { startsOn: addDaysIso(today, -29), endsOn: today },
    },
    {
      id: "quarter",
      label: "This quarter",
      range: { startsOn: quarterStartIso(today), endsOn: today },
    },
    {
      id: "ytd",
      label: "Year to date",
      range: { startsOn: yearStartIso(today), endsOn: today },
    },
  ];
}

export function sameRange(left: DateRange | null, right: DateRange): boolean {
  return Boolean(
    left && left.startsOn === right.startsOn && left.endsOn === right.endsOn,
  );
}
