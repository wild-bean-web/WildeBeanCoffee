/** Canonical retail price for the only bag we ship. */
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

/** 48 contiguous states plus Washington, DC. Alaska and Hawaii are excluded. */
export const CONTIGUOUS_STATE_CODES = [
  "AL", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA",
  "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA",
  "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM",
  "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD",
  "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
];

const PO_BOX = /\b(?:p(?:ost)?\.?\s*o(?:ffice)?\.?\s*box|post\s+office\s+box)\b/i;

export function isPoBox(value) {
  return PO_BOX.test(String(value || ""));
}

export function quoteShipment(quantity) {
  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty < 1 || qty > MAX_SHIP_BAGS) {
    return {
      ok: false,
      error: `Quantity must be a whole number from 1 to ${MAX_SHIP_BAGS}.`,
    };
  }
  const unitCents = Math.round(BAG_PRICE_USD * 100);
  const subtotalCents = unitCents * qty;
  const shippingCents = shippingCentsForBags(qty);
  const totalCents = subtotalCents + shippingCents;
  return {
    ok: true,
    quantity: qty,
    unitCents,
    subtotalCents,
    shippingCents,
    taxCents: 0,
    totalCents,
    subtotal: subtotalCents / 100,
    shipping: shippingCents / 100,
    total: totalCents / 100,
    couponCode: "",
    percentOff: 0,
    discountCents: 0,
    discount: 0,
  };
}

/**
 * Percent off the coffee. Shipping stays at the quoted UPS Ground amount.
 * An empty code leaves the quote unchanged.
 */
export function applyShipmentCoupon(quote, code) {
  if (!quote?.ok) return quote;
  const couponCode = normalizeCouponCode(code);
  if (!couponCode) return quote;
  const percentOff = SHIPPING_COUPONS[couponCode];
  if (!percentOff) {
    return { ok: false, error: "That coupon code is not valid." };
  }
  const discountCents = Math.round((quote.subtotalCents * percentOff) / 100);
  const totalCents = quote.subtotalCents - discountCents + quote.shippingCents;
  return {
    ...quote,
    couponCode,
    percentOff,
    discountCents,
    discount: discountCents / 100,
    totalCents,
    total: totalCents / 100,
  };
}

/**
 * @param {object} input
 * @returns {{ ok: true, address: object } | { ok: false, errors: string[] }}
 */
export function validateShippingAddress(input) {
  const errors = [];
  const name = String(input?.name || "").trim();
  const digits = String(input?.phone || "").replace(/\D/g, "");
  const phone = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  const line1 = String(input?.line1 || "").trim();
  const line2 = String(input?.line2 || "").trim();
  const city = String(input?.city || "").trim();
  const state = String(input?.state || "").trim().toUpperCase();
  const postalCode = String(input?.postalCode || "").trim();

  if (name.length < 2) errors.push("Shipping name is required");
  if (phone.length !== 10) errors.push("Shipping phone must be a 10-digit US number");
  if (line1.length < 3) errors.push("Street address is required");
  if (isPoBox(line1) || isPoBox(line2)) {
    errors.push("UPS Ground does not deliver to P.O. Boxes");
  }
  if (line2.length > 40) errors.push("Apartment or unit is too long");
  if (city.length < 2) errors.push("City is required");
  if (!CONTIGUOUS_STATE_CODES.includes(state)) {
    errors.push("We ship to the 48 contiguous states and Washington, DC");
  }
  if (!/^\d{5}(?:-\d{4})?$/.test(postalCode)) {
    errors.push("Enter a 5-digit ZIP code");
  }

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    address: {
      name,
      phone,
      line1,
      line2,
      city,
      state,
      postalCode,
      country: "US",
    },
  };
}
