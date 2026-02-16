import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { Product, MenuItem, Location, ModifierGroup } from "./models/index.js";
import { modifierGroups } from "./seedModifierGroups.js";
import { menuItemsFromCSV } from "./seedMenuItemsFromCSV.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Check if we're seeding the test database
const isTestSeed =
  process.argv.includes("--test") || process.env.NODE_ENV === "test";

if (isTestSeed) {
  // Load .env.test for test database seeding
  dotenv.config({ path: join(__dirname, ".env.test") });
}

// Also load regular .env as fallback
dotenv.config({ path: join(__dirname, ".env") });

// Use test URI if seeding test database, otherwise use production URI
const mongoUri = isTestSeed
  ? process.env.MONGODB_TEST_URI || process.env.MONGODB_URI
  : process.env.MONGODB_URI;

const products = [
  {
    name: "Ethiopia Yirgacheffe",
    description:
      "Floral, citrus, and tea-like with bright acidity. A classic Ethiopian coffee with delicate notes.",
    price: 16.5,
    currency: "USD",
    roastLevel: "Light",
    origin: "Ethiopia",
    flavorNotes: ["Bergamot", "Jasmine", "Lemon", "Tea-like"],
    inStock: true,
    inventory: 40,
    images: ["/images/products/single-origin/ethiopia-yirgacheffe.jpeg"],
    categories: ["single-origin", "light-roast"],
    active: true,
    comingSoon: true,
  },
  {
    name: "Ethiopia Sedamo",
    description:
      "Rich and full-bodied with wine-like acidity and fruity notes. A distinctive Ethiopian coffee.",
    price: 17.0,
    currency: "USD",
    roastLevel: "Medium",
    origin: "Ethiopia",
    flavorNotes: ["Wine", "Berry", "Citrus", "Floral"],
    inStock: true,
    inventory: 35,
    images: ["/images/products/single-origin/ethiopia-sedamo.jpeg"],
    categories: ["single-origin", "medium-roast"],
    active: true,
    comingSoon: true,
  },
];

// Menu items are now imported from seedMenuItemsFromCSV.js
// Old menuItems array commented out - using CSV data instead
/*
const menuItems = [
  // Coffee & Espresso
  {
    name: "Regular Coffee",
    description: "Freshly Brewed Coffee",
    price: 3.89,
    currency: "USD",
    section: "Coffee & Espresso",
    tags: ["hot", "coffee"],
    allergens: [],
    image: "/images/menu/Coffee/RegularCoffee.jpeg",
    available: true,
    active: true,
  },
  {
    name: "Latte",
    description: "Espresso With Steamed Milk and Foam",
    price: 4.89,
    currency: "USD",
    section: "Coffee & Espresso",
    tags: ["hot", "espresso", "milk"],
    allergens: ["Dairy"],
    image: "/images/menu/Coffee/Latte.png",
    available: true,
    active: true,
  },
  {
    name: "Cappuccino",
    description: "Espresso, Foamed Milk, Light and Airy",
    price: 4.99,
    currency: "USD",
    section: "Coffee & Espresso",
    tags: ["hot", "espresso", "foam"],
    allergens: ["Dairy"],
    image: "/images/menu/Coffee/Cappuccino.png",
    available: true,
    active: true,
  },
  {
    name: "Mocha",
    description: "Espresso, Chocolate and Steamed Milk",
    price: 5.25,
    currency: "USD",
    section: "Coffee & Espresso",
    tags: ["hot", "espresso", "chocolate"],
    allergens: ["Dairy"],
    image: "/images/menu/Coffee/Mocha.png",
    available: true,
    active: true,
  },
  {
    name: "Frappuccino",
    description: "Blended Espresso, Milk, And Ice",
    price: 5.75,
    currency: "USD",
    section: "Coffee & Espresso",
    tags: ["blended", "espresso", "cold"],
    allergens: ["Dairy"],
    image: "/images/menu/Coffee/Frappuccino.png",
    available: true,
    active: true,
  },
  // Smoothies (Organic & Fresh)
  {
    name: "Green Glow",
    description:
      "Spinach, Kale, Banana, Avocado, Chia Seeds, Almond Milk, Honey, Lime Juice",
    price: 8.75,
    currency: "USD",
    section: "Smoothies (Organic & Fresh)",
    tags: ["smoothie", "organic", "fresh", "green", "vegan-option"],
    allergens: ["Tree Nuts"],
    image: "/images/menu/Smoothies/GreenGlowLand.png",
    available: true,
    active: true,
  },
  {
    name: "Berry Boost",
    description:
      "Frozen Blueberries, Frozen Raspberries, Fresh Strawberries, Vanilla Yogurt, Almond Milk, Honey",
    price: 8.95,
    currency: "USD",
    section: "Smoothies (Organic & Fresh)",
    tags: ["smoothie", "organic", "fresh", "berry"],
    allergens: ["Dairy", "Tree Nuts"],
    image: "/images/menu/Smoothies/BerryBoostLand.png",
    available: true,
    active: true,
  },
  {
    name: "Tropical Bliss",
    description:
      "Frozen Mango, Frozen Pineapple, Banana, Coconut Water, Orange Juice, Lime Juice",
    price: 7.95,
    currency: "USD",
    section: "Smoothies (Organic & Fresh)",
    tags: ["smoothie", "organic", "fresh", "tropical"],
    allergens: [],
    image: "/images/menu/Smoothies/TropicalBlissLand.png",
    available: true,
    active: true,
  },
  {
    name: "Nutty Banana Bliss",
    description:
      "Banana, Peanut Butter, Chia Seeds, Almonds, Cinnamon, Milk or Oat Milk, Honey",
    price: 8.25,
    currency: "USD",
    section: "Smoothies (Organic & Fresh)",
    tags: ["smoothie", "organic", "fresh", "nutty"],
    allergens: ["Peanuts", "Tree Nuts", "Dairy"],
    image: "/images/menu/Smoothies/NuttyBananaBlissLand.png",
    available: true,
    active: true,
  },
  {
    name: "Espresso Energy",
    description:
      "Espresso, Oat Milk, Vanilla Yogurt, Cocoa Powder, Cinnamon, Honey (Served Over Ice)",
    price: 7.75,
    currency: "USD",
    section: "Smoothies (Organic & Fresh)",
    tags: ["smoothie", "organic", "fresh", "espresso", "energy"],
    allergens: ["Dairy"],
    image: "/images/menu/Smoothies/EspressoEnergyLand.png",
    available: true,
    active: true,
  },
  {
    name: "Guava Cream Smoothie",
    description:
      "Goya Guava Nectar, Plain Non-Fat Yogurt, Almond Milk or Oat Milk, Avocado, Fresh Lime Juice, Blended with Ice",
    price: 8.5,
    currency: "USD",
    section: "Smoothies (Organic & Fresh)",
    tags: ["smoothie", "organic", "fresh", "tropical", "guava"],
    allergens: ["Dairy", "Tree Nuts"],
    image: "/images/menu/Smoothies/GuavaCreamLand.png",
    available: true,
    active: true,
  },
  // Oatmeals
  {
    name: "Protein Packed Oatmeal",
    description:
      "Cooked Oatmeal, Chia pudding, Yogurt, Strawberries, Blueberries, Banana, Peanut Butter",
    price: 8.95,
    currency: "USD",
    section: "Oatmeals",
    tags: ["oatmeal", "protein", "healthy", "breakfast"],
    allergens: ["Dairy", "Peanuts"],
    image: "/images/menu/Oatmeals/PowerBreakfastOatmeal.png",
    available: true,
    active: true,
  },
  {
    name: "Tropical Flavor Oatmeal",
    description:
      "Cooked Oatmeal, Chia pudding, Yogurt, Raspberries, Blueberries, Granola, Coconut Flakes",
    price: 7.95,
    currency: "USD",
    section: "Oatmeals",
    tags: ["oatmeal", "tropical", "healthy", "breakfast"],
    allergens: ["Dairy", "Coconut", "Gluten"],
    image: "/images/menu/Oatmeals/TropicalFlavor.png",
    available: true,
    active: true,
  },
  {
    name: "Nutty Harvest Oatmeal",
    description:
      "Cooked Oatmeal, Chia pudding, Yogurt, Pecans, Walnuts, Dried Cranberries, Coconut Flakes",
    price: 8.5,
    currency: "USD",
    section: "Oatmeals",
    tags: ["oatmeal", "nuts", "harvest", "healthy", "breakfast"],
    allergens: ["Dairy", "Tree Nuts", "Coconut"],
    image: "/images/menu/Oatmeals/NuttyHarvest.png",
    available: true,
    active: true,
  },
  {
    name: "Nut Free Oatmeal",
    description:
      "Cooked Oatmeal, Chia pudding, Vanilla Yogurt, Raisins, Sunflower Seeds, Coconut Flakes, Banana",
    price: 7.5,
    currency: "USD",
    section: "Oatmeals",
    tags: ["oatmeal", "nut-free", "healthy", "breakfast"],
    allergens: ["Dairy", "Coconut"],
    image: "/images/menu/Oatmeals/NutFree.png",
    available: true,
    active: true,
  },
  // Bakery & Pastries
  {
    name: "Croissant",
    description: "Flaky, Buttery, and Banked Fresh Daily",
    price: 5.5,
    currency: "USD",
    section: "Bakery & Pastries",
    tags: ["bakery", "pastry", "fresh"],
    allergens: ["Gluten", "Eggs", "Dairy"],
    image: "/images/menu/Bakery/Croissant.jpeg",
    available: true,
    active: true,
  },
  {
    name: "Muffin",
    description: "Choice of blueberry, Banana nut, or Chocolate chip",
    price: 5.5,
    currency: "USD",
    section: "Bakery & Pastries",
    tags: ["bakery", "muffin"],
    allergens: ["Gluten", "Eggs", "Dairy", "Nuts"],
    image: "/images/menu/Bakery/Muffin.jpeg",
    available: true,
    active: true,
  },
  {
    name: "Danish",
    description: "Assorted fruit or cream cheese filling",
    price: 5.5,
    currency: "USD",
    section: "Bakery & Pastries",
    tags: ["bakery", "pastry", "danish"],
    allergens: ["Gluten", "Eggs", "Dairy"],
    image: "/images/menu/Bakery/Danish.jpg",
    available: true,
    active: true,
  },
  {
    name: "Bagel TEST TEST TEST",
    description: "Plain, everything, or Cinnamon raisin",
    price: 0.01,
    currency: "USD",
    section: "Bakery & Pastries",
    tags: ["bakery", "bagel", "cream-cheese"],
    allergens: ["Gluten", "Dairy"],
    image: "/images/menu/Bakery/BagelWCreamCheese.jpeg",
    available: true,
    active: true,
  },
  {
    name: "Bagel with Cream Cheese",
    description: "Plain, everything, or Cinnamon raisin",
    price: 4.5,
    currency: "USD",
    section: "Bakery & Pastries",
    tags: ["bakery", "bagel", "cream-cheese"],
    allergens: ["Gluten", "Dairy"],
    image: "/images/menu/Bakery/BagelWCreamCheese.jpeg",
    available: true,
    active: true,
  },
  // Tea
  {
    name: "Chai Latte",
    description: "Spiced Black tea with steamed milk",
    price: 5.99,
    currency: "USD",
    section: "Tea",
    tags: ["hot", "tea", "spiced"],
    allergens: ["Dairy"],
    image: "/images/menu/Favorites/ChaiLatte.png",
    available: true,
    active: true,
  },
  {
    name: "Iced Matcha Tea",
    description: "Premium Matcha Powder, Oat Milk, Honey, Served Over Ice",
    price: 6.49,
    currency: "USD",
    section: "Tea",
    tags: ["iced", "tea", "matcha", "healthy"],
    allergens: [],
    image: "/images/menu/Favorites/IcedMatchaTea.jpg",
    available: true,
    active: true,
  },
];
*/

const locations = [
  {
    name: "Wild Bean Coffee",
    address1: "1532 Rockville Pike",
    city: "Rockville",
    state: "MD",
    postalCode: "20852",
    country: "US",
    coordinates: { lat: 39.0629, lng: -77.1291 },
    phone: "+1 240-646-6503",
    email: "wildbeancoffeellc@gmail.com",
    mapsUrl: "",
    hours: [
      { day: "Monday", opens: "06:00", closes: "16:00" },
      { day: "Tuesday", opens: "06:00", closes: "16:00" },
      { day: "Wednesday", opens: "06:00", closes: "16:00" },
      { day: "Thursday", opens: "06:00", closes: "16:00" },
      { day: "Friday", opens: "06:00", closes: "16:00" },
      { day: "Saturday", opens: "06:00", closes: "16:00" },
      { day: "Sunday", opens: "06:00", closes: "16:00" },
    ],
    active: true,
  },
];

async function seed() {
  if (!mongoUri) {
    const envVar = isTestSeed ? "MONGODB_TEST_URI" : "MONGODB_URI";
    throw new Error(`${envVar} not set`);
  }

  await mongoose.connect(mongoUri);
  const dbName = mongoose.connection.db.databaseName;
  console.log(`Connected to MongoDB for seeding (database: ${dbName})`);

  await Product.deleteMany({});
  await MenuItem.deleteMany({});
  await Location.deleteMany({});
  await ModifierGroup.deleteMany({});

  // Seed modifier groups first
  const createdModifierGroups = await ModifierGroup.insertMany(modifierGroups);
  console.log(`Seeded ${createdModifierGroups.length} modifier groups`);

  // Create a map of modifier group names to IDs
  const modifierGroupMap = {};
  createdModifierGroups.forEach((group) => {
    modifierGroupMap[group.name] = group._id;
  });

  // Map modifier group names to IDs for menu items (oatmeal is build-your-own only; no dynamic Remove Ingredients)
  const menuItemsWithModifierIds = menuItemsFromCSV.map((item) => {
    const modifierGroupIds = (item.modifierGroupNames || [])
      .map((name) => modifierGroupMap[name])
      .filter((id) => id !== undefined);

    const { modifierGroupNames, ...itemData } = item;
    return {
      ...itemData,
      modifierGroups: modifierGroupIds,
    };
  });

  const createdProducts = await Product.insertMany(products);
  const createdMenuItems = await MenuItem.insertMany(menuItemsWithModifierIds);
  const createdLocations = await Location.insertMany(locations);

  console.log(`Seeded ${createdProducts.length} products`);
  console.log(`Seeded ${createdMenuItems.length} menu items`);
  console.log(`Seeded ${createdLocations.length} locations`);

  await mongoose.connection.close();
  console.log("Seeding complete. Connection closed.");
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
