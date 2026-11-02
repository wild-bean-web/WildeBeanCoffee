import { modifierGroups } from "../seedModifierGroups.js";
import { menuItemsFromCSV } from "../seedMenuItemsFromCSV.js";

describe("Catering coffee traveler seed", () => {
  const milk = () => modifierGroups.find((g) => g.name === "Catering Milk");
  const supplies = () =>
    modifierGroups.find((g) => g.name === "Included Supplies");
  const traveler = () =>
    menuItemsFromCSV.find(
      (i) => i.name === "HOT Drip Coffee Traveler (Serves 10)",
    );

  it("defines Catering Milk as required multiple 1–2 with $0 options", () => {
    expect(milk()).toMatchObject({
      type: "multiple",
      required: true,
      minSelections: 1,
      maxSelections: 2,
    });
    expect(milk().options.map((o) => o.name)).toEqual([
      "2% Milk",
      "Whole Milk",
      "Half and Half",
      "Skim Milk",
      "No Milk",
    ]);
    expect(milk().options.every((o) => o.price === 0 && o.available)).toBe(
      true,
    );
  });

  it("defines Included Supplies as required single with one $0 option", () => {
    expect(supplies()).toMatchObject({
      type: "single",
      required: true,
      minSelections: 1,
      maxSelections: 1,
    });
    expect(supplies().options).toEqual([
      {
        name: "Sugar, Sweeteners, Stirrers & Napkins",
        price: 0,
        available: true,
      },
    ]);
  });

  it("defines the traveler item in Catering at $29.99 with Dairy and linked groups", () => {
    expect(traveler()).toMatchObject({
      section: "Catering",
      price: 29.99,
      currency: "USD",
      allergens: ["Dairy"],
      image: "/images/menu/Coffee/RegularCoffee.png",
      available: true,
      active: true,
      modifierGroupNames: ["Catering Milk", "Included Supplies"],
    });
    expect(traveler().onlineOrderable).not.toBe(false);
    expect(traveler().description).toBe(
      "96 oz drip coffee traveler (serves 10). Each traveler includes 10 cups with lids, sugar and sweetener packets, stirrers, napkins, and milk — pick 1–2 milk options below. Ordering more than one traveler? Each one comes with its own set of cups and supplies.",
    );
  });

  it("does not rename or remove Build Your Own Bowl groups", () => {
    expect(modifierGroups.some((g) => g.name === "Base")).toBe(true);
    expect(
      menuItemsFromCSV.find((i) => i.name === "Build Your Own Bowl")
        ?.modifierGroupNames,
    ).toEqual([
      "Base",
      "Bowl Size",
      "Toppings (Build Your Own)",
      "Drizzels",
      "Fruit Toppings (Build Your Own)",
      "Extra Add-Ons",
    ]);
  });

  it("exposes exactly the sync target names for catering", () => {
    const cateringGroups = modifierGroups.filter((g) =>
      ["Catering Milk", "Included Supplies"].includes(g.name),
    );
    expect(cateringGroups).toHaveLength(2);
    expect(
      menuItemsFromCSV.filter((i) => i.section === "Catering"),
    ).toHaveLength(1);
  });
});
