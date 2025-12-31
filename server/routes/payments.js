import express from "express";
import { processPayment, printReceipt, verifyPaymentToken } from "../services/clover.js";
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
 * POST /api/payments/verify-token
 * Verify a payment token from Clover iFrame
 * Body: { token }
 */
router.post("/verify-token", async (req, res, next) => {
  try {
    const { token } = req.body;

    if (!token) {
      return errorResponse(res, 400, "Payment token is required");
    }

    const result = await verifyPaymentToken(token);
    res.json({ data: result });
  } catch (err) {
    console.error("Token verification error:", err);
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

export default router;

