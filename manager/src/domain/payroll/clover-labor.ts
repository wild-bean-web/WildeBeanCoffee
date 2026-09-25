import {
  instantToIsoDate,
  sundayOfIsoDate,
} from "@/lib/date-range";
import type { ParsedPayrollEmployee, ParsedPayrollPreview, PayrollEarning } from "./preview";

const MAX_SHIFT_HOURS = 24;
const WEEKLY_OVERTIME_HOURS = 40;

export interface CloverLaborRate {
  displayName: string;
  familyName: string;
  givenName: string;
  regularRate: string | null;
  overtimeRate: string | null;
}

export interface CloverLaborShiftInput {
  id: string;
  employeeId: string;
  employeeName: string;
  inTimeMs: number;
  outTimeMs: number;
  deleted: boolean;
}

export interface CloverLaborPaymentInput {
  employeeId: string | null;
  tipCents: number;
  result: string;
}

export interface CloverLaborBuildInput {
  locationName: string;
  startsOn: string;
  endsOn: string;
  timeZone: string;
  shifts: readonly CloverLaborShiftInput[];
  payments?: readonly CloverLaborPaymentInput[];
  rates: readonly CloverLaborRate[];
  employerTaxCents?: number;
  wagesCents?: number;
}

export interface CloverLaborPreview extends ParsedPayrollPreview {
  unmatchedEmployeeNames: string[];
  pricedEmployeeCount: number;
  estimatedEmployerTax: boolean;
}

export function normalizePayrollName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function splitPersonName(name: string): {
  displayName: string;
  familyName: string;
  givenName: string;
} {
  const displayName = name.trim().replace(/\s+/g, " ");
  const parts = displayName.split(" ").filter(Boolean);
  if (parts.length <= 1) {
    const token = parts[0] || "Employee";
    return { displayName: token, familyName: token, givenName: token };
  }
  return {
    displayName,
    givenName: parts.slice(0, -1).join(" "),
    familyName: parts[parts.length - 1] ?? displayName,
  };
}

export function matchPayrollRate(
  name: string,
  rates: readonly CloverLaborRate[],
): CloverLaborRate | null {
  const normalized = normalizePayrollName(name);
  if (!normalized) return null;
  const exact = rates.find(
    (rate) => normalizePayrollName(rate.displayName) === normalized,
  );
  if (exact) return exact;

  const names = splitPersonName(name);
  if (!name.includes(" ")) {
    const givenMatches = rates.filter(
      (rate) => normalizePayrollName(rate.givenName) === normalized,
    );
    return givenMatches.length === 1 ? givenMatches[0] : null;
  }

  const familyMatches = rates.filter(
    (rate) =>
      normalizePayrollName(rate.familyName) ===
      normalizePayrollName(names.familyName),
  );
  if (familyMatches.length === 1) return familyMatches[0];

  const givenMatches = rates.filter(
    (rate) =>
      normalizePayrollName(rate.givenName) ===
      normalizePayrollName(names.givenName),
  );
  return givenMatches.length === 1 ? givenMatches[0] : null;
}

export function formatPayrollHours(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return "0.00";
  return (Math.round(hours * 100) / 100).toFixed(2);
}

export function hoursAtRateCents(hours: number, rate: string | null): number {
  if (!rate) return 0;
  const dollars = Number.parseFloat(rate);
  if (!Number.isFinite(dollars) || dollars < 0 || hours <= 0) return 0;
  return Math.round(hours * dollars * 100);
}

function overtimeRateFor(rate: CloverLaborRate | null): string | null {
  if (!rate) return null;
  if (rate.overtimeRate) return rate.overtimeRate;
  if (!rate.regularRate) return null;
  const regular = Number.parseFloat(rate.regularRate);
  if (!Number.isFinite(regular) || regular < 0) return null;
  return (Math.round(regular * 1.5 * 10000) / 10000).toFixed(4);
}

function shiftHours(shift: CloverLaborShiftInput): number {
  if (shift.deleted || shift.outTimeMs <= shift.inTimeMs) return 0;
  const hours = (shift.outTimeMs - shift.inTimeMs) / 3_600_000;
  if (!Number.isFinite(hours) || hours <= 0) return 0;
  return Math.min(hours, MAX_SHIFT_HOURS);
}

function applyWeeklyOvertime(
  hoursByWeek: Map<string, number>,
  week: string,
  hours: number,
) {
  const already = hoursByWeek.get(week) ?? 0;
  const regularRoom = Math.max(0, WEEKLY_OVERTIME_HOURS - already);
  const regularHours = Math.min(hours, regularRoom);
  const overtimeHours = hours - regularHours;
  hoursByWeek.set(week, already + hours);
  return { regularHours, overtimeHours };
}

export function buildCloverLaborPreview(
  input: CloverLaborBuildInput,
): CloverLaborPreview {
  const tipsByEmployee = new Map<string, number>();
  for (const payment of input.payments ?? []) {
    if (!payment.employeeId) continue;
    if (payment.result && payment.result.toUpperCase() !== "SUCCESS") continue;
    if (payment.tipCents <= 0) continue;
    tipsByEmployee.set(
      payment.employeeId,
      (tipsByEmployee.get(payment.employeeId) ?? 0) + payment.tipCents,
    );
  }

  const grouped = new Map<
    string,
    {
      name: string;
      shifts: CloverLaborShiftInput[];
    }
  >();
  for (const shift of input.shifts) {
    const hours = shiftHours(shift);
    if (hours <= 0) continue;
    const businessDate = instantToIsoDate(shift.inTimeMs, input.timeZone);
    if (businessDate < input.startsOn || businessDate > input.endsOn) continue;
    const current = grouped.get(shift.employeeId) ?? {
      name: shift.employeeName,
      shifts: [],
    };
    if (!current.name.trim()) current.name = shift.employeeName;
    current.shifts.push(shift);
    grouped.set(shift.employeeId, current);
  }

  const unmatchedEmployeeNames: string[] = [];
  const employees: ParsedPayrollEmployee[] = [];
  const burden =
    input.wagesCents && input.wagesCents > 0 && input.employerTaxCents
      ? input.employerTaxCents / input.wagesCents
      : 0;

  for (const [employeeId, group] of [...grouped.entries()].sort((left, right) =>
    left[1].name.localeCompare(right[1].name),
  )) {
    const ordered = [...group.shifts].sort((left, right) => left.inTimeMs - right.inTimeMs);
    const weekHours = new Map<string, number>();
    let regularHours = 0;
    let overtimeHours = 0;
    for (const shift of ordered) {
      const hours = shiftHours(shift);
      const businessDate = instantToIsoDate(shift.inTimeMs, input.timeZone);
      const week = sundayOfIsoDate(businessDate);
      const split = applyWeeklyOvertime(weekHours, week, hours);
      regularHours += split.regularHours;
      overtimeHours += split.overtimeHours;
    }

    const names = splitPersonName(group.name);
    const rate = matchPayrollRate(group.name, input.rates);
    if (!rate) unmatchedEmployeeNames.push(names.displayName);
    const overtimeRate = overtimeRateFor(rate);
    const regularWagesCents = hoursAtRateCents(regularHours, rate?.regularRate ?? null);
    const overtimeWagesCents = hoursAtRateCents(overtimeHours, overtimeRate);
    const wagesCents = regularWagesCents + overtimeWagesCents;
    const tipsCents = tipsByEmployee.get(employeeId) ?? 0;
    const employerTaxCents = Math.round(wagesCents * burden);
    const loadedLaborCents = wagesCents + employerTaxCents;
    const earnings: PayrollEarning[] = [
      {
        code: "regular",
        label: "Regular",
        hours: formatPayrollHours(regularHours),
        rate: rate?.regularRate ?? null,
        amountCents: regularWagesCents,
      },
      {
        code: "overtime",
        label: "Overtime",
        hours: formatPayrollHours(overtimeHours),
        rate: overtimeRate,
        amountCents: overtimeWagesCents,
      },
    ];
    if (tipsCents > 0) {
      earnings.push({
        code: "credit_card_tips",
        label: "Credit card tips",
        hours: null,
        rate: null,
        amountCents: tipsCents,
      });
    }

    employees.push({
      displayName: names.displayName,
      familyName: names.familyName,
      givenName: names.givenName,
      regularHours: formatPayrollHours(regularHours),
      overtimeHours: formatPayrollHours(overtimeHours),
      totalHours: formatPayrollHours(regularHours + overtimeHours),
      regularRate: rate?.regularRate ?? null,
      overtimeRate,
      regularWagesCents,
      overtimeWagesCents,
      tipsCents,
      wagesCents,
      grossCents: wagesCents + tipsCents,
      employeeTaxCents: 0,
      netPayCents: 0,
      employerTaxCents,
      loadedLaborCents,
      earnings,
      employeeTaxes: [],
      employerLiabilities: employerTaxCents
        ? [
            {
              code: "EST_ER_TAX",
              label: "Estimated employer tax from last Paychex run",
              amountCents: employerTaxCents,
            },
          ]
        : [],
    });
  }

  const totals = employees.reduce(
    (sum, employee) => ({
      regularHours: sum.regularHours + Number.parseFloat(employee.regularHours),
      overtimeHours:
        sum.overtimeHours + Number.parseFloat(employee.overtimeHours),
      totalHours: sum.totalHours + Number.parseFloat(employee.totalHours),
      regularWagesCents: sum.regularWagesCents + employee.regularWagesCents,
      overtimeWagesCents: sum.overtimeWagesCents + employee.overtimeWagesCents,
      tipsCents: sum.tipsCents + employee.tipsCents,
      wagesCents: sum.wagesCents + employee.wagesCents,
      grossCents: sum.grossCents + employee.grossCents,
      employerTaxCents: sum.employerTaxCents + employee.employerTaxCents,
      loadedLaborCents: sum.loadedLaborCents + employee.loadedLaborCents,
    }),
    {
      regularHours: 0,
      overtimeHours: 0,
      totalHours: 0,
      regularWagesCents: 0,
      overtimeWagesCents: 0,
      tipsCents: 0,
      wagesCents: 0,
      grossCents: 0,
      employerTaxCents: 0,
      loadedLaborCents: 0,
    },
  );

  return {
    companyName: `Clover time clock · ${input.locationName}`,
    checkDate: input.endsOn,
    periodStartsOn: input.startsOn,
    periodEndsOn: input.endsOn,
    printedAt: null,
    batchReference: `clover-labor:${input.startsOn}:${input.endsOn}`,
    employeeCount: employees.length,
    regularHours: formatPayrollHours(totals.regularHours),
    overtimeHours: formatPayrollHours(totals.overtimeHours),
    totalHours: formatPayrollHours(totals.totalHours),
    regularWagesCents: totals.regularWagesCents,
    overtimeWagesCents: totals.overtimeWagesCents,
    tipsCents: totals.tipsCents,
    wagesCents: totals.wagesCents,
    grossCents: totals.grossCents,
    employeeTaxCents: 0,
    netPayCents: 0,
    employerTaxCents: totals.employerTaxCents,
    loadedLaborCents: totals.loadedLaborCents,
    employees,
    laborSource: "clover_time_clock",
    unmatchedEmployeeNames,
    pricedEmployeeCount: employees.length - unmatchedEmployeeNames.length,
    estimatedEmployerTax: burden > 0 && totals.employerTaxCents > 0,
  };
}
