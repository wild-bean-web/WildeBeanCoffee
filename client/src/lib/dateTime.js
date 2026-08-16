const STORE_TIME_ZONE =
  process.env.NEXT_PUBLIC_STORE_TIMEZONE || "America/New_York";

/**
 * Format a date/time in the store timezone by default.
 * Pass date+time options through Intl.DateTimeFormat.
 */
export function formatStoreDateTime(input, options = {}) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: STORE_TIME_ZONE,
    ...options,
  }).format(date);
}

/** Calendar date YYYY-MM-DD in the store timezone. */
export function getStoreCalendarDate(input, timeZone = STORE_TIME_ZONE) {
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
 * True when a completed order can be returned to the live kitchen board
 * (same store calendar day as scheduled pickup, or created day if no pickupTime).
 */
export function canUnmarkOrderPickedUp(order, now = new Date()) {
  if (!order || order.status !== "completed") return false;
  const reference = order.pickupTime || order.createdAt;
  if (!reference) return false;
  const pickupDay = getStoreCalendarDate(reference);
  const today = getStoreCalendarDate(now);
  return Boolean(pickupDay && today && pickupDay === today);
}

export { STORE_TIME_ZONE };
