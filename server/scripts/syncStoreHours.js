/**
 * Update every location document to the canonical store hours (close 6 PM daily).
 *
 * Local TEST:
 *   node scripts/syncStoreHours.js
 * Production:
 *   ALLOW_PROD_DB=true node scripts/syncStoreHours.js --prod
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { Location } from "../models/index.js";
import { STORE_HOURS } from "../config/storeHours.js";
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
  console.log(`[syncStoreHours] Connected to ${dbName}`);

  const hours = STORE_HOURS.map((h) => ({ ...h, closed: false }));
  const result = await Location.updateMany(
    {},
    { $set: { hours } },
  );

  console.log(
    `[syncStoreHours] Updated hours on ${result.modifiedCount} location(s) ` +
      `(matched ${result.matchedCount}). Close is ${hours[0].closes} every day.`,
  );

  const sample = await Location.findOne({}).select("name hours").lean();
  if (sample) {
    console.log(`[syncStoreHours] ${sample.name}:`);
    for (const day of sample.hours || []) {
      console.log(`  ${day.day}: ${day.opens}–${day.closes}`);
    }
  }

  await mongoose.connection.close();
}

sync().catch((err) => {
  console.error("[syncStoreHours] failed:", err);
  process.exit(1);
});
