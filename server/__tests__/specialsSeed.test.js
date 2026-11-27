import { specialsSeed } from "../seedSpecialsData.js";

function specialByName(name) {
  return specialsSeed.find((item) => item.name === name);
}

describe("Irish White Chocolate Latte", () => {
  it("uses 3 / 4 pumps Irish cream and cacao garnish", () => {
    const drink = specialByName("Irish White Chocolate Latte");
    expect(drink).toBeDefined();
    expect(drink.build).toEqual([
      { item: "Irish cream", oz16: "3 pumps", oz20: "4 pumps" },
    ]);
    expect(drink.toppings).toContain("Cacao powder");
    expect(drink.method).toContain("Garnish with cacao powder");
  });
});
