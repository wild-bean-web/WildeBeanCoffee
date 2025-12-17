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
  try {
    const { amount, source, orderId, currency = "USD" } = req.body;

    // Validation
    if (!amount || amount <= 0) {
      return errorResponse(res, 400, "Valid payment amount is required");
    }

    if (!source) {
      return errorResponse(res, 400, "Payment source token is required");
    }

    // Process payment
    const result = await processPayment({
      amount: Math.round(amount * 100), // Convert to cents
      source,
      orderId,
      currency,
    });

    res.json({ data: result });
  } catch (err) {
    console.error("Payment processing error:", err);
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

