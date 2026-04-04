/**
 * Bean Stamps master switch.
 * - Explicit BEAN_STAMPS_ENABLED=false|0 → off (use in production when not launched).
 * - Explicit true|1 → on.
 * - Unset: on when NODE_ENV is not "production" (local testing); off in production until you set true.
 */
export function isBeanStampsEnabled() {
  const v = process.env.BEAN_STAMPS_ENABLED;
  if (v === "false" || v === "0") return false;
  if (v === "true" || v === "1") return true;
  return process.env.NODE_ENV !== "production";
}

/**
 * Admin QA: comped orders (paymentRef ADMIN_DISCOUNT, $0 total).
 * Set ADMIN_ORDER_COMP_ENABLED=false or 0 to reject comped orders on the server and hide the flow on the client (with NEXT_PUBLIC_ADMIN_ORDER_COMP_ENABLED).
 * Unset or true/1: enabled (preserves existing behavior).
 */
export function isAdminOrderCompEnabled() {
  const v = process.env.ADMIN_ORDER_COMP_ENABLED;
  if (v === "false" || v === "0") return false;
  if (v === "true" || v === "1") return true;
  return true;
}
