/**
 * Sync modifier-group inventory changes without wiping other prod catalog data.
 *
 * Local TEST:
 *   node scripts/syncModifierGroups.js
 * Production:
 *   ALLOW_PROD_DB=true node scripts/syncModifierGroups.js --prod
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { ModifierGroup, MenuItem } from "../models/index.js";
import { modifierGroups } from "../seedModifierGroups.js";
import { recipeIngredientsForMenuItem } from "../data/recipeIngredientsByMenuItem.js";
import {
  getDatabaseNameFromUri,
  PROD_DATABASE_NAME,
} from "../config/mongoUri.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const isProd = process.argv.includes("--prod");

dotenv.config({ path: join(__dirname, "..", ".env") });
if (!isProd) {
  dotenv.config({ path: join(__dirname, "..", ".env.test"), override: true });
}

const mongoUri = isProd
  ? process.env.MONGODB_URI
  : process.env.MONGODB_TEST_URI || process.env.MONGODB_URI;

if (!mongoUri) {
  throw new Error(isProd ? "Missing MONGODB_URI" : "Missing MONGODB_TEST_URI");
}

const dbName = getDatabaseNameFromUri(mongoUri);
if (dbName === PROD_DATABASE_NAME && process.env.ALLOW_PROD_DB !== "true") {
  throw new Error(
    `Refusing to update production. Set ALLOW_PROD_DB=true and pass --prod.`,
  );
}

const GROUPS_TO_SYNC = [
  "Smoothie Add-Ons",
  "Fruit Toppings",
  "Fruit Toppings (Build Your Own)",
  "Extra Add-Ons",
];

async function sync() {
  await mongoose.connect(mongoUri);
  console.log(`[syncModifierGroups] Connected to ${dbName}`);

  for (const name of GROUPS_TO_SYNC) {
    const seed = modifierGroups.find((g) => g.name === name);
    if (!seed) {
      console.warn(`[syncModifierGroups] Seed missing group: ${name}`);
      continue;
    }
    const { name: _n, ...rest } = seed;
    const updated = await ModifierGroup.findOneAndUpdate(
      { name },
      { $set: rest },
      { new: true },
    );
    if (!updated) {
      console.warn(`[syncModifierGroups] Not found in DB: ${name}`);
    } else {
      console.log(
        `[syncModifierGroups] Updated ${name} (${updated.options.length} options)`,
      );
    }
  }

  const signatureDesc =
    "½ Chia Seed Pudding, ½ Yogurt, Granola, Pecans, Sunflower Seeds, Coconut Flakes, Peanut Butter, Honey, Strawberries, Bananas. You may remove or add toppings; rules: 1 base, 2 fruits, up to 8 toppings & 2 drizzles.";
  const signatureRecipe = recipeIngredientsForMenuItem("Signature Bowl");
  const bowl = await MenuItem.findOneAndUpdate(
    { name: "Signature Bowl" },
    {
      $set: {
        description: signatureDesc,
        ...(signatureRecipe.length
          ? { recipeIngredients: signatureRecipe }
          : {}),
      },
    },
    { new: true },
  );
  console.log(
    bowl
      ? "[syncModifierGroups] Updated Signature Bowl description + recipe"
      : "[syncModifierGroups] Signature Bowl not found",
  );

  await mongoose.disconnect();
  console.log("[syncModifierGroups] Done");
}

sync().catch((err) => {
  console.error(err);
  process.exit(1);
});
