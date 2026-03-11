/**
 * Grand opening: Monday, February 16, 2026 at 6:00 AM (local time).
 * After this moment, the countdown is hidden and online ordering is open to everyone.
 */
export const GRAND_OPENING_DATE = new Date(2026, 1, 16, 6, 0, 0); // month 1 = February

export function isGrandOpeningPassed() {
  if (typeof window === "undefined") return false;
  return Date.now() >= GRAND_OPENING_DATE.getTime();
}

export function getGrandOpeningLabel() {
  return "Monday, February 16 at 6:00 AM";
}

/** Set to true when you are ready to offer pastries via online ordering (after grand opening). */
export const PASTRIES_ORDERING_ENABLED = true;

export const PASTRIES_SECTION_NAME = "Bakery & Pastries";

/** Google review link — used for "Leave a review" button (mobile) and can be encoded in QR. */
export const GOOGLE_REVIEW_URL = "https://g.page/r/CZTCnS4aNEW1EBM/review";
