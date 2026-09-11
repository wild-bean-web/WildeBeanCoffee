/** Emails allowed for kitchen dashboard + site-wide new-order alerts. */
export const KITCHEN_ADMIN_EMAILS = [
  "danielwoldehana@yahoo.com",
  "info@wildbeancoffeeshop.com",
];

export function isKitchenAdminEmail(email) {
  return KITCHEN_ADMIN_EMAILS.includes(String(email || "").toLowerCase());
}
