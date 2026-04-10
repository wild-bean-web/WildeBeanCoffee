/** Emails allowed for kitchen dashboard + loyalty admin APIs. */
export const KITCHEN_ADMIN_EMAILS = [
  "danielwoldehana@yahoo.com",
  "info@wildbeancoffeeshop.com",
];

export function isKitchenAdminEmail(email) {
  return KITCHEN_ADMIN_EMAILS.includes(String(email || "").toLowerCase());
}
