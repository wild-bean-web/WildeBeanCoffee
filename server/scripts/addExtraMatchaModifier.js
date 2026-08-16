/**
 * Upsert Extra Matcha (+$1.30) and attach it to all Matcha menu items.
 *
 * Usage (from server/):
 *   node scripts/addExtraMatchaModifier.js
 *   ALLOW_PROD_DB=true node scripts/addExtraMatchaModifier.js --prod
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

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const isProd = process.argv.includes("--prod");
const mongoUri = isProd
  ? process.env.MONGODB_URI
  : process.env.MONGODB_TEST_URI || process.env.MONGODB_URI;

const EXTRA_MATCHA = {
  name: "Extra Matcha",
  displayName: "Extra Matcha",
  description: "Add extra matcha (+$1.30)",
  type: "multiple",
  required: false,
  minSelections: 0,
  maxSelections: 1,
  options: [{ name: "Extra Matcha", price: 1.3, available: true }],
  available: true,
};

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

  console.log(`[addExtraMatcha] Connecting to ${dbName}…`);
  await mongoose.connect(mongoUri);

  const group = await ModifierGroup.findOneAndUpdate(
    { name: EXTRA_MATCHA.name },
    { $set: EXTRA_MATCHA },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  console.log(`[addExtraMatcha] Modifier group ready: ${group._id}`);

  const matchaItems = await MenuItem.find({
    active: true,
    $or: [{ name: /matcha/i }, { tags: "matcha" }],
  }).select("name modifierGroups");

  let updated = 0;
  for (const item of matchaItems) {
    const ids = (item.modifierGroups || []).map((id) => String(id));
    if (ids.includes(String(group._id))) {
      console.log(`  skip (already linked): ${item.name}`);
      continue;
    }
    const next = [...(item.modifierGroups || [])];
    next.splice(Math.min(1, next.length), 0, group._id);
    item.modifierGroups = next;
    await item.save();
    updated += 1;
    console.log(`  linked: ${item.name}`);
  }

  console.log(
    `[addExtraMatcha] Done. ${updated} item(s) updated of ${matchaItems.length} matcha drink(s).`,
  );
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("[addExtraMatcha] Failed:", err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
