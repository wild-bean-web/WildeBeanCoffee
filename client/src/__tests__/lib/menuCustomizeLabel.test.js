import {
  getAddToCartLabel,
  usesCustomizeLabel,
} from "../../lib/menuCustomizeLabel";

describe("menuCustomizeLabel", () => {
  it("uses Customize for Build Your Own Bowl when it has modifiers", () => {
    const item = {
      name: "Build Your Own Bowl",
      modifierGroups: [{ name: "Base" }],
    };
    expect(usesCustomizeLabel(item)).toBe(true);
    expect(getAddToCartLabel(item)).toBe("Customize");
  });

  it("uses Customize for the Catering traveler when it has modifiers", () => {
    const item = {
      name: "HOT Drip Coffee Traveler (Serves 10)",
      modifierGroups: [{ name: "Catering Milk" }],
    };
    expect(usesCustomizeLabel(item)).toBe(true);
    expect(getAddToCartLabel(item)).toBe("Customize");
  });

  it("keeps Add to Cart for other modifier drinks", () => {
    const item = {
      name: "Latte",
      modifierGroups: [{ name: "Milk Choice" }],
    };
    expect(usesCustomizeLabel(item)).toBe(false);
    expect(getAddToCartLabel(item)).toBe("Add to Cart");
  });

  it("keeps Add to Cart when traveler has no modifier groups yet", () => {
    const item = { name: "HOT Drip Coffee Traveler (Serves 10)" };
    expect(usesCustomizeLabel(item)).toBe(false);
    expect(getAddToCartLabel(item)).toBe("Add to Cart");
  });
});
