/**
 * Built-in recipe ingredients per menu item (required to make the item — not optional add-ons).
 * Keys must match MenuItem.name exactly.
 */
export const RECIPE_INGREDIENTS_BY_MENU_ITEM = {
  // Coffee & Espresso — hot
  Americano: ["Espresso"],
  Cappuccino: ["Espresso", "Whole Milk"],
  Doppio: ["Espresso"],
  Cortado: ["Espresso", "Whole Milk"],
  Lungo: ["Espresso"],
  Espresso: ["Espresso"],
  "Flat White": ["Espresso", "Whole Milk"],
  Latte: ["Espresso", "Whole Milk"],
  Mocha: ["Espresso", "Whole Milk", "Chocolate"],
  "Espresso Macchiato": ["Espresso"],
  "Caramel Macchiato": ["Espresso", "Whole Milk", "Caramel"],
  "Spiced Honey Ritual": [
    "Espresso",
    "Whole Milk",
    "Honey",
    "Vanilla",
    "Cinnamon",
    "Orange Extract",
  ],
  "Hot Chocolate": ["Whole Milk", "Chocolate"],
  "Cafe Au Lait": ["Filtered Coffee", "Whole Milk"],
  "Red Eye": ["Filtered Coffee", "Espresso"],
  "Filtered Coffee": ["Filtered Coffee"],

  // Coffee & Espresso — cold
  "Cold Brew": ["Cold Brew Coffee"],
  "Iced Americano": ["Espresso"],
  "Iced Caramel Macchiato": ["Espresso", "Whole Milk", "Caramel"],
  "Iced Latte": ["Espresso", "Whole Milk"],
  "Iced Flat White": ["Espresso", "Whole Milk"],
  "Iced Mocha Latte": ["Espresso", "Whole Milk", "Chocolate"],
  "B-Berry White Chocolate Bloom": [
    "Espresso",
    "Whole Milk",
    "White Chocolate",
    "Blueberry Puree",
  ],
  "Shaken Ube Meadow": ["Espresso", "Whole Milk", "Ube", "Marshmallow"],
  "Brown Sugar Cinnamon Shaken Espresso": [
    "Espresso",
    "Brown Sugar",
    "Cinnamon",
    "Whole Milk",
  ],
  "Caramel Shaken Espresso": ["Espresso", "Caramel", "Whole Milk"],
  "Tiramisu Cacao Shaken Espresso": [
    "Espresso",
    "Tiramisu",
    "Cacao",
    "Oat Milk",
  ],
  "Iced Cappuccino": ["Espresso", "Whole Milk"],
  "Iced Coffee": ["Filtered Coffee"],
  "Iced Orange Americano": ["Espresso", "Orange Juice"],
  "Shaken Espresso": ["Espresso", "Simple Syrup", "Whole Milk"],
  "Iced Vanilla Latte": ["Espresso", "Whole Milk", "Vanilla"],
  "Iced Honey Vanilla Latte": ["Espresso", "Whole Milk", "Honey", "Vanilla"],
  "Iced Hazelnut Latte": ["Espresso", "Whole Milk", "Hazelnut"],
  "Iced Caramel Latte": ["Espresso", "Whole Milk", "Caramel"],
  "Iced Pumpkin Spice Latte": ["Espresso", "Whole Milk", "Pumpkin Spice"],
  "Iced Ube Vanilla Latte": ["Espresso", "Whole Milk", "Ube", "Vanilla"],
  "Iced Banana Bread Latte": ["Espresso", "Whole Milk", "Banana Bread Syrup"],
  "Shaken Americano": ["Espresso", "Simple Syrup"],
  "Iced Coconut Latte": ["Espresso", "Whole Milk", "Coconut"],
  "Iced Cinnamon Bun Latte": ["Espresso", "Whole Milk", "Cinnamon Bun Syrup"],
  "Iced Cookie Butter Latte": ["Espresso", "Whole Milk", "Cookie Butter"],
  "Orange Honey Shaken Espresso": [
    "Espresso",
    "Orange",
    "Honey",
    "Whole Milk",
  ],
  "Iced Sugar-Free Vanilla Latte": [
    "Espresso",
    "Whole Milk",
    "Sugar-Free Vanilla",
  ],
  "Iced Red Eye": ["Filtered Coffee", "Espresso"],

  // Smoothies
  "Green Glow": [
    "Spinach",
    "Kale",
    "Banana",
    "Avocado",
    "Chia Seeds",
    "Whole Milk",
    "Honey",
  ],
  "Triple B": ["Strawberry", "Blueberry", "Raspberry", "Yogurt", "Whole Milk"],
  "Tropical Bliss": [
    "Mango",
    "Pineapple",
    "Banana",
    "Orange Juice",
    "Coconut",
    "Lime",
  ],
  "Guava Cream": ["Guava", "Strawberry", "Banana", "Yogurt", "Lime"],
  "Berry Mango Tango": [
    "Strawberry",
    "Mango",
    "Vanilla Protein",
    "Yogurt",
    "Honey",
    "Almond Milk",
  ],
  "Power Couple": [
    "Chia Seeds",
    "Vanilla Protein",
    "Avocado",
    "Greek Yogurt",
    "Peanut Butter",
    "Honey",
  ],

  // Wild Bowl — predetermined recipes only (Build Your Own has no fixed ingredients)
  "Wild Vegan": [
    "Chia Seeds Pudding",
    "Granola",
    "Coconut Flakes",
    "Almonds",
    "Dried Cranberries",
    "Peanut Butter",
    "Honey",
    "Strawberries",
    "Bananas",
  ],
  "Signature Bowl": [
    "Chia Seeds Pudding",
    "Yogurt",
    "Granola",
    "Pecans",
    "Sunflower Seeds",
    "Coconut Flakes",
    "Peanut Butter",
    "Honey",
    "Strawberries",
    "Blueberries",
  ],

  // Bakery & Pastries
  "Plain Croissant": ["Croissant Dough", "Butter"],
  "Chocolate Croissant": ["Croissant Dough", "Butter", "Dark Chocolate"],
  "Almond Croissant": ["Croissant Dough", "Butter", "Almond Cream", "Almonds"],
  "Blueberry Muffin": ["Muffin Batter", "Blueberries"],
  "Kouign Amann": ["Pastry Dough", "Butter", "Sugar"],
  Cannele: ["Canele Batter"],
  "Flourless Brownie (Gluten Free)": ["Chocolate", "Eggs", "Butter"],
  "Vegan Muffin": ["Muffin Batter"],
  "Apple Danish": ["Pastry Dough", "Apple", "Cinnamon"],
  "Sweet Lemon Bread": ["Quick Bread Batter", "Lemon"],

  // Tea
  "Assorted Tea": ["Tea"],
  "Iced Unsweetened Tea": ["Iced Tea"],
  "Chai Latte (Hot)": ["Chai", "Whole Milk"],
  "Matcha Latte (Hot)": ["Matcha", "Whole Milk"],
  "London Fog": ["Earl Grey Tea", "Whole Milk", "Vanilla", "Cinnamon"],
  "Iced Chai Latte": ["Chai", "Whole Milk"],
  "Iced Matcha Latte": ["Matcha", "Whole Milk"],
  "Iced Strawberry Matcha Latte": ["Matcha", "Whole Milk", "Strawberry Puree"],
  "Iced Blueberry Matcha Latte": ["Matcha", "Whole Milk", "Blueberry Puree"],
  "Iced Mango Matcha Latte": ["Matcha", "Whole Milk", "Mango Puree"],
  "Ube Matcha Lemonade": ["Lemonade", "Ube", "Matcha", "Whole Milk"],
};

/** All unique canonical ingredient names across the menu. */
export function allRecipeIngredientNames() {
  const names = new Set();
  for (const ingredients of Object.values(RECIPE_INGREDIENTS_BY_MENU_ITEM)) {
    for (const name of ingredients) names.add(name);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

export function recipeIngredientsForMenuItem(name) {
  return RECIPE_INGREDIENTS_BY_MENU_ITEM[name] || [];
}

export function allMenuItemsWithRecipeProfiles() {
  return Object.keys(RECIPE_INGREDIENTS_BY_MENU_ITEM);
}
