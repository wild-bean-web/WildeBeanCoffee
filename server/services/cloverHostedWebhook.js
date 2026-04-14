import crypto from "crypto";
import { User, HostedCheckoutDraft } from "../models/index.js";
import { placeOnlineOrder } from "./onlineOrderPlacement.js";
import { notifyOrderOpsAlert } from "./orderOpsAlerts.js";

/**
 * Persist a placement failure so kitchen/admin queries can find stuck checkouts.
 * @param {string} checkoutSessionId
 * @param {string} reason
 * @param {object} [detail]
 */
export async function recordHostedCheckoutPlacementFailure(
  checkoutSessionId,
  reason,
  detail = null,
) {
  const parts = [reason];
  if (detail != null) {
    try {
      parts.push(JSON.stringify(detail).slice(0, 2000));
    } catch {
      parts.push(String(detail));
    }
  }
  const msg = parts.join(" — ").slice(0, 4000);
  await HostedCheckoutDraft.findOneAndUpdate(
    { checkoutSessionId },
    {
      $set: {
        lastPlacementError: msg,
        lastPlacementErrorAt: new Date(),
      },
    },
  ).catch(() => {});
}

/**
 * Verify Clover Hosted Checkout webhook `Clover-Signature` header.
 * @param {string} rawBodyString - Exact raw JSON string (must match signed bytes)
 * @param {string|undefined} cloverSignatureHeader - e.g. "t=1642599079,v1=abc..."
 * @param {string|undefined} secret - CLOVER_WEBHOOK_SECRET
 */
export function verifyCloverWebhookSignature(
  rawBodyString,
  cloverSignatureHeader,
  secret,
) {
  if (!secret) return true;
  if (!cloverSignatureHeader || !rawBodyString) return false;
  let t;
  let v1;
  for (const part of String(cloverSignatureHeader).split(",")) {
    const [k, v] = part.trim().split("=");
    if (k === "t") t = v;
    if (k === "v1") v1 = v;
  }
  if (!t || !v1) return false;
  const v1Hex = String(v1).trim().toLowerCase();
  const signed = `${t}.${rawBodyString}`;
  const expectedHex = crypto
    .createHmac("sha256", secret)
    .update(signed, "utf8")
    .digest("hex");
  try {
    if (expectedHex.length !== v1Hex.length) return false;
    return crypto.timingSafeEqual(
      Buffer.from(expectedHex, "utf8"),
      Buffer.from(v1Hex, "utf8"),
    );
  } catch {
    return false;
  }
}

/**
 * @returns {{ checkoutSessionId: string, paymentId: string | null } | null}
 */
export function parseHostedCheckoutPaymentApproved(body) {
  if (!body || typeof body !== "object") return null;
  const type = String(body.type ?? body.Type ?? "").toUpperCase();
  const status = String(body.status ?? body.Status ?? "").toUpperCase();
  if (type !== "PAYMENT" || status !== "APPROVED") return null;
  const sessionId = body.data ?? body.Data;
  if (sessionId == null || sessionId === "") return null;
  const paymentId = body.id ?? body.Id ?? null;
  return {
    checkoutSessionId: String(sessionId),
    paymentId: paymentId != null ? String(paymentId) : null,
  };
}

/**
 * Mark draft as payment-approved once Clover sends PAYMENT+APPROVED.
 * This is the gate used by recovery/kitchen alert logic to avoid unpaid orders.
 */
export async function markHostedCheckoutPaymentApproved(
  checkoutSessionId,
  paymentId = null,
) {
  await HostedCheckoutDraft.findOneAndUpdate(
    { checkoutSessionId },
    {
      $set: {
        paymentApprovedAt: new Date(),
        ...(paymentId ? { paymentId: String(paymentId) } : {}),
      },
    },
  ).catch(() => {});
}

/**
 * Create order from HostedCheckoutDraft when payment webhook fires (idempotent).
 */
export async function fulfillOrderFromHostedCheckoutWebhook(
  checkoutSessionId,
  { orderEventEmitter } = {},
) {
  const existing = await HostedCheckoutDraft.findOne({
    checkoutSessionId,
  }).lean();
  if (!existing?.orderDraft || typeof existing.orderDraft !== "object") {
    /* No draft row to attach lastPlacementError; ops alert is the paper trail. */
    await notifyOrderOpsAlert(
      `Hosted checkout APPROVED but no draft for session ${checkoutSessionId}. Customer may be paid with no order.`,
    );
    return { ok: false, reason: "no_draft" };
  }

  const draft = existing.orderDraft;

  let user = null;
  if (existing.userId) {
    user = await User.findById(existing.userId).select("-password");
  }

  const body = {
    ...draft,
    paymentStatus: "paid",
    paymentRef: checkoutSessionId,
  };

  const result = await placeOnlineOrder(body, user, {
    orderEventEmitter,
    skipPrint: false,
    hostedCheckoutPaidPlacementBypassPickupScheduling: true,
  });

  if (!result.ok) {
    console.error(
      "[CLOVER WEBHOOK] placeOnlineOrder failed:",
      checkoutSessionId,
      result,
    );
    await recordHostedCheckoutPlacementFailure(
      checkoutSessionId,
      "placement_failed",
      result,
    );
    await notifyOrderOpsAlert(
      `Hosted checkout placement FAILED session=${checkoutSessionId} detail=${JSON.stringify(result).slice(0, 500)}`,
    );
    return { ok: false, reason: "placement_failed", detail: result };
  }

  return { ok: true, order: result.order, idempotent: result.idempotent };
}
