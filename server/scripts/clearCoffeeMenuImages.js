/**
 * Clear image references on Coffee & Espresso items.
 * Coffee is presented as a text-only menu section, so stored photos are removed
 * to keep the DB in sync with the seed data.
 *
 * Usage (from server/):
 *   node scripts/clearCoffeeMenuImages.js
 *   ALLOW_PROD_DB=true node scripts/clearCoffeeMenuImages.js --prod
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import {
  getDatabaseNameFromUri,
  PROD_DATABASE_NAME,
} from "../config/mongoUri.js";
import { MenuItem } from "../models/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const COFFEE_SECTION = "Coffee & Espresso";

const isProd = process.argv.includes("--prod");
const mongoUri = isProd
  ? process.env.MONGODB_URI
  : process.env.MONGODB_TEST_URI || process.env.MONGODB_URI;

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
      "Refusing production DB. Set ALLOW_PROD_DB=true and pass --prod.",
    );
  }

  console.log(`[clearCoffeeImages] Connecting to ${dbName}…`);
  await mongoose.connect(mongoUri);

  const withImages = await MenuItem.find({
    section: COFFEE_SECTION,
    image: { $nin: ["", null] },
  })
    .select("name image")
    .lean();

  withImages.forEach((item) => console.log(`  clearing: ${item.name}`));

  const result = await MenuItem.updateMany(
    { section: COFFEE_SECTION, image: { $nin: ["", null] } },
    { $set: { image: "" } },
  );

  console.log(`[clearCoffeeImages] Done. ${result.modifiedCount} item(s) cleared.`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("[clearCoffeeImages] Failed:", err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
