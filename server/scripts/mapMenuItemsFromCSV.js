/**
 * Script to map menu items from Clover CSV export
 * - Updates menu item names, descriptions, and prices to match CSV
 * - Assigns modifier groups based on CSV data
 * - Maps sections correctly
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync } from "fs";
import { MenuItem, ModifierGroup } from "../models/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, "../.env") });

const mongoUri = process.env.MONGODB_URI;

// Section mapping from CSV categories to our sections
const sectionMapping = {
  "Espresso Bar": "Coffee & Espresso",
  "Cold Coffee": "Coffee & Espresso",
  "Filtered Coffee": "Coffee & Espresso",
  "Smoothies": "Smoothies (Organic & Fresh)",
  "Oatmeal Bar": "Oatmeals",
  "Pastries": "Bakery & Pastries",
  "Tea": "Tea",
};

// Name mappings for items that don't match exactly
const nameMappings = {
  "Protein Packed Oatmeal": "Power Breakfast Oatmeal",
  "Tropical Flavor Oatmeal": "Tropical Berry Crunch",
  "Iced Matcha Tea": "Iced Matcha Latte",
  "Chai Latte": "Chai Latte (Hot)",
  "Matcha Latte": "Matcha Latte (Hot)",
  "Regular Coffee": "Filtered Coffee", // Check if this is correct
};

// Parse CSV data (simplified - assumes CSV is already parsed)
function parseCSVData() {
  // This is a simplified parser - in production you'd use a proper CSV parser
  // For now, we'll manually define the mapping based on the CSV structure
  
  const csvData = [
    {
      name: "Americano",
      alternateName: "Hot Americano",
      description: "Espresso shot filled with hot water for a smooth finish.",
      price: 3.60,
      section: "Espresso Bar",
      modifierGroups: ["Shot Preference", "Cup Size", "Cup Size (12-16)", "Extra Single Shots (Hot)"],
      allergens: [],
    },
    {
      name: "B-Berry Muffin",
      description: "Soft muffin packed with mixed berries.",
      price: 3.65,
      section: "Pastries",
      modifierGroups: [],
      allergens: [],
    },
    {
      name: "Banana B-B Bread",
      description: "Moist banana bread with berry notes.",
      price: 3.75,
      section: "Pastries",
      modifierGroups: [],
      allergens: [],
    },
    {
      name: "Assorted Tea",
      description: "Choose from an assortion of teas",
      price: 3.25,
      section: "Tea",
      modifierGroups: [],
      allergens: [],
    },
    {
      name: "Cappuccino",
      alternateName: "Hot Cappuccino",
      description: "Espresso with equal parts steamed milk and foam.",
      price: 4.55,
      section: "Espresso Bar",
      modifierGroups: ["Shot Preference", "Cup Size", "Syrup Pumps (+$0.20 each)", "Coffee Toppings", "Cup Size (12-16)", "Extra Single Shots (Hot)", "Milk Choice"],
      allergens: ["Dairy"],
    },
    {
      name: "Chai Latte (Hot)",
      description: "Spiced chai blended with steamed milk.",
      price: 5.25,
      section: "Tea",
      modifierGroups: ["Syrup Pumps (+$0.20 each)", "Cup Size (12-16)", "Milk Choice"],
      allergens: [],
    },
    {
      name: "Cheese Danish",
      description: "Flaky pastry filled with sweet cream cheese.",
      price: 3.95,
      section: "Pastries",
      modifierGroups: [],
      allergens: [],
    },
    {
      name: "Cold Brew",
      description: "Slow-steeped cold brew for a smooth, rich taste.",
      price: 3.85,
      section: "Cold Coffee",
      modifierGroups: [],
      allergens: [],
    },
    {
      name: "Doppio",
      alternateName: "Double Shot",
      description: "A bold double shot of espresso.",
      price: 3.05,
      section: "Espresso Bar",
      modifierGroups: [],
      allergens: [],
    },
    {
      name: "Espresso",
      alternateName: "Single Shot",
      description: "1 oz espresso shot made with freshly roasted beans.",
      price: 2.85,
      section: "Espresso Bar",
      modifierGroups: ["Shot Preference", "Extra Single Shots (Hot)"],
      allergens: [],
    },
    {
      name: "Flat White",
      description: "Espresso with velvety, lightly textured milk.",
      price: 5.10,
      section: "Espresso Bar",
      modifierGroups: ["Shot Preference", "Cup Size", "Syrup Pumps (+$0.20 each)", "Coffee Toppings", "Cup Size (12-16)", "Extra Single Shots (Hot)", "Milk Choice"],
      allergens: ["Dairy"],
    },
    {
      name: "Matcha Latte (Hot)",
      description: "Matcha blended with steamed milk",
      price: 5.25,
      section: "Tea",
      modifierGroups: ["Syrup Pumps (+$0.20 each)", "Cup Size (12-16)", "Milk Choice"],
      allergens: [],
    },
    {
      name: "Iced Americano",
      description: "Espresso and cold water served over ice.",
      price: 3.95,
      section: "Cold Coffee",
      modifierGroups: ["Shot Preference", "Cup Size", "Cup Size (16-20)", "Ice Level", "Extra Single Shots (Iced)"],
      allergens: [],
    },
    {
      name: "Iced Cappuccino",
      description: "Chilled espresso with milk and foam over ice.",
      price: 4.85,
      section: "Cold Coffee",
      modifierGroups: ["Shot Preference", "Cup Size", "Cup Size (16-20)", "Syrup Pumps (+$0.20 each)", "Coffee Toppings", "Ice Level", "Milk Choice", "Extra Single Shots (Iced)"],
      allergens: ["Dairy"],
    },
    {
      name: "Iced Latte",
      description: "Espresso with cold milk poured over ice.",
      price: 4.65,
      section: "Cold Coffee",
      modifierGroups: ["Shot Preference", "Cup Size", "Cup Size (16-20)", "Syrup Pumps (+$0.20 each)", "Coffee Toppings", "Ice Level", "Milk Choice", "Extra Single Shots (Iced)"],
      allergens: ["Dairy"],
    },
    {
      name: "Iced Coffee",
      description: "Freshly brewed coffee served over ice.",
      price: 3.65,
      section: "Cold Coffee",
      modifierGroups: [],
      allergens: [],
    },
    {
      name: "Iced Caramel Macchiato",
      description: "Layered espresso and milk served over ice.",
      price: 5.60,
      section: "Cold Coffee",
      modifierGroups: ["Shot Preference", "Cup Size", "Cup Size (16-20)", "Syrup Pumps (+$0.20 each)", "Coffee Toppings", "Ice Level", "Milk Choice", "Extra Single Shots (Iced)"],
      allergens: ["Dairy"],
    },
    {
      name: "Iced Tea",
      description: "Chilled brewed tea served over ice.",
      price: 3.95,
      section: "Tea",
      modifierGroups: [],
      allergens: [],
    },
    {
      name: "Latte",
      alternateName: "Hot Latte",
      description: "Espresso with steamed milk and a light milk crema.",
      price: 4.55,
      section: "Espresso Bar",
      modifierGroups: ["Shot Preference", "Cup Size", "Syrup Pumps (+$0.20 each)", "Coffee Toppings", "Cup Size (12-16)", "Extra Single Shots (Hot)", "Milk Choice"],
      allergens: ["Dairy"],
    },
    {
      name: "Mocha",
      description: "Espresso blended with chocolate and steamed milk.",
      price: 5.15,
      section: "Espresso Bar",
      modifierGroups: ["Shot Preference", "Cup Size", "Syrup Pumps (+$0.20 each)", "Coffee Toppings", "Cup Size (12-16)", "Extra Single Shots (Hot)", "Milk Choice"],
      allergens: ["Dairy"],
    },
    {
      name: "Peach Betty",
      description: "Warm peach dessert with a crumb topping.",
      price: 4.00,
      section: "Pastries",
      modifierGroups: [],
      allergens: [],
    },
    {
      name: "Plain Bagel",
      description: "Freshly baked classic bagel.",
      price: 3.25,
      section: "Pastries",
      modifierGroups: [],
      allergens: [],
    },
    {
      name: "Plain Croissant",
      description: "Buttery, flaky classic croissant.",
      price: 3.50,
      section: "Pastries",
      modifierGroups: [],
      allergens: [],
    },
    {
      name: "Filtered Coffee",
      description: "Fresh filtered coffee. Select your cup size.",
      price: 2.55,
      section: "Filtered Coffee",
      modifierGroups: ["Cup Size (Filtered Coffee)", "Filtered Coffee Refill", "Cup Size (12-16)"],
      allergens: [],
    },
    {
      name: "Iced Flat White",
      description: "Flat white served over ice.",
      price: 4.85,
      section: "Cold Coffee",
      modifierGroups: ["Shot Preference", "Cup Size", "Cup Size (16-20)", "Syrup Pumps (+$0.20 each)", "Coffee Toppings", "Ice Level", "Milk Choice", "Extra Single Shots (Iced)"],
      allergens: ["Dairy"],
    },
    {
      name: "Iced Mocha",
      description: "Mocha served over ice.",
      price: 5.85,
      section: "Cold Coffee",
      modifierGroups: ["Shot Preference", "Cup Size", "Cup Size (16-20)", "Syrup Pumps (+$0.20 each)", "Coffee Toppings", "Ice Level", "Milk Choice", "Extra Single Shots (Iced)"],
      allergens: ["Dairy"],
    },
    {
      name: "Espresso Macchiato",
      description: "Espresso marked with a small amount of foam.",
      price: 5.15,
      section: "Espresso Bar",
      modifierGroups: ["Shot Preference", "Extra Single Shots (Hot)"],
      allergens: [],
    },
    {
      name: "Custom Oatmeal",
      alternateName: "Custom Oatmeal Bowl",
      description: "Build your own bowl.\nRequired: choose a base (Oats, Chia pudding, Yogurt) extra base: $2\n2 Choice of fresh Fruits and Any dry toppings. extra fruits: $0.75 extra dry topping: $0.50",
      price: 9.99,
      section: "Oatmeal Bar",
      modifierGroups: [
        "Oatmeal Base",
        "Oatmeal Dried Toppings",
        "Oatmeal Drizzels",
        "Oatmeal Fruit Toppings",
        "Oatmeal EXTRA Add-Ons",
      ],
      allergens: [],
    },
    {
      name: "Espresso Energy",
      description: "Espresso, milk, yogurt, cocoa, cinnamon, honey (served over ice)\nAllergens: Dairy",
      price: 7.75,
      section: "Smoothies",
      modifierGroups: ["Shot Preference", "Milk Choice", "Smoothie Add-Ons", "Yogurt Choice"],
      allergens: ["Dairy"],
    },
    {
      name: "Berry Boost",
      description: "Strawberry, blueberry, raspberry, vanilla yogurt, almond milk\nAllergens: Dairy, tree nuts",
      price: 8.95,
      section: "Smoothies",
      modifierGroups: ["Milk Choice", "Smoothie Add-Ons", "Yogurt Choice"],
      allergens: ["Dairy", "Tree Nuts"],
    },
    {
      name: "Tropical Bliss",
      description: "Mango, pineapple, banana, orange juice, coconut milk, fresh lime\nAllergens: Coconut",
      price: 8.25,
      section: "Smoothies",
      modifierGroups: ["Milk Choice", "Smoothie Add-Ons", "Yogurt Choice"],
      allergens: ["Coconut"],
    },
    {
      name: "Green Glow",
      description: "Spinach, kale, banana, avocado, chia seeds, almond milk, honey\nAllergens: Tree Nuts",
      price: 8.75,
      section: "Smoothies",
      modifierGroups: ["Milk Choice", "Smoothie Add-Ons", "Yogurt Choice"],
      allergens: ["Tree Nuts"],
    },
    {
      name: "Nutty Banana Bliss",
      description: "Banana, peanut butter, chia seeds, almonds, cinnamon, and almond milk\nAllergens: Peanuts, Tree Nuts",
      price: 8.25,
      section: "Smoothies",
      modifierGroups: ["Milk Choice", "Smoothie Add-Ons", "Yogurt Choice"],
      allergens: ["Peanuts", "Tree Nuts"],
    },
    {
      name: "Guava Cream",
      description: "Guava, yogurt, almond milk, avocado, fresh lime\nAllergens: Dairy, Tree Nuts",
      price: 8.50,
      section: "Smoothies",
      modifierGroups: ["Milk Choice", "Smoothie Add-Ons", "Yogurt Choice"],
      allergens: ["Dairy", "Tree Nuts"],
    },
    {
      name: "Iced Chai Latte",
      description: "Spiced chai tea blended with steamed milk.",
      price: 5.25,
      section: "Tea",
      modifierGroups: ["Cup Size (16-20)", "Syrup Pumps (+$0.20 each)", "Ice Level", "Milk Choice"],
      allergens: [],
    },
    {
      name: "Iced Matcha Latte",
      description: "Matcha blended with milk and shaken over ice",
      price: 5.45,
      section: "Tea",
      modifierGroups: ["Cup Size (16-20)", "Syrup Pumps (+$0.20 each)", "Ice Level", "Milk Choice"],
      allergens: [],
    },
  ];

  return csvData;
}

async function mapMenuItems() {
  try {
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB");

    // Get all modifier groups
    const modifierGroups = await ModifierGroup.find({});
    const modifierGroupMap = {};
    modifierGroups.forEach((group) => {
      modifierGroupMap[group.name] = group._id;
    });

    console.log(`Found ${modifierGroups.length} modifier groups`);

    // Get CSV data
    const csvData = parseCSVData();
    console.log(`Processing ${csvData.length} items from CSV`);

    let updated = 0;
    let created = 0;
    let notFound = 0;

    for (const csvItem of csvData) {
      // Try to find existing menu item by name (with fuzzy matching)
      let menuItem = await MenuItem.findOne({
        $or: [
          { name: csvItem.name },
          { name: csvItem.alternateName },
          // Try name mappings
          ...(nameMappings[csvItem.name] ? [{ name: nameMappings[csvItem.name] }] : []),
        ],
      });

      // If not found, try case-insensitive search
      if (!menuItem) {
        menuItem = await MenuItem.findOne({
          name: { $regex: new RegExp(`^${csvItem.name}$`, "i") },
        });
      }

      // Map modifier group names to IDs
      const modifierGroupIds = csvItem.modifierGroups
        .map((groupName) => modifierGroupMap[groupName])
        .filter((id) => id !== undefined);

      // Map section
      const mappedSection = sectionMapping[csvItem.section] || csvItem.section;

      if (menuItem) {
        // Update existing item
        menuItem.name = csvItem.name;
        menuItem.description = csvItem.description;
        menuItem.price = csvItem.price;
        menuItem.section = mappedSection;
        menuItem.modifierGroups = modifierGroupIds;
        menuItem.allergens = csvItem.allergens;
        menuItem.cloverId = csvItem.cloverId || menuItem.cloverId;

        await menuItem.save();
        updated++;
        console.log(`✓ Updated: ${csvItem.name}`);
      } else {
        // Create new item (if it doesn't exist)
        const newItem = new MenuItem({
          name: csvItem.name,
          description: csvItem.description,
          price: csvItem.price,
          currency: "USD",
          section: mappedSection,
          modifierGroups: modifierGroupIds,
          allergens: csvItem.allergens,
          available: true,
          active: true,
        });

        await newItem.save();
        created++;
        console.log(`+ Created: ${csvItem.name}`);
      }
    }

    console.log("\n=== Summary ===");
    console.log(`Updated: ${updated}`);
    console.log(`Created: ${created}`);
    console.log(`Not found: ${notFound}`);

    await mongoose.connection.close();
    console.log("\nMapping complete!");
  } catch (error) {
    console.error("Error mapping menu items:", error);
    process.exit(1);
  }
}

mapMenuItems();


