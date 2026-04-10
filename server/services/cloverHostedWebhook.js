import crypto from "crypto";
import { User, HostedCheckoutDraft } from "../models/index.js";
import { placeOnlineOrder } from "./onlineOrderPlacement.js";

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
  const signed = `${t}.${rawBodyString}`;
  const expectedHex = crypto
    .createHmac("sha256", secret)
    .update(signed, "utf8")
    .digest("hex");
  try {
    if (expectedHex.length !== v1.length) return false;
    return crypto.timingSafeEqual(
      Buffer.from(expectedHex, "utf8"),
      Buffer.from(v1, "utf8"),
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
  });

  if (!result.ok) {
    console.error(
      "[CLOVER WEBHOOK] placeOnlineOrder failed:",
      checkoutSessionId,
      result,
    );
    return { ok: false, reason: "placement_failed", detail: result };
  }

  return { ok: true, order: result.order, idempotent: result.idempotent };
}
