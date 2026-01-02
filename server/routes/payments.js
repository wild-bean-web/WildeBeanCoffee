import express from "express";
import { processPayment, printReceipt, createHostedCheckoutSession } from "../services/clover.js";
import { errorResponse } from "../utils/validation.js";

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
router.post("/create-checkout", async (req, res, next) => {
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

    if (!customer || !customer.firstName || !customer.lastName || !customer.email) {
      return errorResponse(res, 400, "Customer information (firstName, lastName, email) is required");
    }

    if (!amount || amount <= 0) {
      return errorResponse(res, 400, "Valid payment amount is required");
    }

    if (!successUrl || !failureUrl || !cancelUrl) {
      return errorResponse(res, 400, "Success, failure, and cancel URLs are required");
    }

    // Create checkout session
    const checkoutSession = await createHostedCheckoutSession({
      items,
      customer,
      amount: Math.round(amount), // Ensure amount is in cents
      successUrl,
      failureUrl,
      cancelUrl,
      taxRate: taxRate || 0,
      currency,
    });

    console.log("[PAYMENT ROUTE] ✅ Checkout session created");
    console.log("[PAYMENT ROUTE] Checkout URL:", checkoutSession.checkoutUrl);

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
 * Handle Clover webhook notifications for payment events
 * Body: Webhook payload from Clover
 */
router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  console.log("[PAYMENT ROUTE] ========== WEBHOOK RECEIVED ==========");
  console.log("[PAYMENT ROUTE] Webhook headers:", JSON.stringify(req.headers, null, 2));
  
  try {
    const webhookPayload = JSON.parse(req.body.toString());
    console.log("[PAYMENT ROUTE] Webhook payload:", JSON.stringify(webhookPayload, null, 2));

    // TODO: Verify webhook signature if CLOVER_WEBHOOK_SECRET is configured
    // const signature = req.headers['clover-signature'];
    // if (signature && CLOVER_WEBHOOK_SECRET) {
    //   // Verify signature
    // }

    // Handle different webhook event types
    const eventType = webhookPayload.type || webhookPayload.eventType;
    console.log("[PAYMENT ROUTE] Event type:", eventType);

    switch (eventType) {
      case "payment.succeeded":
      case "charge.succeeded":
        console.log("[PAYMENT ROUTE] Payment succeeded webhook");
        // Payment was successful - order should already be created via redirect
        // This is just for confirmation/logging
        break;
      
      case "payment.failed":
      case "charge.failed":
        console.log("[PAYMENT ROUTE] Payment failed webhook");
        // Payment failed - log for review
        break;
      
      default:
        console.log("[PAYMENT ROUTE] Unknown webhook event type:", eventType);
    }

    // Always return 200 to acknowledge receipt
    res.status(200).json({ received: true });
  } catch (err) {
    console.error("[PAYMENT ROUTE] Webhook error:", err);
    // Still return 200 to prevent Clover from retrying
    res.status(200).json({ received: true, error: err.message });
  }
});

export default router;

