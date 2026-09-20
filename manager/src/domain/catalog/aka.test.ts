import { describe, expect, it } from "vitest";
import {
  canonicalVendorName,
  extractVendorSku,
  inferProductCategory,
  suggestCountSheetName,
  vendorDescriptionWithoutSku,
} from "./aka";

describe("suggestCountSheetName", () => {
  it("shortens a Restaurant Store cup description to a count-sheet AKA", () => {
    expect(
      suggestCountSheetName(
        "Choice Clear PET Customizable Plastic Cold Cup - 16 oz. - 1,000/Case",
      ),
    ).toBe("16 oz Plastic Cold Cup");
  });

  it("keeps a compact name when the vendor text is already short", () => {
    expect(suggestCountSheetName("Whole milk")).toBe("Whole Milk");
  });
});

describe("canonicalVendorName", () => {
  it("remembers Restaurant Store invoice names as one vendor", () => {
    expect(canonicalVendorName("Restaurant Store")).toBe(
      "The Restaurant Store",
    );
    expect(canonicalVendorName("THE RESTAURANT STORE")).toBe(
      "The Restaurant Store",
    );
    expect(canonicalVendorName("Sysco")).toBe("Sysco");
  });
});

describe("vendor line helpers", () => {
  it("pulls a SKU off the front of a vendor description", () => {
    expect(
      extractVendorSku("488616CUP Choice Plastic Cold Cup - 16 oz."),
    ).toBe("488616CUP");
    expect(
      vendorDescriptionWithoutSku(
        "488616CUP Choice Plastic Cold Cup - 16 oz.",
      ),
    ).toBe("Choice Plastic Cold Cup - 16 oz.");
  });

  it("routes cups onto the dry/cupware walking path", () => {
    expect(inferProductCategory("16 oz Plastic Cold Cup")).toBe("Cupware");
  });
});
