import { describe, expect, it } from "vitest";
import {
  buildCloverLaborPreview,
  hoursAtRateCents,
  matchPayrollRate,
  splitPersonName,
} from "./clover-labor";

const rates = [
  {
    displayName: "Kalie Blanco",
    familyName: "Blanco",
    givenName: "Kalie",
    regularRate: "15.50",
    overtimeRate: "23.25",
  },
  {
    displayName: "Samuel Roberts",
    familyName: "Roberts",
    givenName: "Samuel",
    regularRate: "16.00",
    overtimeRate: null,
  },
];

describe("Clover labor preview", () => {
  it("matches Paychex rates by full or given name", () => {
    expect(matchPayrollRate("Kalie Blanco", rates)?.regularRate).toBe("15.50");
    expect(matchPayrollRate("Kalie", rates)?.displayName).toBe("Kalie Blanco");
    expect(matchPayrollRate("Unknown Barista", rates)).toBeNull();
    expect(splitPersonName("Kalie Blanco")).toEqual({
      displayName: "Kalie Blanco",
      givenName: "Kalie",
      familyName: "Blanco",
    });
  });

  it("splits weekly overtime and prices hours from Paychex rates", () => {
    const monday = Date.parse("2026-09-14T12:00:00.000Z");
    const parsed = buildCloverLaborPreview({
      locationName: "Rockville",
      startsOn: "2026-09-14",
      endsOn: "2026-09-16",
      timeZone: "UTC",
      rates,
      employerTaxCents: 1000,
      wagesCents: 10_000,
      shifts: [
        {
          id: "S1",
          employeeId: "E1",
          employeeName: "Kalie Blanco",
          inTimeMs: monday,
          outTimeMs: monday + 10 * 3_600_000,
          deleted: false,
        },
        {
          id: "S2",
          employeeId: "E1",
          employeeName: "Kalie Blanco",
          inTimeMs: monday + 24 * 3_600_000,
          outTimeMs: monday + 24 * 3_600_000 + 10 * 3_600_000,
          deleted: false,
        },
        {
          id: "S3",
          employeeId: "E1",
          employeeName: "Kalie Blanco",
          inTimeMs: monday + 48 * 3_600_000,
          outTimeMs: monday + 48 * 3_600_000 + 22 * 3_600_000,
          deleted: false,
        },
        {
          id: "OPEN",
          employeeId: "E1",
          employeeName: "Kalie Blanco",
          inTimeMs: monday,
          outTimeMs: 0,
          deleted: false,
        },
      ],
      payments: [
        { employeeId: "E1", tipCents: 500, result: "SUCCESS" },
        { employeeId: "E1", tipCents: 50, result: "FAIL" },
      ],
    });

    const kalie = parsed.employees[0];
    expect(kalie.regularHours).toBe("40.00");
    expect(kalie.overtimeHours).toBe("2.00");
    expect(kalie.regularWagesCents).toBe(hoursAtRateCents(40, "15.50"));
    expect(kalie.overtimeWagesCents).toBe(hoursAtRateCents(2, "23.25"));
    expect(kalie.tipsCents).toBe(500);
    expect(kalie.wagesCents).toBe(kalie.regularWagesCents + kalie.overtimeWagesCents);
    expect(kalie.employerTaxCents).toBe(Math.round(kalie.wagesCents * 0.1));
    expect(kalie.loadedLaborCents).toBe(kalie.wagesCents + kalie.employerTaxCents);
    expect(parsed.unmatchedEmployeeNames).toEqual([]);
    expect(parsed.estimatedEmployerTax).toBe(true);
    expect(parsed.companyName).toBe("Clover time clock · Rockville");
  });

  it("keeps unmatched clock hours without inventing a wage", () => {
    const start = Date.parse("2026-09-19T14:00:00.000Z");
    const parsed = buildCloverLaborPreview({
      locationName: "Rockville",
      startsOn: "2026-09-19",
      endsOn: "2026-09-19",
      timeZone: "UTC",
      rates,
      shifts: [
        {
          id: "S9",
          employeeId: "E9",
          employeeName: "New Hire",
          inTimeMs: start,
          outTimeMs: start + 5 * 3_600_000,
          deleted: false,
        },
      ],
    });
    expect(parsed.employees[0]?.totalHours).toBe("5.00");
    expect(parsed.employees[0]?.wagesCents).toBe(0);
    expect(parsed.unmatchedEmployeeNames).toEqual(["New Hire"]);
    expect(parsed.loadedLaborCents).toBe(0);
  });
});
