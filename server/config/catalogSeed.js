import { Product, MenuItem, Location, ModifierGroup } from "../models/index.js";

/** Catalog data only — safe to wipe when reseeding local dev menu. */
export const CATALOG_MODELS = [Product, MenuItem, Location, ModifierGroup];

/** Account/auth collections kept when reseeding or clearing shared local dev DB. */
export const PRESERVED_DEV_COLLECTIONS = new Set([
  "users",
  "emailverifications",
  "passwordresets",
]);

export async function clearCatalogData() {
  for (const Model of CATALOG_MODELS) {
    await Model.deleteMany({});
  }
}
