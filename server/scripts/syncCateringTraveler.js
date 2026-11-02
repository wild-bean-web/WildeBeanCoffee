/**
 * Upsert Catering Coffee Traveler catalog rows only (no full re-seed).
 *
 * Local TEST:
 *   node scripts/syncCateringTraveler.js
 * Production:
 *   ALLOW_PROD_DB=true node scripts/syncCateringTraveler.js --prod
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

const GROUP_NAMES = ["Catering Milk", "Included Supplies"];
const ITEM_NAME = "HOT Drip Coffee Traveler (Serves 10)";

async function upsertGroup(name) {
  const seed = modifierGroups.find((g) => g.name === name);
  if (!seed) {
    throw new Error(`[syncCateringTraveler] Seed missing group: ${name}`);
  }
  const { name: _n, ...rest } = seed;
  const group = await ModifierGroup.findOneAndUpdate(
    { name },
    { $set: rest },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  console.log(
    `[syncCateringTraveler] Upserted group ${group.name} (${group.options.length} options)`,
  );
  return group;
}

async function sync() {
  await mongoose.connect(mongoUri);
  console.log(`[syncCateringTraveler] Connected to ${dbName}`);

  const groups = [];
  for (const name of GROUP_NAMES) {
    groups.push(await upsertGroup(name));
  }
  const groupIdByName = Object.fromEntries(groups.map((g) => [g.name, g._id]));

  const seedItem = menuItemsFromCSV.find((i) => i.name === ITEM_NAME);
  if (!seedItem) {
    throw new Error(`[syncCateringTraveler] Seed missing item: ${ITEM_NAME}`);
  }

  const { modifierGroupNames, ...itemFields } = seedItem;
  const modifierGroupIds = modifierGroupNames.map((n) => {
    const id = groupIdByName[n];
    if (!id) throw new Error(`[syncCateringTraveler] Missing group id: ${n}`);
    return id;
  });

  const item = await MenuItem.findOneAndUpdate(
    { name: ITEM_NAME },
    {
      $set: {
        ...itemFields,
        modifierGroups: modifierGroupIds,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  console.log(
    `[syncCateringTraveler] Upserted item ${item.name} @ $${item.price} section=${item.section}`,
  );
  console.log(
    `[syncCateringTraveler] Linked groups: ${modifierGroupNames.join(", ")}`,
  );

  await mongoose.disconnect();
  console.log("[syncCateringTraveler] Done");
}

sync().catch((err) => {
  console.error(err);
  process.exit(1);
});
