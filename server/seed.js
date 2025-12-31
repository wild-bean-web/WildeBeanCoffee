import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { Product, MenuItem, Location } from "./models/index.js";

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
  },
];

const menuItems = [
  // Coffee & Espresso
  {
    name: "Regular Coffee",
    description: "Freshly Brewed Arabica Blend",
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
    image: "/images/menu/Coffee/Latte.jpg",
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
    image: "/images/menu/Coffee/Cappuccino.jpg",
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
    name: "Iced Coffee",
    description: "Chilled Coffee Served Over Ice",
    price: 4.25,
    currency: "USD",
    section: "Coffee & Espresso",
    tags: ["iced", "coffee", "cold"],
    allergens: [],
    image: "/images/menu/Coffee/IcedCoffee.jpg",
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
    image: "/images/menu/Coffee/Frappuccino.jpg",
    available: true,
    active: true,
  },
  // Other Favorites
  {
    name: "Hot Chocolate",
    description: "Creamy Cocoa topped with whipped cream",
    price: 5.99,
    currency: "USD",
    section: "Other Favorites",
    tags: ["hot", "chocolate"],
    allergens: ["Dairy"],
    image: "/images/menu/Favorites/HotChocolate.jpg",
    available: true,
    active: true,
  },
  {
    name: "Chai Latte",
    description: "Spiced Black tea with steamed milk",
    price: 5.99,
    currency: "USD",
    section: "Other Favorites",
    tags: ["hot", "tea", "spiced"],
    allergens: ["Dairy"],
    image: "/images/menu/Favorites/ChaiLatte.jpg",
    available: true,
    active: true,
  },
  {
    name: "Iced Tea",
    description: "Freshly Brewed and chilled",
    price: 5.99,
    currency: "USD",
    section: "Other Favorites",
    tags: ["iced", "tea", "cold"],
    allergens: [],
    image: "/images/menu/Favorites/IcedTea.jpg",
    available: true,
    active: true,
  },
  {
    name: "Fresh Juice",
    description: "Orange. Apple, or Mixed Fruit",
    price: 5.99,
    currency: "USD",
    section: "Other Favorites",
    tags: ["juice", "fresh", "cold"],
    allergens: [],
    image: "/images/menu/Favorites/FreshJuice.jpg",
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
  // Smoothies (Organic & Fresh)
  {
    name: "Tropical Bliss",
    description: "Mango, Pineapple, Banana, Orange Juice",
    price: 9.89,
    currency: "USD",
    section: "Smoothies (Organic & Fresh)",
    tags: ["smoothie", "organic", "fresh", "tropical"],
    allergens: [],
    image: "/images/menu/Smoothies/TropicalBliss.jpeg",
    available: true,
    active: true,
  },
  {
    name: "Berry Boost",
    description: "Strawberry, Blueberry, Raspberry, Yogurt",
    price: 9.89,
    currency: "USD",
    section: "Smoothies (Organic & Fresh)",
    tags: ["smoothie", "organic", "fresh", "berry"],
    allergens: ["Dairy"],
    image: "/images/menu/Smoothies/BerryBoost.jpeg",
    available: true,
    active: true,
  },
  {
    name: "Green Glow",
    description: "Spinach, Kale, Apple, Banana, Coconut Water",
    price: 9.89,
    currency: "USD",
    section: "Smoothies (Organic & Fresh)",
    tags: ["smoothie", "organic", "fresh", "green"],
    allergens: [],
    image: "/images/menu/Smoothies/GreenGlow.jpeg",
    available: true,
    active: true,
  },
  {
    name: "Signature",
    description: "Avocado, Spinach & Banana",
    price: 9.89,
    currency: "USD",
    section: "Smoothies (Organic & Fresh)",
    tags: ["smoothie", "organic", "fresh", "signature"],
    allergens: [],
    image: "/images/menu/Smoothies/Signature.jpeg",
    available: true,
    active: true,
  },
];

const locations = [
  {
    name: "Wild Bean Coffee",
    address1: "1532 Rockville Pike",
    city: "Rockville",
    state: "MD",
    postalCode: "20852",
    country: "US",
    coordinates: { lat: 39.0629, lng: -77.1291 },
    phone: "555-555-1234",
    email: "wildbeancoffeellc@gmail.com",
    mapsUrl: "",
    hours: [
      { day: "Monday", opens: "06:00", closes: "19:00" },
      { day: "Tuesday", opens: "06:00", closes: "19:00" },
      { day: "Wednesday", opens: "06:00", closes: "19:00" },
      { day: "Thursday", opens: "06:00", closes: "19:00" },
      { day: "Friday", opens: "06:00", closes: "19:00" },
      { day: "Saturday", opens: "06:00", closes: "19:00" },
      { day: "Sunday", opens: "06:00", closes: "19:00" },
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

  const createdProducts = await Product.insertMany(products);
  const createdMenuItems = await MenuItem.insertMany(menuItems);
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
