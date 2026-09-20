import { parseMoneyToCents } from "@/lib/format";

export interface PayrollEarning {
  code: string;
  label: string;
  hours: string | null;
  rate: string | null;
  amountCents: number;
}

export interface PayrollNamedAmount {
  code: string;
  label: string;
  amountCents: number;
}

export interface ParsedPayrollEmployee {
  displayName: string;
  familyName: string;
  givenName: string;
  regularHours: string;
  overtimeHours: string;
  totalHours: string;
  regularRate: string | null;
  overtimeRate: string | null;
  regularWagesCents: number;
  overtimeWagesCents: number;
  tipsCents: number;
  wagesCents: number;
  grossCents: number;
  employeeTaxCents: number;
  netPayCents: number;
  employerTaxCents: number;
  loadedLaborCents: number;
  earnings: PayrollEarning[];
  employeeTaxes: PayrollNamedAmount[];
  employerLiabilities: PayrollNamedAmount[];
}

export interface ParsedPayrollPreview {
  companyName: string | null;
  checkDate: string | null;
  periodStartsOn: string | null;
  periodEndsOn: string | null;
  printedAt: string | null;
  batchReference: string | null;
  employeeCount: number;
  regularHours: string;
  overtimeHours: string;
  totalHours: string;
  regularWagesCents: number;
  overtimeWagesCents: number;
  tipsCents: number;
  wagesCents: number;
  grossCents: number;
  employeeTaxCents: number;
  netPayCents: number;
  employerTaxCents: number;
  loadedLaborCents: number;
  employees: ParsedPayrollEmployee[];
  laborSource?: "paychex" | "clover_time_clock";
  unmatchedEmployeeNames?: string[];
  estimatedEmployerTax?: boolean;
}

const HEADER_NOISE = new Set([
  "payroll preview",
  "hours and earnings",
  "taxes",
  "deductions",
  "employer",
  "description",
  "hours",
  "rate",
  "amount",
  "tax",
  "deduction",
  "net pay",
  "liability",
  "company totals:",
]);

function normalizeLines(pages: readonly string[]): string[] {
  const joined = pages.join("\n");
  const raw = joined
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const merged: string[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    const current = raw[index];
    const next = raw[index + 1];
    if (current === "Credit Card Tips" && next === "Owed") {
      merged.push("Credit Card Tips Owed");
      index += 1;
      continue;
    }
    if (current === "Nonqualified" && next === "Overtime") {
      merged.push("Nonqualified Overtime");
      index += 1;
      continue;
    }
    if (current === "FED" && next === "MEDCARE") {
      merged.push("FED MEDCARE");
      index += 1;
      continue;
    }
    merged.push(current);
  }
  return merged;
}

function isPageMarker(line: string): boolean {
  return /^\d+\s+of\s+\d+$/i.test(line);
}

function isHeaderNoise(line: string): boolean {
  return HEADER_NOISE.has(line.toLowerCase());
}

function parseHoursOrRate(line: string): string | null {
  if (!/^\d{1,4}(?:,\d{3})*(?:\.\d{1,4})?$/.test(line)) return null;
  return line.replace(/,/g, "");
}

function parseAmountLine(line: string): number | null {
  if (!/^\$?-?[\d,]+(?:\.\d{1,2})?$/.test(line) && !/^\(.*\)$/.test(line)) {
    return null;
  }
  return parseMoneyToCents(line);
}

function asHours(value: number): string {
  return value.toFixed(2);
}

function addHours(left: string, right: string): string {
  return asHours(Number.parseFloat(left) + Number.parseFloat(right));
}

function parseEmployeeName(value: string): {
  displayName: string;
  familyName: string;
  givenName: string;
} {
  const [familyName, ...rest] = value.split(",").map((part) => part.trim());
  const givenName = rest.join(" ").trim();
  return {
    displayName: givenName ? `${givenName} ${familyName}` : familyName,
    familyName,
    givenName,
  };
}

function parseDate(value: string): string | null {
  const match = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return null;
  const [, month, day, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function looksLikePayrollPreview(text: string): boolean {
  return (
    /payroll preview/i.test(text) &&
    /pay period:/i.test(text) &&
    /check date:/i.test(text)
  );
}

function parseEmployeeBlock(lines: string[]): ParsedPayrollEmployee | null {
  const usable = lines.filter(
    (line) => !isPageMarker(line) && !isHeaderNoise(line),
  );
  if (usable.length < 6) return null;

  const nameLine = usable[0];
  if (!nameLine) return null;
  const names = parseEmployeeName(nameLine);
  let cursor = 1;
  const earnings: PayrollEarning[] = [];

  while (cursor < usable.length) {
    const label = usable[cursor];
    if (/^(FED|MD|VA|DC|LOCAL)\b/i.test(label)) break;
    if (parseAmountLine(label) != null && !/^[A-Za-z]/.test(label)) break;

    if (label === "Regular") {
      const hours = parseHoursOrRate(usable[cursor + 1] ?? "");
      const rate = parseHoursOrRate(usable[cursor + 2] ?? "");
      const amountCents = parseAmountLine(usable[cursor + 3] ?? "");
      if (hours && rate && amountCents != null) {
        earnings.push({
          code: "regular",
          label: "Regular",
          hours,
          rate,
          amountCents,
        });
        cursor += 4;
        continue;
      }
    }
    if (label === "Nonqualified Overtime") {
      const hours = parseHoursOrRate(usable[cursor + 1] ?? "");
      const rate = parseHoursOrRate(usable[cursor + 2] ?? "");
      const amountCents = parseAmountLine(usable[cursor + 3] ?? "");
      if (hours && rate && amountCents != null) {
        earnings.push({
          code: "overtime",
          label: "Nonqualified Overtime",
          hours,
          rate,
          amountCents,
        });
        cursor += 4;
        continue;
      }
    }
    if (label === "Credit Card Tips Owed") {
      const hours = parseHoursOrRate(usable[cursor + 1] ?? "");
      const amountCents = parseAmountLine(usable[cursor + 2] ?? "");
      if (hours && amountCents != null) {
        earnings.push({
          code: "credit_card_tips",
          label: "Credit Card Tips Owed",
          hours,
          rate: null,
          amountCents,
        });
        cursor += 3;
        continue;
      }
    }
    cursor += 1;
  }

  const totalHours = parseHoursOrRate(usable[cursor] ?? "");
  const grossCents = parseAmountLine(usable[cursor + 1] ?? "");
  if (!totalHours || grossCents == null) return null;
  cursor += 2;

  const employeeTaxes: PayrollNamedAmount[] = [];
  while (cursor < usable.length && /^(FED|MD|VA|DC|LOCAL)\b/i.test(usable[cursor])) {
    const code = usable[cursor];
    const amountCents = parseAmountLine(usable[cursor + 1] ?? "");
    if (amountCents == null) break;
    employeeTaxes.push({ code, label: code, amountCents });
    cursor += 2;
  }

  const taxSum = employeeTaxes.reduce((sum, tax) => sum + tax.amountCents, 0);
  const taxTotal = parseAmountLine(usable[cursor] ?? "");
  if (taxTotal != null && Math.abs(taxTotal - taxSum) <= 1) {
    cursor += 1;
  }
  const netPayCents = parseAmountLine(usable[cursor] ?? "");
  if (netPayCents == null) return null;
  cursor += 1;

  const employerLiabilities: PayrollNamedAmount[] = [];
  while (cursor < usable.length && /^(FED|MD|VA|DC|LOCAL).*-ER$|^FED FUTA$/i.test(usable[cursor])) {
    const code = usable[cursor];
    const amountCents = parseAmountLine(usable[cursor + 1] ?? "");
    if (amountCents == null) break;
    employerLiabilities.push({ code, label: code, amountCents });
    cursor += 2;
  }
  const employerSum = employerLiabilities.reduce(
    (sum, item) => sum + item.amountCents,
    0,
  );
  const employerTotal = parseAmountLine(usable[cursor] ?? "");
  const employerTaxCents =
    employerTotal != null && Math.abs(employerTotal - employerSum) <= 1
      ? employerTotal
      : employerSum;

  const regular = earnings.find((item) => item.code === "regular");
  const overtime = earnings.find((item) => item.code === "overtime");
  const tips = earnings.find((item) => item.code === "credit_card_tips");
  const regularWagesCents = regular?.amountCents ?? 0;
  const overtimeWagesCents = overtime?.amountCents ?? 0;
  const tipsCents = tips?.amountCents ?? 0;
  const wagesCents = regularWagesCents + overtimeWagesCents;
  const employeeTaxCents = taxSum;

  return {
    displayName: names.displayName,
    familyName: names.familyName,
    givenName: names.givenName,
    regularHours: regular?.hours ?? "0.00",
    overtimeHours: overtime?.hours ?? "0.00",
    totalHours,
    regularRate: regular?.rate ?? null,
    overtimeRate: overtime?.rate ?? null,
    regularWagesCents,
    overtimeWagesCents,
    tipsCents,
    wagesCents,
    grossCents,
    employeeTaxCents,
    netPayCents,
    employerTaxCents,
    loadedLaborCents: wagesCents + employerTaxCents,
    earnings,
    employeeTaxes,
    employerLiabilities,
  };
}

export function parsePayrollPreview(pages: readonly string[]): ParsedPayrollPreview {
  const text = pages.join("\n");
  if (!looksLikePayrollPreview(text)) {
    throw new Error("This file is not a payroll preview.");
  }

  const lines = normalizeLines(pages);
  const employees: ParsedPayrollEmployee[] = [];
  let companyName: string | null = null;
  let checkDate: string | null = null;
  let periodStartsOn: string | null = null;
  let periodEndsOn: string | null = null;
  let printedAt: string | null = null;
  let batchReference: string | null = null;
  let employeeCountHint: number | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const employeeMatch = line.match(/^Employee:\s*(.+)$/i);
    if (employeeMatch) {
      const start = index;
      let end = lines.length;
      for (let look = index + 1; look < lines.length; look += 1) {
        if (
          /^Employee:/i.test(lines[look]) ||
          /^Company Totals:/i.test(lines[look]) ||
          /^Total Net Pays/i.test(lines[look])
        ) {
          end = look;
          break;
        }
      }
      const parsed = parseEmployeeBlock([
        employeeMatch[1],
        ...lines.slice(start + 1, end),
      ]);
      if (parsed) employees.push(parsed);
      index = end - 1;
      continue;
    }

    const companyMatch = line.match(/^Company:\s*(.+)$/i);
    if (companyMatch && !/^Company Totals:/i.test(line)) {
      companyName = companyMatch[1].trim();
    }
    if (/^Check date:/i.test(line)) {
      checkDate = parseDate(line);
    }
    if (/^Date Printed:/i.test(line)) {
      printedAt = line.replace(/^Date Printed:\s*/i, "").trim();
    }
    if (/^Pay Period:/i.test(line)) {
      const dates = [...line.matchAll(/(\d{1,2}\/\d{1,2}\/\d{4})/g)].map(
        (match) => parseDate(match[1]),
      );
      periodStartsOn = dates[0] ?? periodStartsOn;
      periodEndsOn = dates[1] ?? periodEndsOn;
    }
    if (/^\d+\s+-\s+[A-Z0-9/]+$/i.test(line)) {
      batchReference = line;
    }
    const countMatch = line.match(/Total Net Pays for - Company:\s*(\d+)/i);
    if (countMatch) {
      employeeCountHint = Number.parseInt(countMatch[1], 10);
    }
  }

  if (employees.length === 0) {
    throw new Error("No employees could be read from this payroll preview.");
  }

  const totals = employees.reduce(
    (sum, employee) => ({
      regularHours: addHours(sum.regularHours, employee.regularHours),
      overtimeHours: addHours(sum.overtimeHours, employee.overtimeHours),
      totalHours: addHours(sum.totalHours, employee.totalHours),
      regularWagesCents: sum.regularWagesCents + employee.regularWagesCents,
      overtimeWagesCents: sum.overtimeWagesCents + employee.overtimeWagesCents,
      tipsCents: sum.tipsCents + employee.tipsCents,
      wagesCents: sum.wagesCents + employee.wagesCents,
      grossCents: sum.grossCents + employee.grossCents,
      employeeTaxCents: sum.employeeTaxCents + employee.employeeTaxCents,
      netPayCents: sum.netPayCents + employee.netPayCents,
      employerTaxCents: sum.employerTaxCents + employee.employerTaxCents,
      loadedLaborCents: sum.loadedLaborCents + employee.loadedLaborCents,
    }),
    {
      regularHours: "0.00",
      overtimeHours: "0.00",
      totalHours: "0.00",
      regularWagesCents: 0,
      overtimeWagesCents: 0,
      tipsCents: 0,
      wagesCents: 0,
      grossCents: 0,
      employeeTaxCents: 0,
      netPayCents: 0,
      employerTaxCents: 0,
      loadedLaborCents: 0,
    },
  );

  return {
    companyName,
    checkDate,
    periodStartsOn,
    periodEndsOn,
    printedAt,
    batchReference,
    employeeCount: employeeCountHint ?? employees.length,
    ...totals,
    employees,
  };
}
