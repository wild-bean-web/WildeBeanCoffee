import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { looksLikePayrollPreview, parsePayrollPreview } from "./preview";

const fixture = JSON.parse(
  readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures/payroll-preview.pages.json"),
    "utf8",
  ),
) as string[];

describe("parsePayrollPreview", () => {
  it("reads the Wild Bean biweekly payroll preview", () => {
    expect(looksLikePayrollPreview(fixture.join("\n"))).toBe(true);
    const parsed = parsePayrollPreview(fixture);

    expect(parsed.companyName).toBe("WILD BEAN COFFEE");
    expect(parsed.checkDate).toBe("2026-07-06");
    expect(parsed.periodStartsOn).toBe("2026-06-16");
    expect(parsed.periodEndsOn).toBe("2026-06-29");
    expect(parsed.employeeCount).toBe(6);
    expect(parsed.employees.map((employee) => employee.displayName)).toEqual([
      "Arya Bahrami",
      "Kalie Blanco",
      "Janoi Daley",
      "Annelise Jeung",
      "Helina Mesfin",
      "Samuel Roberts",
    ]);

    const kalie = parsed.employees[1];
    expect(kalie.regularHours).toBe("77.04");
    expect(kalie.overtimeHours).toBe("1.58");
    expect(kalie.regularWagesCents).toBe(119412);
    expect(kalie.overtimeWagesCents).toBe(3674);
    expect(kalie.tipsCents).toBe(35123);
    expect(kalie.netPayCents).toBe(123968);
    expect(kalie.employerTaxCents).toBe(16365);

    expect(parsed.totalHours).toBe("301.23");
    expect(parsed.grossCents).toBe(591573);
    expect(parsed.tipsCents).toBe(134572);
    expect(parsed.wagesCents).toBe(457001);
    expect(parsed.netPayCents).toBe(476943);
    expect(parsed.employerTaxCents).toBe(63354);
    expect(parsed.loadedLaborCents).toBe(520355);
  });
});
