/**
 * Upsert weekly specials without wiping other collections.
 *
 * Local / default (same DB the Next/Express server uses locally):
 *   npm run seed:specials
 *   npm run seed:specials -- --test
 *
 * Production (explicit — requires ALLOW_PROD_DB=true if URI points at wildcoffeebean):
 *   ALLOW_PROD_DB=true MONGODB_URI="..." npm run seed:specials -- --prod
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import Special from "./models/special.js";
import { specialsSeed } from "./seedSpecialsData.js";
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

// Match local server: prefer MONGODB_TEST_URI unless explicitly seeding prod.
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
      `Use npm run seed:specials for local (${"wildcoffeebean_TEST"}), ` +
      `or set ALLOW_PROD_DB=true and pass --prod to target prod.`,
  );
}

async function seedSpecials() {
  await mongoose.connect(mongoUri);
  console.log(`[seed:specials] Connected to ${dbName || "(unknown db)"}`);

  let upserted = 0;
  for (const item of specialsSeed) {
    const weekOf = new Date(`${item.weekOf}T12:00:00.000Z`);
    await Special.findOneAndUpdate(
      { name: item.name, weekOf },
      {
        $set: {
          name: item.name,
          category: item.category,
          recipe16oz: item.recipe16oz,
          recipe20oz: item.recipe20oz || "",
          weekOf,
          weekLabel: item.weekLabel || "",
          notes: item.notes || "",
          active: item.active !== false,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    upserted += 1;
  }

  console.log(`[seed:specials] Upserted ${upserted} special(s)`);
  await mongoose.disconnect();
}

seedSpecials().catch((err) => {
  console.error("[seed:specials] Failed:", err);
  process.exit(1);
});
