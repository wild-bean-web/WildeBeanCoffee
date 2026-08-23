/**
 * Sync recipeIngredients onto existing menu items (TEST + PROD safe upsert by name).
 * Run: node server/scripts/syncRecipeIngredients.js
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import { MenuItem } from "../models/index.js";
import {
  RECIPE_INGREDIENTS_BY_MENU_ITEM,
  recipeIngredientsForMenuItem,
} from "../data/recipeIngredientsByMenuItem.js";
import { menuItemsFromCSV } from "../seedMenuItemsFromCSV.js";

dotenv.config();

async function sync(uri, label) {
  await mongoose.connect(uri);
  let updated = 0;
  let missing = 0;

  for (const [name, recipeIngredients] of Object.entries(
    RECIPE_INGREDIENTS_BY_MENU_ITEM,
  )) {
    const result = await MenuItem.updateOne(
      { name },
      { $set: { recipeIngredients } },
    );
    if (result.matchedCount) {
      updated += 1;
      console.log(`${label}: ${name} -> ${recipeIngredients.join(", ")}`);
    } else {
      missing += 1;
      console.warn(`${label}: menu item not found: ${name}`);
    }
  }

  const seedNames = menuItemsFromCSV.map((item) => item.name);
  const unmapped = seedNames.filter(
    (name) =>
      name !== "Build Your Own Bowl" &&
      !RECIPE_INGREDIENTS_BY_MENU_ITEM[name],
  );
  if (unmapped.length) {
    console.warn(
      `${label}: seed items missing recipe profiles:`,
      unmapped.join(", "),
    );
  }

  await mongoose.disconnect();
  console.log(`${label}: updated ${updated} items (${missing} not found in DB)`);
}

const testUri = process.env.MONGODB_TEST_URI;
const prodUri = process.env.MONGODB_URI;

if (testUri) await sync(testUri, "TEST");
if (prodUri) await sync(prodUri, "PROD");

// Sanity check helper used during development
export function expectedRecipeFor(name) {
  return recipeIngredientsForMenuItem(name);
}
