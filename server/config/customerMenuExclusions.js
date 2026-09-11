/**
 * Exact menu item names hidden from the public customer menu API (GET list + GET by id).
 * Item stays in DB for POS / future use; remove a name from the set to show it again.
 */
const HIDDEN = new Set(["Almond Croissant"]);

/** Modifier option names hidden from the public customer menu API. */
const HIDDEN_MODIFIER_OPTIONS = new Set(["HALF A PUMP"]);

export function isMenuItemHiddenFromCustomer(name) {
  return typeof name === "string" && HIDDEN.has(name);
}

export function isModifierOptionHiddenFromCustomer(name) {
  return typeof name === "string" && HIDDEN_MODIFIER_OPTIONS.has(name);
}

export function stripHiddenModifierOptions(item) {
  if (!item?.modifierGroups?.length) return item;
  return {
    ...item,
    modifierGroups: item.modifierGroups.map((group) => ({
      ...group,
      options: (group.options || []).filter(
        (opt) => !isModifierOptionHiddenFromCustomer(opt.name),
      ),
    })),
  };
}
