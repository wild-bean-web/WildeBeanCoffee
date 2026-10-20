import { HostedCheckoutDraft, Order, User } from "../models/index.js";
import { tryMarkHostedCheckoutPaidFromCloverPaymentLookup } from "./clover.js";
import {
  markHostedCheckoutPaymentApproved,
  recordHostedCheckoutPlacementFailure,
} from "./cloverHostedWebhook.js";
import { placeOnlineOrder } from "./onlineOrderPlacement.js";
import { notifyOrderOpsAlert } from "./orderOpsAlerts.js";
import { orderEventEmitter } from "./orderEvents.js";

const SWEEP_INTERVAL_MS = 2 * 60 * 1000;
const MIN_AGE_MS = 60 * 1000;
const MAX_AGE_MS = 36 * 60 * 60 * 1000;
const RETRY_ERROR_AFTER_MS = 10 * 60 * 1000;

let started = false;
let running = false;

/**
 * Create kitchen orders for website checkouts Clover already charged
 * when the payment webhook never saved the order.
 */
export async function reconcileUnfulfilledHostedCheckouts() {
  if (running) return { skipped: true };
  running = true;
  try {
    const now = Date.now();
    const drafts = await HostedCheckoutDraft.find({
      status: { $ne: "fulfilled" },
      createdAt: {
        $gte: new Date(now - MAX_AGE_MS),
        $lte: new Date(now - MIN_AGE_MS),
      },
      $or: [
        { lastPlacementError: { $in: [null, ""] } },
        { lastPlacementError: { $exists: false } },
        { lastPlacementErrorAt: { $lte: new Date(now - RETRY_ERROR_AFTER_MS) } },
      ],
    })
      .sort({ createdAt: 1 })
      .limit(20)
      .lean();

    let created = 0;
    for (const draft of drafts) {
      const saved = await recoverDraftIfPaid(draft);
      if (saved) created += 1;
    }
    if (created > 0) {
      console.log(
        `[hosted-checkout-reconcile] created ${created} kitchen order(s) from paid checkouts`,
      );
    }
    return { scanned: drafts.length, created };
  } finally {
    running = false;
  }
}

async function recoverDraftIfPaid(draft) {
  const checkoutId = String(draft.checkoutSessionId || "").trim();
  if (!checkoutId) return false;

  const existing = await Order.findOne({ paymentRef: checkoutId })
    .select("_id")
    .lean();
  if (existing) {
    await HostedCheckoutDraft.updateOne(
      { checkoutSessionId: checkoutId },
      { $set: { status: "fulfilled", fulfilledOrderId: existing._id } },
    );
    return false;
  }

  if (!draft.paymentApprovedAt) {
    const inferred = await tryMarkHostedCheckoutPaidFromCloverPaymentLookup(
      checkoutId,
      draft,
    );
    if (!inferred.ok) return false;
    await markHostedCheckoutPaymentApproved(checkoutId, inferred.paymentId);
  }

  let user = null;
  if (draft.userId) {
    user = await User.findById(draft.userId).select("-password");
  }

  const result = await placeOnlineOrder(
    {
      ...draft.orderDraft,
      paymentStatus: "paid",
      paymentRef: checkoutId,
    },
    user,
    {
      orderEventEmitter,
      hostedCheckoutPaidPlacementBypassPickupScheduling: true,
    },
  );

  if (!result.ok) {
    await recordHostedCheckoutPlacementFailure(checkoutId, "reconcile_failed", result);
    await notifyOrderOpsAlert(
      `hosted checkout reconcile FAILED session=${checkoutId} detail=${JSON.stringify(result).slice(0, 500)}`,
    );
    console.error(
      "[hosted-checkout-reconcile] placement failed",
      checkoutId,
      result.message || result.errors || result,
    );
    return false;
  }

  if (!result.idempotent) {
    console.log(
      `[hosted-checkout-reconcile] created kitchen order ${result.order?._id} for checkout ${checkoutId}`,
    );
    await notifyOrderOpsAlert(
      `hosted checkout reconcile created kitchen order for session=${checkoutId}`,
    );
  }
  return !result.idempotent;
}

export function startHostedCheckoutReconcile() {
  if (started || process.env.NODE_ENV === "test") return;
  started = true;
  const tick = () => {
    reconcileUnfulfilledHostedCheckouts().catch((err) => {
      console.error("[hosted-checkout-reconcile]", err?.message || err);
    });
  };
  setTimeout(tick, 15 * 1000);
  setInterval(tick, SWEEP_INTERVAL_MS);
  console.log(
    "[hosted-checkout-reconcile] watching paid website checkouts every 2 minutes",
  );
}
