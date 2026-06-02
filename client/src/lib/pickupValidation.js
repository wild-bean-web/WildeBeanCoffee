import { PICKUP_MIN_LEAD_MINUTES } from "@/lib/constants";

/**
 * Validates a local calendar date + "HH:mm" slot (same construction as order page pickup ISO).
 * @param {string} dateStr - YYYY-MM-DD
 * @param {string} timeStr - HH:mm
 * @param {number} [leadMinutes]
 * @returns {string|null} Error message or null if valid / incomplete selection
 */
export function getPickupLeadTimeError(dateStr, timeStr, leadMinutes = PICKUP_MIN_LEAD_MINUTES) {
  if (!dateStr || !timeStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hr, min] = timeStr.split(":").map(Number);
  if ([y, m, d, hr, min].some((n) => Number.isNaN(n))) {
    return "Invalid pickup time.";
  }
  const slotStart = new Date(y, m - 1, d, hr, min, 0, 0);
  if (Number.isNaN(slotStart.getTime())) {
    return "Invalid pickup time.";
  }
  const minAllowed = Date.now() + leadMinutes * 60 * 1000;
  if (slotStart.getTime() < minAllowed) {
    return `Pickup must be at least ${leadMinutes} minutes from now. Please select a new time.`;
  }
  return null;
}

/**
 * Validates an ISO 8601 pickup instant (e.g. from pending order or API).
 * @param {string|undefined} iso
 * @param {number} [leadMinutes]
 * @returns {string|null}
 */
export function getPickupLeadTimeErrorFromIso(iso, leadMinutes = PICKUP_MIN_LEAD_MINUTES) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return "Invalid pickup time.";
  }
  const minAllowed = Date.now() + leadMinutes * 60 * 1000;
  if (d.getTime() < minAllowed) {
    return `Pickup must be at least ${leadMinutes} minutes from now. Please return to the order page and choose a new pickup time.`;
  }
  return null;
}
