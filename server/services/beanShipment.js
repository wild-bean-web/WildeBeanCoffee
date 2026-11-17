import { Product } from "../models/index.js";
import {
  BAG_PRICE_USD,
  applyShipmentCoupon,
  quoteShipment,
  validateShippingAddress,
} from "../config/shipping.js";

function yirgacheffeLine(items) {
  if (!Array.isArray(items) || items.length !== 1) {
    return { ok: false, message: "A shipped order must contain one bag of Ethiopian Yirgacheffe." };
  }
  const line = items[0] || {};
  if (line.itemType && line.itemType !== "product") {
    return { ok: false, message: "Only whole-bean bags can be shipped." };
  }
  if (!/yirgacheffe/i.test(line.name || "")) {
    return { ok: false, message: "Only Ethiopian Yirgacheffe can be shipped." };
  }
  const quote = quoteShipment(line.quantity);
  if (!quote.ok) return { ok: false, message: quote.error };
  return { ok: true, line, quote };
}

async function findYirgacheffe() {
  return Product.findOne({ active: true, name: /yirgacheffe/i }).lean();
}

/**
 * Price a shipment from the catalog. Stock is enforced only when checkout starts.
 * Paid placement still builds the order if the product record changed afterward.
 */
export async function quoteStoredShipment(items, { requireStock = false, couponCode = "" } = {}) {
  const parsed = yirgacheffeLine(items);
  if (!parsed.ok) return { ok: false, status: 400, message: parsed.message };
  const quoted = applyShipmentCoupon(parsed.quote, couponCode);
  if (!quoted.ok) return { ok: false, status: 400, message: quoted.error };
  parsed.quote = quoted;

  const product = await findYirgacheffe();
  if (requireStock) {
    if (!product || product.inStock === false) {
      return {
        ok: false,
        status: 400,
        message: "Ethiopian Yirgacheffe is not available to ship right now.",
      };
    }
    if (
      typeof product.inventory === "number" &&
      product.inventory < parsed.quote.quantity
    ) {
      return {
        ok: false,
        status: 400,
        message:
          product.inventory < 1
            ? "Ethiopian Yirgacheffe is sold out for shipping."
            : `Only ${product.inventory} bags are left to ship.`,
      };
    }
  }

  if (
    product &&
    parsed.line.itemId &&
    String(parsed.line.itemId) !== String(product._id)
  ) {
    return { ok: false, status: 400, message: "Only Ethiopian Yirgacheffe can be shipped." };
  }

  const itemId = product?._id || parsed.line.itemId;
  if (!itemId) {
    return {
      ok: false,
      status: 400,
      message: "Ethiopian Yirgacheffe is not available to ship right now.",
    };
  }

  const orderItem = {
    itemType: "product",
    itemId,
    name: "Ethiopian Yirgacheffe",
    price: BAG_PRICE_USD,
    quantity: parsed.quote.quantity,
    modifiers: [],
    modifierTotal: 0,
  };

  const coffeeCents = parsed.quote.subtotalCents - parsed.quote.discountCents;
  const cloverItems = [
    parsed.quote.discountCents > 0
      ? {
          name: `Ethiopian Yirgacheffe 12 oz × ${parsed.quote.quantity}`,
          quantity: 1,
          price: coffeeCents / 100,
          note: `Coupon ${parsed.quote.couponCode}, ${parsed.quote.percentOff}% off coffee`,
        }
      : {
          name: "Ethiopian Yirgacheffe 12 oz",
          quantity: parsed.quote.quantity,
          price: BAG_PRICE_USD,
        },
  ];
  if (parsed.quote.shippingCents > 0) {
    cloverItems.push({
      name: "UPS Ground shipping",
      quantity: 1,
      price: parsed.quote.shipping,
    });
  }

  return {
    ok: true,
    items: [orderItem],
    ...parsed.quote,
    cloverItems,
  };
}

/**
 * @returns {Promise<null | { ok: true, cloverItems, amountCents, orderDraft } | { ok: false, status, message, errors? }>}
 */
export async function prepareBeanShipmentCheckout({
  items,
  amount,
  taxRate,
  tipAmountCents,
  orderDraft,
}) {
  if (orderDraft?.fulfillment !== "ship") return null;

  if (Number(tipAmountCents) > 0 || Number(orderDraft.tip) > 0) {
    return { ok: false, status: 400, message: "Tips are not collected on shipped bean orders." };
  }
  if (Number(taxRate) > 0 || Number(orderDraft.taxRate) > 0) {
    return { ok: false, status: 400, message: "Shipped whole-bean orders are not taxed." };
  }

  const shipping = validateShippingAddress(orderDraft.shipping);
  if (!shipping.ok) {
    return { ok: false, status: 400, message: shipping.errors[0], errors: shipping.errors };
  }

  const source = Array.isArray(orderDraft.items) && orderDraft.items.length
    ? orderDraft.items
    : items;
  const priced = await quoteStoredShipment(source, {
    requireStock: true,
    couponCode: orderDraft.couponCode,
  });
  if (!priced.ok) return priced;

  if (Math.round(Number(amount)) !== priced.totalCents) {
    return {
      ok: false,
      status: 400,
      message: "Payment amount does not match the bag price and shipping.",
    };
  }

  const draft = {
    ...orderDraft,
    fulfillment: "ship",
    items: priced.items,
    taxRate: 0,
    couponCode: priced.couponCode || "",
    shipping: {
      ...shipping.address,
      name:
        shipping.address.name ||
        [orderDraft.customer?.name].filter(Boolean).join(" "),
    },
  };
  delete draft.pickupTime;
  delete draft.tip;
  delete draft.tipStyle;
  delete draft.beanStampsRedeemCartKey;
  delete draft.pickupUiHints;

  return {
    ok: true,
    cloverItems: priced.cloverItems,
    amountCents: priced.totalCents,
    orderDraft: draft,
  };
}
