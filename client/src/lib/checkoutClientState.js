/**
 * Client-side checkout/order draft cleanup after a successful hosted checkout or paid order.
 * Keeps cart and pending redirect payload from sticking around in storage or stale UI.
 */
export function clearPostCheckoutClientState() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("cart");
  } catch {
    /* ignore quota / private mode */
  }
  try {
    sessionStorage.removeItem("pendingOrder");
  } catch {
    /* ignore */
  }
}
