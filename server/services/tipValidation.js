/** Max tip is 50% of pre-tax food subtotal (matches client order page). */
export const MAX_TIP_FRACTION = 0.5;

/**
 * Sum line-item food subtotal in cents (same rounding as checkout / placeOnlineOrder).
 * @param {Array<{ price?: number, quantity?: number }>} items
 */
export function foodSubtotalCentsFromItems(items) {
  let foodSubtotalCents = 0;
  for (const item of items || []) {
    const unit = Math.round(Number(item.price) * 100);
    const qty = Math.max(1, Number(item.quantity ?? 1));
    foodSubtotalCents += unit * qty;
  }
  return foodSubtotalCents;
}

/**
 * Max allowed tip in cents — matches client:
 * Math.round(foodSubtotalCents * tipPercent / 100) with tipPercent capped at 50.
 * @param {number} foodSubtotalCents
 */
export function maxTipCentsForFoodSubtotal(foodSubtotalCents) {
  return Math.round(Number(foodSubtotalCents) * MAX_TIP_FRACTION);
}

/**
 * @param {number} tipCents
 * @param {number} foodSubtotalCents
 * @returns {{ ok: true, tipCents: number, tipDollars: number } | { ok: false, error: string }}
 */
export function validateTipCents(tipCents, foodSubtotalCents) {
  const cents = Math.round(Number(tipCents));
  if (!Number.isFinite(cents) || cents < 0) {
    return { ok: false, error: "tip must be a non-negative number" };
  }
  const maxTipCents = maxTipCentsForFoodSubtotal(foodSubtotalCents);
  if (cents > maxTipCents) {
    return { ok: false, error: "tip exceeds maximum for this order" };
  }
  return { ok: true, tipCents: cents, tipDollars: cents / 100 };
}

/**
 * @param {number|string} tipDollars
 * @param {Array} items
 */
export function validateTipForItems(tipDollars, items) {
  const raw = Number(tipDollars);
  if (!Number.isFinite(raw) || raw < 0) {
    return { ok: false, error: "tip must be a non-negative number" };
  }
  return validateTipCents(Math.round(raw * 100), foodSubtotalCentsFromItems(items));
}
