import { formatKitchenDrinkName } from "@/lib/kitchenDrinkLabel";

describe("formatKitchenDrinkName", () => {
  it("prefixes hot coffee drinks", () => {
    expect(formatKitchenDrinkName("Latte")).toBe("(HOT) Latte");
    expect(formatKitchenDrinkName("Americano")).toBe("(HOT) Americano");
    expect(formatKitchenDrinkName("Filtered Coffee")).toBe("(HOT) Filtered Coffee");
  });

  it("replaces a leading Iced with the iced prefix", () => {
    expect(formatKitchenDrinkName("Iced Cookie Butter Latte")).toBe(
      "(ICED) Cookie Butter Latte",
    );
    expect(formatKitchenDrinkName("Iced Latte")).toBe("(ICED) Latte");
    expect(formatKitchenDrinkName("Iced Orange Americano")).toBe(
      "(ICED) Orange Americano",
    );
  });

  it("prefixes iced coffee drinks that do not already say Iced", () => {
    expect(formatKitchenDrinkName("Shaken Espresso")).toBe("(ICED) Shaken Espresso");
    expect(formatKitchenDrinkName("Tiramisu Cacao Shaken Espresso")).toBe(
      "(ICED) Tiramisu Cacao Shaken Espresso",
    );
    expect(formatKitchenDrinkName("Cold Brew")).toBe("(ICED) Cold Brew");
    expect(formatKitchenDrinkName("B-Berry White Chocolate Bloom")).toBe(
      "(ICED) B-Berry White Chocolate Bloom",
    );
  });

  it("leaves tea, matcha, chai, smoothies, and food alone", () => {
    expect(formatKitchenDrinkName("Iced Chai Latte")).toBe("Iced Chai Latte");
    expect(formatKitchenDrinkName("Iced Matcha Latte")).toBe("Iced Matcha Latte");
    expect(formatKitchenDrinkName("Chai Latte (Hot)")).toBe("Chai Latte (Hot)");
    expect(formatKitchenDrinkName("Green Glow")).toBe("Green Glow");
    expect(formatKitchenDrinkName("Signature Bowl")).toBe("Signature Bowl");
  });

  it("does not double-prefix a name that is already labeled", () => {
    expect(formatKitchenDrinkName("(HOT) Latte")).toBe("(HOT) Latte");
    expect(formatKitchenDrinkName("(ICED) Cookie Butter Latte")).toBe(
      "(ICED) Cookie Butter Latte",
    );
  });
});
