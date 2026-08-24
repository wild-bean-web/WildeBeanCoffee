/**
 * Upsert weekly specials without wiping other collections.
 *
 * Local / default (same DB the Next/Express server uses locally):
 *   npm run seed:specials
 *
 * Production:
 *   ALLOW_PROD_DB=true npm run seed:specials -- --prod
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import Special from "./models/special.js";
import { specialsSeed, buildSearchText } from "./seedSpecialsData.js";
import {
  getDatabaseNameFromUri,
  PROD_DATABASE_NAME,
} from "./config/mongoUri.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isProdSeed = process.argv.includes("--prod");
const isTestSeed =
  !isProdSeed &&
  (process.argv.includes("--test") ||
    process.env.NODE_ENV === "test" ||
    process.env.NODE_ENV !== "production");

dotenv.config({ path: join(__dirname, ".env") });
if (isTestSeed && !isProdSeed) {
  dotenv.config({ path: join(__dirname, ".env.test"), override: true });
}

const mongoUri = isProdSeed
  ? process.env.MONGODB_URI
  : process.env.MONGODB_TEST_URI || process.env.MONGODB_URI;

if (!mongoUri) {
  throw new Error(
    isProdSeed
      ? "Missing MONGODB_URI for --prod seed."
      : "Missing Mongo URI. Set MONGODB_TEST_URI (local) or MONGODB_URI.",
  );
}

const dbName = getDatabaseNameFromUri(mongoUri);
if (dbName === PROD_DATABASE_NAME && process.env.ALLOW_PROD_DB !== "true") {
  throw new Error(
    `Refusing to seed production database "${PROD_DATABASE_NAME}". ` +
      `Use npm run seed:specials for local, ` +
      `or set ALLOW_PROD_DB=true and pass --prod to target prod.`,
  );
}

async function seedSpecials() {
  await mongoose.connect(mongoUri);
  console.log(`[seed:specials] Connected to ${dbName || "(unknown db)"}`);

  let upserted = 0;
  for (const item of specialsSeed) {
    const weekOf = new Date(`${item.weekOf}T12:00:00.000Z`);
    const payload = {
      name: item.name,
      category: item.category,
      base: item.base || [],
      build: (item.build || []).map((line) => ({
        item: line.item,
        oz16: line.oz16 || "",
        oz20: line.oz20 || "",
      })),
      toppings: item.toppings || [],
      method: item.method || [],
      weekOf,
      weekLabel: item.weekLabel || "",
      notes: item.notes || "",
      active: item.active !== false,
      searchText: buildSearchText(item),
    };

    await Special.findOneAndUpdate(
      { name: item.name, weekOf },
      { $set: payload },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    // Strip legacy paragraph fields (not on schema — use collection API).
    await Special.collection.updateOne(
      { name: item.name, weekOf },
      { $unset: { recipe16oz: "", recipe20oz: "" } },
    );
    upserted += 1;
  }

  // Drop renamed 8/24 special so staff don't see the old card.
  const renamed = await Special.deleteMany({
    name: "Pistachio Toffee Crunch Latte",
  });
  if (renamed.deletedCount) {
    console.log(
      `[seed:specials] Removed ${renamed.deletedCount} renamed special(s)`,
    );
  }

  console.log(`[seed:specials] Upserted ${upserted} special(s)`);
  await mongoose.disconnect();
}

seedSpecials().catch((err) => {
  console.error("[seed:specials] Failed:", err);
  process.exit(1);
});
