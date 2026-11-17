export const BAG_PRICE_USD = 17.53;
export const MAX_SHIP_BAGS = 6;
/** UPS Ground is free once the order reaches this many bags. */
export const FREE_SHIPPING_AT_BAGS = 5;

/** Percent off the coffee subtotal. Shipping is not discounted. */
export const SHIPPING_COUPONS = {
  DEVWBC: 90,
  WBCLYTY: 15,
};

export function normalizeCouponCode(code) {
  return String(code || "").trim().toUpperCase();
}

/**
 * UPS Ground for the whole order, in cents.
 * 1 bag $6.95, 2–3 bags $7.95, 4 bags $9.95, 5 or more free.
 */
export function shippingCentsForBags(quantity) {
  if (quantity >= FREE_SHIPPING_AT_BAGS) return 0;
  if (quantity === 4) return 995;
  if (quantity >= 2) return 795;
  return 695;
}

export const CONTIGUOUS_STATE_CODES = [
  "AL", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA",
  "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA",
  "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM",
  "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD",
  "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
];

const PO_BOX = /\b(?:p(?:ost)?\.?\s*o(?:ffice)?\.?\s*box|post\s+office\s+box)\b/i;

export function formatUsd(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function quoteShipment(quantity) {
  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty < 1 || qty > MAX_SHIP_BAGS) return null;
  const subtotal = Math.round(BAG_PRICE_USD * 100 * qty) / 100;
  const shipping = shippingCentsForBags(qty) / 100;
  const total = Math.round((subtotal + shipping) * 100) / 100;
  return { quantity: qty, subtotal, shipping, total, couponCode: "", percentOff: 0, discount: 0 };
}

/** Percent off the coffee. An unknown code returns null. An empty code leaves the quote unchanged. */
export function applyShipmentCoupon(quote, code) {
  if (!quote) return null;
  const couponCode = normalizeCouponCode(code);
  if (!couponCode) return quote;
  const percentOff = SHIPPING_COUPONS[couponCode];
  if (!percentOff) return null;
  const subtotalCents = Math.round(quote.subtotal * 100);
  const shippingCents = Math.round(quote.shipping * 100);
  const discountCents = Math.round((subtotalCents * percentOff) / 100);
  const totalCents = subtotalCents - discountCents + shippingCents;
  return {
    ...quote,
    couponCode,
    percentOff,
    discount: discountCents / 100,
    total: totalCents / 100,
  };
}

export function validateShipForm(form) {
  const errors = {};
  if (!form.firstName?.trim()) errors.firstName = "First name is required";
  if (!form.lastName?.trim() || form.lastName.trim().length < 2 || form.lastName.trim() === ".") {
    errors.lastName = "Last name is required";
  }
  const digits = String(form.phone || "").replace(/\D/g, "");
  const phone = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (phone.length !== 10) errors.phone = "Enter a 10-digit phone number";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(form.email || "").trim())) {
    errors.email = "Enter a valid email address";
  }
  if (!form.line1?.trim() || form.line1.trim().length < 3) {
    errors.line1 = "Street address is required";
  }
  if (PO_BOX.test(form.line1 || "") || PO_BOX.test(form.line2 || "")) {
    errors.line1 = "UPS Ground does not deliver to P.O. Boxes";
  }
  if (!form.city?.trim() || form.city.trim().length < 2) errors.city = "City is required";
  if (!CONTIGUOUS_STATE_CODES.includes(String(form.state || "").toUpperCase())) {
    errors.state = "Choose a state in the contiguous US";
  }
  if (!/^\d{5}(?:-\d{4})?$/.test(String(form.postalCode || "").trim())) {
    errors.postalCode = "Enter a 5-digit ZIP code";
  }
  return errors;
}
