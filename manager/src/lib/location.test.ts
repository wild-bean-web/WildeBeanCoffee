import { describe, expect, it } from "vitest";
import {
  formatCafeAddress,
  locationCodeFromName,
  pickActiveLocationId,
} from "./location";

describe("pickActiveLocationId", () => {
  it("returns null when the staff member has no locations", () => {
    expect(pickActiveLocationId([], "any")).toBeNull();
  });

  it("keeps a requested location only when the staff member can access it", () => {
    expect(
      pickActiveLocationId(["loc-a", "loc-b"], "loc-b"),
    ).toBe("loc-b");
    expect(
      pickActiveLocationId(["loc-a", "loc-b"], "loc-c"),
    ).toBe("loc-a");
  });
});

describe("locationCodeFromName", () => {
  it("builds a stable location code from a store name", () => {
    expect(locationCodeFromName("Rockville")).toBe("rockville");
    expect(locationCodeFromName("  Silver Spring  ")).toBe("silver-spring");
    expect(locationCodeFromName("***")).toBe("store");
  });
});

describe("formatCafeAddress", () => {
  it("formats the Rockville store address", () => {
    expect(
      formatCafeAddress({
        line1: "1532 Rockville Pike",
        city: "Rockville",
        region: "MD",
        postalCode: "20852",
        phone: "+1 227-280-7062",
      }),
    ).toBe("1532 Rockville Pike · Rockville, MD 20852 · +1 227-280-7062");
  });
});
