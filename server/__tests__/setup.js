/**
 * Test setup and teardown utilities
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Base credentials from .env, then optional .env.test overrides (override: true).
// Loading .env.test *first* breaks tests when .env.test has stale MONGODB_URI — dotenv does not
// overwrite existing process.env keys, so seed (which often only loads .env) would work while Jest would not.
dotenv.config({ path: join(__dirname, "..", ".env") });
dotenv.config({ path: join(__dirname, "..", ".env.test"), override: true });

/**
 * Same cluster/user as MONGODB_URI but DB name wildbeancoffee_test (preserves ?retryWrites=…).
 */
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

// Get test database URI with fallbacks
const TEST_DB_URI =
  process.env.MONGODB_TEST_URI ||
  process.env.MONGODB_URI_TEST ||
  deriveTestDatabaseUri(process.env.MONGODB_URI) ||
  "mongodb://localhost:27017/wildbeancoffee_test";

if (!TEST_DB_URI) {
  throw new Error(
    "Test database URI is not configured. Please set MONGODB_TEST_URI in .env.test or .env"
  );
}

/**
 * Connect to test database
 */
export async function connectTestDB() {
  if (mongoose.connection.readyState === 1) {
    return;
  }
  await mongoose.connect(TEST_DB_URI);
  // Wait for connection to be ready
  await new Promise((resolve) => {
    if (mongoose.connection.readyState === 1) {
      resolve();
    } else {
      mongoose.connection.once("connected", resolve);
    }
  });
}

/**
 * Clear all collections in test database
 */
export async function clearDatabase() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

/**
 * Close test database connection
 */
export async function closeTestDB() {
  await mongoose.connection.close();
}

/**
 * Setup before all tests
 */
export async function setupTestDB() {
  await connectTestDB();
  await clearDatabase();
}

/**
 * Teardown after all tests
 */
export async function teardownTestDB() {
  await clearDatabase();
  await closeTestDB();
}

