import express from "express";
import { processPayment, printReceipt, createHostedCheckoutSession } from "../services/clover.js";
import {
  errorResponse,
  isValidEmail,
  normalizeEmailForPayment,
} from "../utils/validation.js";
import { optionalAuth } from "../middleware/auth.js";
import { HostedCheckoutDraft } from "../models/index.js";
import { validateOrderPayload } from "../services/onlineOrderPlacement.js";
import { orderEventEmitter } from "../services/orderEvents.js";
import {
  verifyCloverWebhookSignature,
  parseHostedCheckoutPaymentApproved,
  markHostedCheckoutPaymentApproved,
  fulfillOrderFromHostedCheckoutWebhook,
} from "../services/cloverHostedWebhook.js";

const router = express.Router();

/**
 * POST /api/payments/process
 * Process a payment through Clover
 * Body: { amount, source, orderId?, currency? }
 */
router.post("/process", async (req, res, next) => {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('[PAYMENT ROUTE] ========== PAYMENT REQUEST RECEIVED ==========');
  console.log('[PAYMENT ROUTE] Step 7: Request received at /api/payments/process');
  console.log('[PAYMENT ROUTE] Request details:', JSON.stringify({
    method: req.method,
    url: req.url,
    ip: req.ip,
    timestamp: new Date().toISOString(),
  }, null, 2));

  try {
    const { amount, source, orderId, currency = "USD" } = req.body;

    console.log('[PAYMENT ROUTE] Step 8: Parsing request body');
    console.log('[PAYMENT ROUTE] Request body received:', JSON.stringify({
      amount: amount,
      amountType: typeof amount,
      source: source ? source.substring(0, 30) + '... (length: ' + source.length + ')' : 'MISSING',
      orderId: orderId || 'N/A',
      currency: currency || 'USD (default)',
    }, null, 2));
    console.log('[PAYMENT ROUTE] Full request body:', JSON.stringify(req.body, null, 2));

    // Validation
    console.log('[PAYMENT ROUTE] Step 9: Validating request parameters');
    if (!amount || amount <= 0) {
      console.error('[PAYMENT ROUTE] ❌ Validation FAILED: Invalid amount', JSON.stringify({ amount }, null, 2));
      return errorResponse(res, 400, "Valid payment amount is required");
    }
    console.log('[PAYMENT ROUTE] ✅ Amount validation passed:', amount);

    if (!source) {
      console.error('[PAYMENT ROUTE] ❌ Validation FAILED: Missing source token');
      return errorResponse(res, 400, "Payment source token is required");
    }
    console.log('[PAYMENT ROUTE] ✅ Source token validation passed');

    // Process payment
    const amountInCents = Math.round(amount * 100);
    console.log('[PAYMENT ROUTE] Step 10: Preparing payment data');
    console.log('[PAYMENT ROUTE] Amount conversion:', JSON.stringify({
      original: amount,
      converted: amountInCents,
      inCents: true,
    }, null, 2));

    const paymentData = {
      amount: amountInCents,
      source,
      orderId,
      currency,
    };

    console.log('[PAYMENT ROUTE] Payment data to send to service:', JSON.stringify({
      amount: paymentData.amount,
      amountInDollars: (paymentData.amount / 100).toFixed(2),
      source: paymentData.source.substring(0, 30) + '...',
      orderId: paymentData.orderId || 'N/A',
      currency: paymentData.currency,
    }, null, 2));

    console.log('[PAYMENT ROUTE] Step 11: Calling processPayment service');
    const result = await processPayment(paymentData);

    console.log('[PAYMENT ROUTE] Step 12: Payment service returned result');
    console.log('[PAYMENT ROUTE] Payment result:', JSON.stringify(result, null, 2));
    console.log('[PAYMENT ROUTE] Step 13: Sending response to client');
    console.log('[PAYMENT ROUTE] Response status: 200 OK');
    console.log('[PAYMENT ROUTE] ========== PAYMENT REQUEST COMPLETE ==========');
    console.log('═══════════════════════════════════════════════════════════');

    res.json({ data: result });
  } catch (err) {
    console.error('[PAYMENT ROUTE] ❌ PAYMENT PROCESSING ERROR:', err.message);
    console.error('[PAYMENT ROUTE] Error details:', JSON.stringify({
      message: err.message,
      stack: err.stack,
      name: err.name,
    }, null, 2));
    console.error('[PAYMENT ROUTE] ========== PAYMENT REQUEST FAILED ==========');
    console.log('═══════════════════════════════════════════════════════════');
    next(err);
  }
});

/**
 * POST /api/payments/create-checkout
 * Create a Hosted Checkout session
 * Body: { items, customer, amount, successUrl, failureUrl, cancelUrl, taxRate?, currency? }
 */
router.post("/create-checkout", optionalAuth, async (req, res, next) => {
  console.log("[PAYMENT ROUTE] ========== CREATE CHECKOUT SESSION ==========");
  console.log("[PAYMENT ROUTE] Request received at /api/payments/create-checkout");
  
  try {
    const {
      items,
      customer,
      amount,
      successUrl,
      failureUrl,
      cancelUrl,
      taxRate,
      currency = "USD",
      tipAmountCents: tipAmountCentsRaw = 0,
      orderDraft,
    } = req.body;

    console.log("[PAYMENT ROUTE] Request data:", JSON.stringify({
      itemCount: items?.length || 0,
      customerEmail: customer?.email || "N/A",
      amount: amount,
      amountInDollars: amount ? (amount / 100).toFixed(2) : "N/A",
      taxRate: taxRate || 0,
      currency: currency,
    }, null, 2));

    // Validation
    if (!items || items.length === 0) {
      return errorResponse(res, 400, "Items are required");
    }

    const firstName = (customer?.firstName || "").trim();
    const emailRaw = (customer?.email || "").trim();
    const email = normalizeEmailForPayment(emailRaw);
    if (!customer || !firstName || !emailRaw) {
      return errorResponse(
        res,
        400,
        "Customer information (first name and email) is required"
      );
    }
    if (!email || !isValidEmail(email)) {
      return errorResponse(res, 400, "Please enter a valid email address.", [
        "email",
      ]);
    }

    if (!amount || amount <= 0) {
      return errorResponse(res, 400, "Valid payment amount is required");
    }

    const tipAmountCents = Math.max(0, Math.round(Number(tipAmountCentsRaw) || 0));
    const tr = Number(taxRate) || 0;
    const foodSubtotalCents = items.reduce((sum, item) => {
      const unit = Math.round((Number(item.price) || 0) * 100);
      const qty = Math.max(1, Number(item.quantity) || 1);
      return sum + unit * qty;
    }, 0);
    const taxCents = Math.round(foodSubtotalCents * tr);
    const expectedCents = foodSubtotalCents + taxCents + tipAmountCents;
    if (Math.abs(Math.round(amount) - expectedCents) > 1) {
      return errorResponse(
        res,
        400,
        "Payment amount does not match items, tax, and tip",
        ["amount"],
      );
    }

    if (!successUrl || !failureUrl || !cancelUrl) {
      return errorResponse(res, 400, "Success, failure, and cancel URLs are required");
    }

    if (!orderDraft || typeof orderDraft !== "object") {
      return errorResponse(res, 400, "orderDraft is required", ["orderDraft"]);
    }

    const draft = { ...orderDraft };
    delete draft.checkoutId;
    if (draft.customer && typeof draft.customer === "object") {
      draft.customer = { ...draft.customer, email };
    }
    const draftErrors = validateOrderPayload({
      ...draft,
      paymentStatus: "paid",
      paymentRef: "hosted-checkout-pending",
    });
    if (draftErrors.length) {
      return errorResponse(res, 400, "Invalid order draft", draftErrors);
    }

    // Create checkout session
    const checkoutSession = await createHostedCheckoutSession({
      items,
      customer: { ...customer, email },
      amount: Math.round(amount), // Ensure amount is in cents
      successUrl,
      failureUrl,
      cancelUrl,
      taxRate: taxRate || 0,
      currency,
      tipAmountCents,
    });

    console.log("[PAYMENT ROUTE] ✅ Checkout session created");
    console.log("[PAYMENT ROUTE] Checkout URL:", checkoutSession.checkoutUrl);
    try {
      await HostedCheckoutDraft.findOneAndUpdate(
        { checkoutSessionId: checkoutSession.checkoutId },
        {
          $set: {
            orderDraft: draft,
            userId: req.user?._id || null,
            amountCents: Math.round(amount),
            status: "pending",
            paymentApprovedAt: null,
            paymentId: null,
          },
        },
        { upsert: true },
      );
    } catch (draftErr) {
      console.error("[PAYMENT ROUTE] Failed to persist checkout draft:", draftErr);
      return errorResponse(
        res,
        500,
        "Could not save checkout; try again or contact support.",
      );
    }

    res.json({ data: checkoutSession });
  } catch (err) {
    console.error("[PAYMENT ROUTE] ❌ Error creating checkout session:", err.message);
    console.error("[PAYMENT ROUTE] Error details:", JSON.stringify({
      message: err.message,
      stack: err.stack,
      name: err.name,
    }, null, 2));
    next(err);
  }
});

/**
 * POST /api/payments/print-receipt
 * Print a receipt for an order (called after order creation)
 * Body: { orderId, printerId? }
 */
router.post("/print-receipt", async (req, res, next) => {
  try {
    const { orderId, printerId } = req.body;

    if (!orderId) {
      return errorResponse(res, 400, "Order ID is required");
    }

    // Import Order model dynamically to avoid circular dependencies
    const { Order } = await import("../models/index.js");
    const order = await Order.findById(orderId).lean();

    if (!order) {
      return errorResponse(res, 404, "Order not found");
    }

    // Attempt to print receipt
    const printResult = await printReceipt(order, printerId);

    // Return result (don't fail if printing fails)
    res.json({
      data: {
        success: printResult.success,
        message: printResult.success
          ? "Receipt sent to printer"
          : `Receipt printing failed: ${printResult.error}`,
        ...printResult,
      },
    });
  } catch (err) {
    console.error("Print receipt error:", err);
    // Don't fail the request if printing fails
    res.json({
      data: {
        success: false,
        message: `Receipt printing error: ${err.message}`,
      },
    });
  }
});

/**
 * POST /api/payments/webhook
 * Clover Hosted Checkout: PAYMENT + APPROVED → create order from HostedCheckoutDraft (idempotent).
 * Requires raw body on req.rawBody (see server index express.json verify).
 */
router.post("/webhook", async (req, res) => {
  console.log("[PAYMENT ROUTE] ========== WEBHOOK RECEIVED ==========");

  try {
    const rawString =
      req.rawBody instanceof Buffer
        ? req.rawBody.toString("utf8")
        : typeof req.body === "object" && req.body !== null
          ? JSON.stringify(req.body)
          : String(req.body || "");

    const secret = process.env.CLOVER_WEBHOOK_SECRET;
    const sigHeader =
      req.headers["clover-signature"] ||
      req.headers["Clover-Signature"] ||
      req.headers["x-clover-signature"];

    if (
      secret &&
      !verifyCloverWebhookSignature(rawString, sigHeader, secret)
    ) {
      console.error("[PAYMENT ROUTE] Webhook signature verification failed");
      return res.status(401).json({ error: "Invalid webhook signature" });
    }

    let webhookPayload = req.body;
    if (!webhookPayload || typeof webhookPayload !== "object") {
      try {
        webhookPayload = JSON.parse(rawString);
      } catch {
        return res.status(400).json({ error: "Invalid JSON" });
      }
    }

    console.log(
      "[PAYMENT ROUTE] Webhook payload:",
      JSON.stringify(webhookPayload, null, 2),
    );

    const approved = parseHostedCheckoutPaymentApproved(webhookPayload);
    if (approved) {
      await markHostedCheckoutPaymentApproved(
        approved.checkoutSessionId,
        approved.paymentId,
      );
      const result = await fulfillOrderFromHostedCheckoutWebhook(
        approved.checkoutSessionId,
        { orderEventEmitter },
      );
      console.log(
        "[PAYMENT ROUTE] Hosted checkout fulfill:",
        approved.checkoutSessionId,
        result,
      );
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error("[PAYMENT ROUTE] Webhook error:", err);
    res.status(200).json({ received: true, error: err.message });
  }
});

export default router;

