/**
 * Give Tiramisu Cacao Shaken Espresso a milk group where every milk is $0.
 *
 * Local TEST:
 *   node scripts/syncTiramisuIncludedMilk.js
 * Production:
 *   ALLOW_PROD_DB=true node scripts/syncTiramisuIncludedMilk.js --prod
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { ModifierGroup, MenuItem } from "../models/index.js";
import {
  INCLUDED_MILK_DRINK_NAMES,
  INCLUDED_MILK_GROUP_NAME,
  INCLUDED_MILK_OPTIONS,
} from "../config/includedMilk.js";
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

async function sync() {
  await mongoose.connect(mongoUri);
  console.log(`[syncTiramisuIncludedMilk] Connected to ${dbName}`);

  const group = await ModifierGroup.findOneAndUpdate(
    { name: INCLUDED_MILK_GROUP_NAME },
    {
      $set: {
        displayName: "Milk Choice",
        description: "Made with oat milk. Every milk option is included.",
        type: "single",
        required: true,
        minSelections: 0,
        maxSelections: 1,
        options: INCLUDED_MILK_OPTIONS,
        available: true,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  console.log(
    `[syncTiramisuIncludedMilk] Upserted ${group.name} (${group.options.length} options at $0)`,
  );

  const standardMilk = await ModifierGroup.findOne({ name: "Milk Choice" })
    .select("_id")
    .lean();

  for (const drinkName of INCLUDED_MILK_DRINK_NAMES) {
    const item = await MenuItem.findOne({ name: drinkName });
    if (!item) {
      console.log(`[syncTiramisuIncludedMilk] Menu item not found: ${drinkName}`);
      continue;
    }

    const nextGroups = [];
    let replaced = false;
    for (const groupId of item.modifierGroups || []) {
      if (standardMilk && String(groupId) === String(standardMilk._id)) {
        nextGroups.push(group._id);
        replaced = true;
      } else if (String(groupId) === String(group._id)) {
        nextGroups.push(group._id);
        replaced = true;
      } else {
        nextGroups.push(groupId);
      }
    }
    if (!replaced) nextGroups.push(group._id);

    item.modifierGroups = nextGroups;
    await item.save();
    console.log(
      `[syncTiramisuIncludedMilk] Linked ${drinkName} to ${INCLUDED_MILK_GROUP_NAME}`,
    );
  }

  await mongoose.disconnect();
  console.log("[syncTiramisuIncludedMilk] Done");
}

sync().catch((err) => {
  console.error(err);
  process.exit(1);
});
