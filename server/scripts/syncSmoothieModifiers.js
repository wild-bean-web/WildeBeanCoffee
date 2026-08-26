/**
 * Sync smoothie customization rules + related modifier groups.
 *
 * Local TEST:
 *   node scripts/syncSmoothieModifiers.js
 * Production:
 *   ALLOW_PROD_DB=true node scripts/syncSmoothieModifiers.js --prod
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { ModifierGroup, MenuItem } from "../models/index.js";
import { modifierGroups } from "../seedModifierGroups.js";
import { menuItemsFromCSV } from "../seedMenuItemsFromCSV.js";
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
  "Protein Powder",
  "Fruit Toppings",
  "Fruit Toppings (Build Your Own)",
  "Extra Add-Ons",
];

async function sync() {
  await mongoose.connect(mongoUri);
  console.log(`[syncSmoothieModifiers] Connected to ${dbName}`);

  for (const name of GROUPS_TO_SYNC) {
    const seed = modifierGroups.find((g) => g.name === name);
    if (!seed) continue;
    const { name: _n, ...rest } = seed;
    const updated = await ModifierGroup.findOneAndUpdate(
      { name },
      { $set: rest },
      { new: true },
    );
    console.log(
      updated
        ? `[syncSmoothieModifiers] Updated ${name} (${updated.options.length} options)`
        : `[syncSmoothieModifiers] Missing group: ${name}`,
    );
  }

  const allGroups = await ModifierGroup.find({}).lean();
  const groupIdByName = Object.fromEntries(
    allGroups.map((g) => [g.name, g._id]),
  );

  const smoothies = menuItemsFromCSV.filter(
    (item) => item.section === "Smoothies (Organic & Fresh)",
  );

  for (const item of smoothies) {
    const modifierGroupIds = (item.modifierGroupNames || [])
      .map((name) => groupIdByName[name])
      .filter(Boolean);

    if (modifierGroupIds.length !== (item.modifierGroupNames || []).length) {
      const missing = (item.modifierGroupNames || []).filter(
        (name) => !groupIdByName[name],
      );
      console.warn(
        `[syncSmoothieModifiers] ${item.name}: missing groups ${missing.join(", ")}`,
      );
    }

    const updated = await MenuItem.findOneAndUpdate(
      { name: item.name },
      { $set: { modifierGroups: modifierGroupIds } },
      { new: true },
    );
    console.log(
      updated
        ? `[syncSmoothieModifiers] Linked ${item.name} → ${item.modifierGroupNames.join(", ")}`
        : `[syncSmoothieModifiers] Menu item not found: ${item.name}`,
    );
  }

  await mongoose.disconnect();
  console.log("[syncSmoothieModifiers] Done");
}

sync().catch((err) => {
  console.error(err);
  process.exit(1);
});
