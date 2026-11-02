const CUSTOMIZE_LABEL_ITEM_NAMES = new Set([
  "Build Your Own Bowl",
  "HOT Drip Coffee Traveler (Serves 10)",
]);

export function usesCustomizeLabel(item) {
  if (!item?.name) return false;
  const hasModifiers = Array.isArray(item.modifierGroups)
    ? item.modifierGroups.length > 0
    : false;
  return hasModifiers && CUSTOMIZE_LABEL_ITEM_NAMES.has(item.name);
}

export function getAddToCartLabel(item) {
  return usesCustomizeLabel(item) ? "Customize" : "Add to Cart";
}
