import { specialsSeed } from "../seedSpecialsData.js";

function specialByName(name, weekLabel) {
  return specialsSeed.find(
    (item) => item.name === name && (!weekLabel || item.weekLabel === weekLabel),
  );
}

describe("Mint Choco Dream specials", () => {
  it("tops the iced drink with peppermint cold foam, not whipped cream", () => {
    const iced = specialByName("Iced Mint Choco Dream");
    expect(iced).toBeDefined();
    expect(iced.toppings).toContain("Peppermint cold foam");
    expect(iced.toppings).not.toContain("Whipped cream");
    expect(iced.method).toContain("Top with peppermint cold foam");
    expect(iced.method).not.toContain("Top with whipped cream");
  });

  it("keeps whipped cream on the hot drink", () => {
    const hot = specialByName("Mint Choco Dream");
    expect(hot).toBeDefined();
    expect(hot.toppings).toContain("Whipped cream");
    expect(hot.method).toContain("Top with whipped cream");
    expect(hot.toppings).not.toContain("Peppermint cold foam");
  });
});

describe("week of 11/23 specials", () => {
  it("builds Ginger Sugar Shaken Espresso as iced with oat milk splash", () => {
    const drink = specialByName("Ginger Sugar Shaken Espresso", "11/23");
    expect(drink).toBeDefined();
    expect(drink.category).toBe("Coffee");
    expect(drink.build).toEqual([
      { item: "Gingerbread", oz16: "2 pumps", oz20: "2 pumps" },
      { item: "Brown sugar", oz16: "1 pump", oz20: "2 pumps" },
    ]);
    expect(drink.base).toContain("Splash of oat milk");
    expect(drink.toppings).toContain("Light dusting of nutmeg and cinnamon");
  });

  it("builds Amaretto Cookie Cloud Latte with cookie butter foam", () => {
    const drink = specialByName("Amaretto Cookie Cloud Latte", "11/23");
    expect(drink).toBeDefined();
    expect(drink.base).toEqual(["Almond milk", "Ice", "Double shot espresso"]);
    expect(drink.build).toEqual([
      { item: "Amaretto", oz16: "1 pump", oz20: "2 pumps" },
      { item: "Vanilla", oz16: "1 pump", oz20: "1 pump" },
    ]);
    expect(drink.toppings).toContain("Cookie butter cold foam");
    expect(drink.toppings).toContain("Biscoff cookie");
  });

  it("keeps peach cobbler chai hot and iced as separate cards", () => {
    const iced = specialByName("Iced Peach Cobbler Chai", "11/23");
    const hot = specialByName("Peach Cobbler Chai", "11/23");
    expect(iced.toppings).toContain("Peach cold foam");
    expect(iced.toppings).not.toContain("Whipped cream");
    expect(hot.sizeSmall).toBe("12 oz");
    expect(hot.sizeLarge).toBe("16 oz");
    expect(hot.toppings).toContain("Whipped cream");
    expect(hot.build).toEqual(
      expect.arrayContaining([{ item: "Peach", oz16: "1 pump", oz20: "2 pumps" }]),
    );
  });
});

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
