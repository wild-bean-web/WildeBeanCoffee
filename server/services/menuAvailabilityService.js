import { MenuItem } from "../models/index.js";
import { recipeIngredientsForMenuItem } from "../data/recipeIngredientsByMenuItem.js";
import {
  normalizeSearchText,
  searchTokensFromQuery,
  fuzzyTextMatchesQuery,
} from "../utils/fuzzyTextMatch.js";

function normalizeIngredient(value) {
  return normalizeSearchText(value);
}

function tokensFromQuery(query) {
  return searchTokensFromQuery(query);
}

/** Match if every search token fuzzily matches the text (typo-tolerant). */
export function textMatchesQuery(text, query) {
  return fuzzyTextMatchesQuery(text, query);
}

export const ingredientMatchesQuery = textMatchesQuery;

function pickDisplayName(names) {
  if (!names.length) return "";
  const exactCounts = new Map();
  for (const name of names) {
    const key = normalizeIngredient(name);
    exactCounts.set(key, (exactCounts.get(key) || 0) + 1);
  }
  const sorted = [...names].sort((a, b) => {
    const countDiff =
      (exactCounts.get(normalizeIngredient(b)) || 0) -
      (exactCounts.get(normalizeIngredient(a)) || 0);
    if (countDiff !== 0) return countDiff;
    return a.length - b.length;
  });
  return sorted[0];
}

function recipeIngredientMatches(ingredientName, query) {
  const normalizedIngredient = normalizeIngredient(ingredientName);
  const normalizedQuery = normalizeIngredient(query);
  if (!normalizedQuery) return false;
  if (normalizedIngredient === normalizedQuery) return true;
  return textMatchesQuery(ingredientName, query);
}

function formatMenuItemRow(item) {
  return {
    _id: item._id.toString(),
    name: item.name,
    section: item.section,
    available: item.available !== false,
    onlineOrderable: item.onlineOrderable !== false,
  };
}

/**
 * Build searchable ingredient catalog from recipeIngredients on all active menu items.
 */
export async function listIngredients(search = "") {
  const menuItems = await MenuItem.find({ active: true })
    .select("recipeIngredients")
    .lean();

  const byKey = new Map();
  for (const item of menuItems) {
    for (const ingredient of item.recipeIngredients || []) {
      const displayName = String(ingredient || "").trim();
      if (!displayName) continue;
      const key = normalizeIngredient(displayName);
      if (!byKey.has(key)) {
        byKey.set(key, { key, names: [displayName] });
      } else {
        byKey.get(key).names.push(displayName);
      }
    }
  }

  let ingredients = [...byKey.values()].map((entry) => ({
    key: entry.key,
    name: pickDisplayName(entry.names),
  }));

  if (search.trim()) {
    ingredients = ingredients.filter((entry) =>
      textMatchesQuery(entry.name, search),
    );
  }

  return ingredients.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Search active menu items by name (for direct 86 by item).
 */
export async function listMenuItems(search = "") {
  const items = await MenuItem.find({ active: true })
    .select("name section available onlineOrderable")
    .sort({ section: 1, name: 1 })
    .lean();

  const query = String(search || "").trim();
  const filtered = query
    ? items.filter((item) => textMatchesQuery(item.name, query))
    : items;

  return filtered.map(formatMenuItemRow);
}

/**
 * Active menu items currently marked out of stock (86'd).
 */
export async function listUnavailableMenuItems() {
  const items = await MenuItem.find({ active: true, available: false })
    .select("name section available onlineOrderable")
    .sort({ section: 1, name: 1 })
    .lean();
  return items.map(formatMenuItemRow);
}

/**
 * Unified admin search: menu items by name + recipe ingredients.
 */
export async function searchAvailability(search = "") {
  const query = String(search || "").trim();
  const [ingredients, menuItems] = await Promise.all([
    listIngredients(query),
    query ? listMenuItems(query) : Promise.resolve([]),
  ]);
  return { ingredients, menuItems };
}

export async function resolveIngredient(query) {
  const matches = await listIngredients(query);
  if (!matches.length) return null;

  const exact = matches.find((entry) =>
    recipeIngredientMatches(entry.name, query),
  );
  if (exact) return exact.name;

  return matches[0].name;
}

/**
 * Find menu items whose recipe requires the searched ingredient.
 */
export async function findIngredientDependents(ingredientQuery) {
  const query = String(ingredientQuery || "").trim();
  if (!query) {
    return {
      ingredient: "",
      canonicalIngredient: null,
      menuItems: [],
      allItemsInStock: true,
    };
  }

  const canonical = await resolveIngredient(query);
  const menuItems = await MenuItem.find({ active: true })
    .select("name section available onlineOrderable recipeIngredients")
    .sort({ section: 1, name: 1 })
    .lean();

  const dependentItems = [];
  for (const item of menuItems) {
    const recipeIngredients = (item.recipeIngredients || []).map((value) =>
      String(value).trim(),
    );
    const matchedIngredients = recipeIngredients.filter((value) =>
      recipeIngredientMatches(value, query),
    );

    if (matchedIngredients.length > 0) {
      dependentItems.push({
        ...formatMenuItemRow(item),
        matchedIngredients,
      });
    }
  }

  return {
    ingredient: query,
    canonicalIngredient: canonical,
    menuItems: dependentItems,
    allItemsInStock: dependentItems.every((item) => item.available !== false),
  };
}

export async function setMenuItemAvailable(itemId, available) {
  const item = await MenuItem.findByIdAndUpdate(
    itemId,
    { $set: { available: Boolean(available) } },
    { new: true },
  ).lean();
  if (!item) return null;
  return formatMenuItemRow(item);
}

export async function bulkSetMenuItemsAvailable(itemIds, available) {
  const ids = [...new Set(itemIds.filter(Boolean))];
  if (!ids.length) return { modifiedCount: 0, items: [] };

  await MenuItem.updateMany(
    { _id: { $in: ids } },
    { $set: { available: Boolean(available) } },
  );

  const items = await MenuItem.find({ _id: { $in: ids } })
    .select("name section available onlineOrderable")
    .lean();

  return {
    modifiedCount: items.length,
    items: items.map(formatMenuItemRow),
  };
}

export function applyRecipeIngredientsToSeedItem(item) {
  const recipeIngredients = recipeIngredientsForMenuItem(item.name);
  if (!recipeIngredients.length) return item;
  return { ...item, recipeIngredients };
}
