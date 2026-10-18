/**
 * Kitchen ticket labels for coffee drinks.
 * Hot drinks are prefixed with (HOT). Iced drinks are prefixed with (ICED).
 * A leading "Iced " is replaced by that prefix so tickets do not say "Iced" twice.
 * Tea, matcha, chai, smoothies, and food keep their menu names.
 */

const HOT_COFFEE = new Set([
  "Americano",
  "Cappuccino",
  "Doppio",
  "Cortado",
  "Lungo",
  "Espresso",
  "Flat White",
  "Latte",
  "Mocha",
  "Espresso Macchiato",
  "Caramel Macchiato",
  "Spiced Honey Ritual",
  "Hot Chocolate",
  "Cafe Au Lait",
  "Red Eye",
  "Filtered Coffee",
]);

const ICED_COFFEE = new Set([
  "Cold Brew",
  "Iced Americano",
  "Iced Caramel Macchiato",
  "Iced Latte",
  "Iced Flat White",
  "Iced Mocha Latte",
  "B-Berry White Chocolate Bloom",
  "Shaken Ube Meadow",
  "Brown Sugar Cinnamon Shaken Espresso",
  "Caramel Shaken Espresso",
  "Tiramisu Cacao Shaken Espresso",
  "Tiramisu Shaken Espresso",
  "Iced Cappuccino",
  "Iced Coffee",
  "Iced Orange Americano",
  "Shaken Espresso",
  "Iced Vanilla Latte",
  "Iced Honey Vanilla Latte",
  "Iced Hazelnut Latte",
  "Iced Caramel Latte",
  "Iced Pumpkin Spice Latte",
  "Iced Ube Vanilla Latte",
  "Iced Banana Bread Latte",
  "Shaken Americano",
  "Iced Coconut Latte",
  "Iced Cinnamon Bun Latte",
  "Iced Cookie Butter Latte",
  "Orange Honey Shaken Espresso",
  "Iced Sugar-Free Vanilla Latte",
  "Iced Red Eye",
]);

function isNonCoffeeDrink(name) {
  return /chai|matcha|tea|lemonade|smoothie/i.test(name);
}

function looksLikeIcedCoffee(name) {
  if (isNonCoffeeDrink(name)) return false;
  if (/cold brew|shaken espresso|shaken americano/i.test(name)) return true;
  if (!/^iced\s+/i.test(name)) return false;
  return /latte|americano|mocha|macchiato|coffee|cappuccino|espresso|cortado|flat white|red eye/i.test(
    name,
  );
}

export function formatKitchenDrinkName(name) {
  if (typeof name !== "string") return "";
  const trimmed = name.trim();
  if (!trimmed || /^\((HOT|ICED)\)\s/i.test(trimmed)) return trimmed;

  const iced = ICED_COFFEE.has(trimmed) || looksLikeIcedCoffee(trimmed);
  const hot = !iced && HOT_COFFEE.has(trimmed);
  if (!iced && !hot) return trimmed;

  if (iced) {
    const withoutIcedPrefix = trimmed.replace(/^iced\s+/i, "");
    return `(ICED) ${withoutIcedPrefix}`;
  }
  return `(HOT) ${trimmed}`;
}

export function formatKitchenModifierGroupName(rawGroupName) {
  if (rawGroupName === "Milk Choice (Included)") return "Milk Choice";
  return null;
}
