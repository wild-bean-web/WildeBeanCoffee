import { describe, expect, it } from "vitest";
import { capabilitiesFor, hasCapability } from "./capabilities";

describe("manager role capabilities", () => {
  it("keeps financial details away from operational roles", () => {
    expect(hasCapability("manager", "profit:view")).toBe(false);
    expect(hasCapability("manager", "payroll:view")).toBe(false);
    expect(hasCapability("manager", "payroll:capture")).toBe(false);
    expect(hasCapability("accountant", "payroll:capture")).toBe(true);
    expect(hasCapability("accountant", "profit:view")).toBe(true);
  });

  it("allows managers to run daily operational workflows", () => {
    expect(hasCapability("manager", "purchase:capture")).toBe(true);
    expect(hasCapability("manager", "receiving:record")).toBe(true);
    expect(hasCapability("manager", "waste:record")).toBe(true);
  });

  it("gives owners every defined capability", () => {
    expect(capabilitiesFor("owner")).toContain("users:manage");
    expect(capabilitiesFor("owner")).toContain("close:reopen");
    expect(capabilitiesFor("owner")).toContain("documents:view-restricted");
    expect(hasCapability("owner", "documents:delete")).toBe(true);
  });

  it("keeps document deletion with owners, not operational roles", () => {
    expect(hasCapability("manager", "documents:delete")).toBe(false);
    expect(hasCapability("purchaser", "documents:delete")).toBe(false);
    expect(hasCapability("accountant", "documents:delete")).toBe(false);
  });
});
