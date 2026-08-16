/**
 * Upsert the 18 cold coffee drinks that were missing from the website menu.
 * Resolves modifier group names → ObjectIds from the live ModifierGroup collection.
 *
 * Usage (from server/):
 *   node scripts/addMissingColdCoffeeDrinks.js
 *   ALLOW_PROD_DB=true node scripts/addMissingColdCoffeeDrinks.js --prod
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import {
  getDatabaseNameFromUri,
  PROD_DATABASE_NAME,
} from "../config/mongoUri.js";
import { ModifierGroup, MenuItem } from "../models/index.js";
import { menuItemsFromCSV } from "../seedMenuItemsFromCSV.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const isProd = process.argv.includes("--prod");
const mongoUri = isProd
  ? process.env.MONGODB_URI
  : process.env.MONGODB_TEST_URI || process.env.MONGODB_URI;

const NEW_COLD_COFFEE_NAMES = [
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
];

async function main() {
  if (!mongoUri) {
    throw new Error(
      isProd
        ? "Missing MONGODB_URI for --prod."
        : "Missing Mongo URI. Set MONGODB_TEST_URI or MONGODB_URI.",
    );
  }

  const dbName = getDatabaseNameFromUri(mongoUri);
  if (dbName === PROD_DATABASE_NAME && process.env.ALLOW_PROD_DB !== "true") {
    throw new Error(
      `Refusing production DB. Set ALLOW_PROD_DB=true and pass --prod.`,
    );
  }

  console.log(`[addColdCoffee] Connecting to ${dbName}…`);
  await mongoose.connect(mongoUri);

  const groups = await ModifierGroup.find({}).select("name").lean();
  const groupByName = Object.fromEntries(groups.map((g) => [g.name, g._id]));

  const seeds = menuItemsFromCSV.filter((item) =>
    NEW_COLD_COFFEE_NAMES.includes(item.name),
  );
  if (seeds.length !== NEW_COLD_COFFEE_NAMES.length) {
    const found = new Set(seeds.map((s) => s.name));
    const missing = NEW_COLD_COFFEE_NAMES.filter((n) => !found.has(n));
    throw new Error(`Seed missing items: ${missing.join(", ")}`);
  }

  let upserted = 0;
  for (const seed of seeds) {
    const { modifierGroupNames, ...rest } = seed;
    const missingGroups = (modifierGroupNames || []).filter(
      (name) => !groupByName[name],
    );
    if (missingGroups.length) {
      throw new Error(
        `${seed.name}: missing modifier groups: ${missingGroups.join(", ")}`,
      );
    }

    const payload = {
      ...rest,
      modifierGroups: (modifierGroupNames || []).map((name) => groupByName[name]),
    };

    const doc = await MenuItem.findOneAndUpdate(
      { name: seed.name },
      { $set: payload },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    upserted += 1;
    console.log(`  upserted: ${doc.name} ($${doc.price})`);
  }

  console.log(`[addColdCoffee] Done. ${upserted} item(s) upserted.`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("[addColdCoffee] Failed:", err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
