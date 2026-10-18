import { describe, expect, it } from "vitest";
import { quantityToPull, recipeCodeFromName, uniqueRecipeCode } from "./recipes";

describe("recipe drafts", () => {
  it("builds a stable code from the recipe name", () => {
    expect(recipeCodeFromName("  Oat Milk Latte ")).toBe("oat-milk-latte");
    expect(recipeCodeFromName("***")).toBe("recipe");
  });

  it("keeps codes unique inside the company", () => {
    expect(uniqueRecipeCode("Latte", new Set(["latte"]))).toBe("latte-2");
    expect(uniqueRecipeCode("Latte", new Set())).toBe("latte");
  });

  it("increases the pull when part of the ingredient is lost", () => {
    expect(quantityToPull(1, 0)).toBe(1);
    expect(quantityToPull(8, 0.2)).toBe(10);
    expect(() => quantityToPull(1, 1)).toThrow(/Waste factor/);
  });
});
