import { applyIncludedMilkPricing } from "../config/includedMilk.js";

describe("applyIncludedMilkPricing", () => {
  const milkGroup = {
    name: "Milk Choice",
    options: [
      { name: "Whole Milk", price: 0 },
      { name: "Oat Milk", price: 0.8 },
      { name: "Almond Milk", price: 0.8 },
      { name: "Heavy Cream", price: 0.6 },
    ],
  };

  it("zeros every milk option on the tiramisu shaken espresso", () => {
    const item = applyIncludedMilkPricing({
      name: "Tiramisu Cacao Shaken Espresso",
      modifierGroups: [milkGroup, { name: "Cold Foam", options: [{ name: "Vanilla Cold Foam", price: 1 }] }],
    });

    expect(item.modifierGroups[0].options.map((opt) => opt.price)).toEqual([0, 0, 0, 0]);
    expect(item.modifierGroups[1].options[0].price).toBe(1);
  });

  it("leaves milk prices on other drinks unchanged", () => {
    const item = applyIncludedMilkPricing({
      name: "Latte",
      modifierGroups: [milkGroup],
    });
    expect(item.modifierGroups[0].options.find((opt) => opt.name === "Oat Milk").price).toBe(0.8);
  });
});
