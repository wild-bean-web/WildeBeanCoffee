/**
 * Clover Hosted Checkout, including Apple Pay, rejects a missing last name
 * and phone numbers that still contain punctuation. Callers used to send "."
 * when last name was left blank.
 */

export function phoneDigitsForClover(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  const normalized =
    digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (normalized.length !== 10) {
    const err = new Error("A 10-digit phone number is required");
    err.status = 400;
    throw err;
  }
  return normalized;
}

export function lastNameForClover(lastName) {
  const trimmed = String(lastName || "").trim();
  if (trimmed.length < 2 || trimmed === "." || !/[A-Za-z]/.test(trimmed)) {
    const err = new Error("Last name is required");
    err.status = 400;
    throw err;
  }
  return trimmed;
}

export function cloverCustomerFields(customer) {
  const firstName = String(customer?.firstName || "").trim();
  if (firstName.length < 1) {
    const err = new Error("First name is required");
    err.status = 400;
    throw err;
  }
  return {
    firstName,
    lastName: lastNameForClover(customer?.lastName),
    email: String(customer?.email || "").trim(),
    phoneNumber: phoneDigitsForClover(customer?.phone || customer?.phoneNumber),
  };
}
