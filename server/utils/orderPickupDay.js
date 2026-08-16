const STORE_TIMEZONE = process.env.STORE_TIMEZONE || "America/New_York";

/**
 * Calendar date (YYYY-MM-DD) in the cafe timezone.
 * @param {Date|string|number} input
 * @param {string} [timeZone]
 */
export function getStoreCalendarDate(input, timeZone = STORE_TIMEZONE) {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Whether an order can be moved from completed (picked up) back to the live kitchen board.
 * Allowed only while today (store TZ) matches the scheduled pickup day (or created day if no pickupTime).
 */
export function canUnmarkPickedUp(order, now = new Date()) {
  if (!order || order.status !== "completed") return false;
  if (order.paymentStatus && order.paymentStatus !== "paid") return false;

  const reference = order.pickupTime || order.createdAt;
  if (!reference) return false;

  const pickupDay = getStoreCalendarDate(reference);
  const today = getStoreCalendarDate(now);
  return Boolean(pickupDay && today && pickupDay === today);
}

export { STORE_TIMEZONE };
