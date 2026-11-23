import { specialsSeed } from "../seedSpecialsData.js";

function specialByName(name, weekLabel) {
  return specialsSeed.find(
    (item) => item.name === name && (!weekLabel || item.weekLabel === weekLabel),
  );
}

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
