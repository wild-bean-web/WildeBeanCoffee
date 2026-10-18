import { isIsoDate, PAYROLL_PERIOD_ANCHOR } from "@/lib/date-range";

export interface PayrollCalendar {
  anchor: string;
  periodDays: 7 | 14;
  saved: boolean;
}

export function payrollCalendarFromSettings(settings: unknown): PayrollCalendar {
  const fallback: PayrollCalendar = {
    anchor: PAYROLL_PERIOD_ANCHOR,
    periodDays: 14,
    saved: false,
  };
  if (!settings || typeof settings !== "object" || !("payroll" in settings)) {
    return fallback;
  }
  const payroll = settings.payroll;
  if (!payroll || typeof payroll !== "object") return fallback;
  const anchor = "anchor" in payroll ? payroll.anchor : undefined;
  const periodDays = "periodDays" in payroll ? payroll.periodDays : undefined;
  if (typeof anchor !== "string" || !isIsoDate(anchor)) return fallback;
  if (periodDays !== 7 && periodDays !== 14) return fallback;
  return { anchor, periodDays, saved: true };
}
