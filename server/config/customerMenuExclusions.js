/**
 * Exact menu item names hidden from the public customer menu API (GET list + GET by id).
 * Item stays in DB for POS / future use; remove a name from the set to show it again.
 */
const HIDDEN = new Set(["Almond Croissant"]);

export function isMenuItemHiddenFromCustomer(name) {
  return typeof name === "string" && HIDDEN.has(name);
}
