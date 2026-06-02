/** Production Atlas database (do not use for local dev / seed:test). */
export const PROD_DATABASE_NAME = "wildcoffeebean";

/** Team / local dev database. */
export const TEST_DATABASE_NAME = "wildcoffeebean_TEST";

export function getDatabaseNameFromUri(uri) {
  if (!uri || typeof uri !== "string") return null;
  return (
    uri.match(/\.mongodb\.net\/([^/?]+)/)?.[1] ||
    uri.match(/mongodb:\/\/[^/]+\/([^/?]+)/)?.[1] ||
    null
  );
}

export function getUserFromUri(uri) {
  return uri?.match(/mongodb\+srv:\/\/([^:]+):/)?.[1] ?? null;
}

/**
 * Resolve which Mongo URI to use.
 * - Production (NODE_ENV=production): MONGODB_URI only.
 * - Local / CI test: MONGODB_TEST_URI first; blocks prod DB unless ALLOW_PROD_DB=true.
 */
export function resolveMongoUri() {
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    return process.env.MONGODB_URI || null;
  }

  const uri =
    process.env.MONGODB_TEST_URI ||
    process.env.MONGODB_URI ||
    null;
  assertLocalDatabaseSafe(uri);
  return uri;
}

function assertLocalDatabaseSafe(uri) {
  if (!uri) return;
  const db = getDatabaseNameFromUri(uri);
  if (db === PROD_DATABASE_NAME && process.env.ALLOW_PROD_DB !== "true") {
    throw new Error(
      `Refusing to use production database "${PROD_DATABASE_NAME}" locally. ` +
        `Set MONGODB_TEST_URI to .../${TEST_DATABASE_NAME} and leave MONGODB_URI unset, ` +
        `or set ALLOW_PROD_DB=true only if you intend to hit prod.`,
    );
  }
}
