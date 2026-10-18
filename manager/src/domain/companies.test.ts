import { describe, expect, it } from "vitest";
import { companySlug, parseCompanySignup, parseStaffInvite } from "./companies";

describe("company signup", () => {
  it("builds a url slug from the company name", () => {
    expect(companySlug("North Shore Cafe")).toBe("north-shore-cafe");
  });

  it("rejects a short password", () => {
    expect(
      parseCompanySignup({
        companyName: "North Shore",
        locationName: "Main",
        ownerName: "Amina Cole",
        email: "amina@example.com",
        password: "short",
        timezone: "America/New_York",
      }).ok,
    ).toBe(false);
  });

  it("accepts a manager invite and refuses an owner invite", () => {
    expect(
      parseStaffInvite({
        email: "sam@example.com",
        displayName: "Sam Lee",
        role: "manager",
      }).ok,
    ).toBe(true);
    expect(
      parseStaffInvite({
        email: "sam@example.com",
        displayName: "Sam Lee",
        role: "owner",
      }).ok,
    ).toBe(false);
  });
});
