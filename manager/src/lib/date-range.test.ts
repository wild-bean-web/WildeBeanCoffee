import { describe, expect, it } from "vitest";
import {
  eachIsoDate,
  instantToIsoDate,
  isIsoDate,
  lastMonthRange,
  monthEndIso,
  monthStartIso,
  parseDateRangeParams,
  quarterStartIso,
  sundayOfIsoDate,
  zonedDayStartMs,
} from "./date-range";

describe("date range helpers", () => {
  it("accepts real calendar dates only", () => {
    expect(isIsoDate("2026-06-29")).toBe(true);
    expect(isIsoDate("2026-02-31")).toBe(false);
    expect(isIsoDate("06/29/2026")).toBe(false);
  });

  it("builds month and quarter bounds", () => {
    expect(monthStartIso("2026-09-19")).toBe("2026-09-01");
    expect(monthEndIso("2026-09-19")).toBe("2026-09-30");
    expect(monthEndIso("2026-02-10")).toBe("2026-02-28");
    expect(quarterStartIso("2026-09-19")).toBe("2026-07-01");
    expect(lastMonthRange("2026-09-19")).toEqual({
      startsOn: "2026-08-01",
      endsOn: "2026-08-31",
    });
  });

  it("parses and sorts query params", () => {
    expect(parseDateRangeParams({})).toBeNull();
    expect(parseDateRangeParams({ from: "2026-06-16", to: "2026-06-29" })).toEqual({
      startsOn: "2026-06-16",
      endsOn: "2026-06-29",
    });
    expect(parseDateRangeParams({ from: "2026-06-29", to: "2026-06-16" })).toEqual({
      startsOn: "2026-06-16",
      endsOn: "2026-06-29",
    });
  });

  it("walks inclusive calendar dates", () => {
    expect(eachIsoDate("2026-06-28", "2026-07-01")).toEqual([
      "2026-06-28",
      "2026-06-29",
      "2026-06-30",
      "2026-07-01",
    ]);
  });

  it("maps instants and week starts onto calendar dates", () => {
    expect(instantToIsoDate(Date.parse("2026-09-19T04:00:00.000Z"), "America/New_York")).toBe(
      "2026-09-19",
    );
    expect(sundayOfIsoDate("2026-09-19")).toBe("2026-09-13");
    expect(sundayOfIsoDate("2026-09-13")).toBe("2026-09-13");
  });

  it("converts a business date to the location midnight instant", () => {
    expect(zonedDayStartMs("2026-07-06", "America/New_York")).toBe(
      Date.parse("2026-07-06T04:00:00.000Z"),
    );
    expect(zonedDayStartMs("2026-01-15", "America/New_York")).toBe(
      Date.parse("2026-01-15T05:00:00.000Z"),
    );
  });
});
