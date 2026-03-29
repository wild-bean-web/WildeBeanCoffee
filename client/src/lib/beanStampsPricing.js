import { LOYALTY_FREE_ITEM_MAX_PRE_TAX } from "@/lib/loyaltyConstants";

/**
 * Apply Bean Stamps discount to a cart clone (same rules as server).
 * @param {Array} cartItems - cart lines with price, quantity, modifierTotal, cartKey
 * @param {string} redeemCartKey
 * @param {number} taxRate
 */
export function applyBeanStampsToCart(cartItems, redeemCartKey, taxRate) {
  const cart = JSON.parse(JSON.stringify(cartItems));
  const idx = cart.findIndex(
    (i) => String(i.cartKey || i._id) === String(redeemCartKey),
  );
  if (idx === -1) return null;
  const item = cart[idx];
  const unitPrice = Number(item.price) + Number(item.modifierTotal || 0);
  const qty = Math.max(1, Number(item.quantity) || 1);
  const linePreTax = unitPrice * qty;
  const discount = Math.min(LOYALTY_FREE_ITEM_MAX_PRE_TAX, linePreTax);
  const newLinePreTax = Math.max(0, linePreTax - discount);
  const newUnit = newLinePreTax / qty;
  item.price = Number(newUnit.toFixed(4));
  item.modifierTotal = 0;

  const subtotal = cart.reduce((sum, line) => {
    const u = Number(line.price) + Number(line.modifierTotal || 0);
    return sum + u * Number(line.quantity || 1);
  }, 0);
  const tax = Number((subtotal * taxRate).toFixed(2));
  const total = Number((subtotal + tax).toFixed(2));

  return {
    cart,
    loyaltyDiscountSubtotal: Number(discount.toFixed(2)),
    subtotal,
    tax,
    total,
  };
}
