/**
 * Drinks whose recipe already includes alternative milk.
 * Every milk option on these drinks is $0. Other drinks keep the shared Milk Choice prices.
 */
export const INCLUDED_MILK_GROUP_NAME = "Milk Choice (Included)";

export const INCLUDED_MILK_DRINK_NAMES = new Set([
  "Tiramisu Cacao Shaken Espresso",
  "Tiramisu Shaken Espresso",
]);

export const INCLUDED_MILK_OPTIONS = [
  { name: "Whole Milk", price: 0, available: true },
  { name: "2% Milk", price: 0, available: true },
  { name: "Skim Milk", price: 0, available: true },
  { name: "half & half", price: 0, available: true },
  { name: "No Milk", price: 0, available: true },
  { name: "Heavy Cream", price: 0, available: true },
  { name: "Oat Milk", price: 0, available: true },
  { name: "Soy Milk", price: 0, available: true },
  { name: "Almond Milk", price: 0, available: true },
];

export function menuItemIncludesMilk(name) {
  return typeof name === "string" && INCLUDED_MILK_DRINK_NAMES.has(name.trim());
}

export function applyIncludedMilkPricing(item) {
  if (!item || !menuItemIncludesMilk(item.name) || !item.modifierGroups?.length) {
    return item;
  }
  return {
    ...item,
    modifierGroups: item.modifierGroups.map((group) => {
      const name = group?.name || "";
      if (!name.startsWith("Milk Choice")) return group;
      return {
        ...group,
        options: (group.options || []).map((opt) => ({ ...opt, price: 0 })),
      };
    }),
  };
}
