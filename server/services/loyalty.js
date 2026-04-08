import mongoose from "mongoose";
import { User, LoyaltyStampCredit } from "../models/index.js";
import {
  LOYALTY_STAMPS_PER_REWARD,
  LOYALTY_QUALIFY_MIN_TOTAL,
  LOYALTY_FREE_ITEM_MAX_PRE_TAX,
} from "../config/loyaltyConstants.js";
import { isBeanStampsEnabled } from "../config/featureFlags.js";

/** When true (default), ADMIN_DISCOUNT orders earn a stamp even at $0 total — for QA. Set BEAN_STAMPS_ADMIN_EARNS_STAMPS=false in production if you do not want that. */
export function isAdminBeanStampsTestModeEnabled() {
  const v = process.env.BEAN_STAMPS_ADMIN_EARNS_STAMPS;
  if (v === "false" || v === "0") return false;
  return true;
}

/**
 * Loyalty cycle from User (lean() or DB). null/undefined must become 0: Mongoose keeps
 * `cycle: null` in count queries (unlike undefined), so stamps with cycle 0 would not match.
 */
function normalizeLoyaltyCycle(raw) {
  if (raw === null || raw === undefined) return 0;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function computeTotalsFromItems(items, taxRate = 0) {
  let foodSubtotalCents = 0;
  for (const item of items) {
    const unit = Math.round(Number(item.price) * 100);
    const qty = Math.max(1, Number(item.quantity ?? 1));
    foodSubtotalCents += unit * qty;
  }
  const taxCents = Math.round(foodSubtotalCents * Number(taxRate) || 0);
  const subtotal = foodSubtotalCents / 100;
  const tax = taxCents / 100;
  const total = (foodSubtotalCents + taxCents) / 100;
  return { subtotal, tax, total, currency: "USD" };
}

/**
 * Deep-clone order items and apply up to $15 pre-tax discount on the line matching cartKey.
 * @returns {{ items: Array, loyaltyDiscountSubtotal: number, totals: object }}
 */
export function applyLoyaltyRedeemToItems(items, cartKey, taxRate) {
  if (!cartKey || !Array.isArray(items) || items.length === 0) {
    throw new Error("Invalid reward redemption: cart line not found.");
  }
  const cloned = JSON.parse(JSON.stringify(items));
  const idx = cloned.findIndex(
    (i) => String(i.cartKey || "") === String(cartKey || ""),
  );
  if (idx === -1) {
    throw new Error("Invalid reward redemption: selected item not found in order.");
  }
  const item = cloned[idx];
  const unitPrice = Number(item.price);
  const qty = Math.max(1, Number(item.quantity) || 1);
  if (Number.isNaN(unitPrice) || unitPrice < 0) {
    throw new Error("Invalid item price for reward redemption.");
  }
  const linePreTax = unitPrice * qty;
  const discount = Math.min(LOYALTY_FREE_ITEM_MAX_PRE_TAX, linePreTax);
  const newLinePreTax = Math.max(0, linePreTax - discount);
  const newUnitPrice = newLinePreTax / qty;
  item.price = Number(newUnitPrice.toFixed(4));
  const totals = computeTotalsFromItems(cloned, taxRate);
  return {
    items: cloned,
    loyaltyDiscountSubtotal: Number(discount.toFixed(2)),
    totals,
  };
}

export async function countActiveStampsInCycle(userId, cycle, session = null) {
  let q = LoyaltyStampCredit.countDocuments({
    userId,
    cycle,
    status: "active",
  });
  if (session) q = q.session(session);
  return q;
}

export async function assertUserHasFullStampCard(userId, session = null) {
  let uq = User.findById(userId);
  if (session) uq = uq.session(session);
  const user = await uq;
  if (!user) throw new Error("User not found.");
  const n = await countActiveStampsInCycle(
    userId,
    normalizeLoyaltyCycle(user.loyaltyCycle),
    session
  );
  if (n !== LOYALTY_STAMPS_PER_REWARD) {
    throw new Error(
      "Bean Stamps reward is not available yet. Collect 20 stamps before redeeming."
    );
  }
}

/**
 * After order is persisted: increment cycle if redeem; maybe grant new stamp.
 */
export async function processLoyaltyAfterPaidOrder({
  session,
  userId,
  orderId,
  totals,
  paymentStatus,
  paymentRef,
  loyaltyRedeemApplied,
}) {
  if (!isBeanStampsEnabled()) return;
  if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) return;
  if (paymentStatus !== "paid") return;

  const isAdminOrder = paymentRef === "ADMIN_DISCOUNT";
  if (isAdminOrder && !isAdminBeanStampsTestModeEnabled()) return;

  const subtotal = Number(totals?.subtotal);
  const tax = Number(totals?.tax);
  const preTipTotal =
    (Number.isFinite(subtotal) ? subtotal : 0) +
    (Number.isFinite(tax) ? tax : 0);
  if (!Number.isFinite(preTipTotal)) return;

  if (loyaltyRedeemApplied) {
    const uOpts = session ? { session } : {};
    await User.findByIdAndUpdate(userId, { $inc: { loyaltyCycle: 1 } }, uOpts);
  }

  let uq2 = User.findById(userId);
  if (session) uq2 = uq2.session(session);
  const user = await uq2;
  if (!user) return;

  const meetsMinTotal = preTipTotal >= LOYALTY_QUALIFY_MIN_TOTAL;
  const adminTestQualifies = isAdminOrder && isAdminBeanStampsTestModeEnabled();
  if (!meetsMinTotal && !adminTestQualifies) return;

  const cycleNum = normalizeLoyaltyCycle(user.loyaltyCycle);
  const stamps = await countActiveStampsInCycle(userId, cycleNum, session);
  if (stamps >= LOYALTY_STAMPS_PER_REWARD) return;

  const cOpts = session ? { session } : {};
  await LoyaltyStampCredit.create(
    [
      {
        userId,
        orderId,
        cycle: cycleNum,
        status: "active",
      },
    ],
    cOpts
  );
}

export async function revokeLoyaltyStampForOrder(orderId, session = null) {
  if (!mongoose.Types.ObjectId.isValid(String(orderId))) return;
  const oid = new mongoose.Types.ObjectId(String(orderId));
  let op = LoyaltyStampCredit.updateMany(
    { orderId: oid, status: "active" },
    { $set: { status: "revoked_cancel" } }
  );
  if (session) op = op.session(session);
  await op;
}

export async function getLoyaltySnapshotForUserId(userId) {
  if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
    return null;
  }
  const user = await User.findById(userId).select("loyaltyCycle").lean();
  if (!user) return null;
  const cycle = normalizeLoyaltyCycle(user.loyaltyCycle);
  const stamps = await LoyaltyStampCredit.countDocuments({
    userId,
    cycle,
    status: "active",
  });
  const rewardReady = stamps >= LOYALTY_STAMPS_PER_REWARD;
  const displayStamps = rewardReady ? LOYALTY_STAMPS_PER_REWARD : stamps;
  return {
    stamps: displayStamps,
    stampsRaw: stamps,
    rewardReady,
    cycle,
    stampsPerReward: LOYALTY_STAMPS_PER_REWARD,
    qualifyMinTotal: LOYALTY_QUALIFY_MIN_TOTAL,
    freeItemMaxPreTax: LOYALTY_FREE_ITEM_MAX_PRE_TAX,
  };
}
