/** Matches `section` on menu items from the API / seed (Coffee & Espresso). */
export const MENU_SECTION_COFFEE_ESPRESSO = "Coffee & Espresso";

/** Shown on checkout and order confirmation for all pickup orders. */
export const PICKUP_ARRIVAL_NOTE =
  "When you arrive, please let a team member know you are here for your order. You do not need to wait in line.";

/** Shown on checkout when the cart includes pickup espresso drinks. */
export const PICKUP_COFFEE_FRESHNESS_NOTE =
  "When possible, we prepare hot and iced espresso drinks closer to your pickup time so they arrive fresh.";

export function cartIncludesCoffeeEspressoDrinks(cartLines) {
  if (!Array.isArray(cartLines)) return false;
  return cartLines.some(
    (line) =>
      line?.itemType === "menu" &&
      line?.section === MENU_SECTION_COFFEE_ESPRESSO &&
      Number(line?.quantity) > 0,
  );
}
