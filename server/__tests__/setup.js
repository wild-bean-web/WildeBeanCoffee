/**
 * Test setup and teardown utilities
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import {
  PRESERVED_DEV_COLLECTIONS,
  clearCatalogData,
} from "../config/catalogSeed.js";
import { TEST_DATABASE_NAME } from "../config/mongoUri.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, "..", ".env") });
dotenv.config({ path: join(__dirname, "..", ".env.test"), override: true });

function deriveTestDatabaseUri(uri) {
  if (!uri || typeof uri !== "string") return null;
  const qIndex = uri.indexOf("?");
  const withoutQuery = qIndex === -1 ? uri : uri.slice(0, qIndex);
  const query = qIndex === -1 ? "" : uri.slice(qIndex);

  const srv = withoutQuery.match(/^(mongodb\+srv:\/\/[^/]+)\/([^/]+)$/);
  if (srv) {
    return `${srv[1]}/wildbeancoffee_test${query}`;
  }
  const std = withoutQuery.match(/^(mongodb:\/\/[^/]+(?::\d+)?)\/([^/]+)$/);
  if (std) {
    return `${std[1]}/wildbeancoffee_test${query}`;
  }
  return null;
}

const TEST_DB_URI =
  process.env.MONGODB_TEST_URI ||
  process.env.MONGODB_URI_TEST ||
  deriveTestDatabaseUri(process.env.MONGODB_URI) ||
  "mongodb://localhost:27017/wildbeancoffee_test";

if (!TEST_DB_URI) {
  throw new Error(
    "Test database URI is not configured. Please set MONGODB_TEST_URI in .env.test or .env",
  );
}

export async function connectTestDB() {
  if (mongoose.connection.readyState === 1) {
    return;
  }
  await mongoose.connect(TEST_DB_URI);
  await new Promise((resolve) => {
    if (mongoose.connection.readyState === 1) {
      resolve();
    } else {
      mongoose.connection.once("connected", resolve);
    }
  });
}

export async function clearDatabase() {
  const dbName = mongoose.connection.db?.databaseName;
  const preserveAccounts = dbName === TEST_DATABASE_NAME;

  if (preserveAccounts) {
    await clearCatalogData();
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      const name = collections[key].collectionName;
      if (PRESERVED_DEV_COLLECTIONS.has(name)) continue;
      if (["products", "menuitems", "locations", "modifiergroups"].includes(name)) {
        continue;
      }
      await collections[key].deleteMany({});
    }
    return;
  }

  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

export async function closeTestDB() {
  await mongoose.connection.close();
}

export async function setupTestDB() {
  await connectTestDB();
  await clearDatabase();
}

export async function teardownTestDB() {
  await clearDatabase();
  await closeTestDB();
}
