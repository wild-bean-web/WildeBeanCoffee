import express from "express";
import mongoose from "mongoose";
import { Order } from "../models/index.js";
import { errorResponse, isObjectId } from "../utils/validation.js";
import { optionalAuth } from "../middleware/auth.js";

const router = express.Router();

const allowedStatuses = ["placed", "preparing", "ready", "completed", "cancelled"];
const allowedPaymentStatuses = ["pending", "authorized", "paid", "failed", "refunded"];

function computeTotals(items, taxRate = 0, currency = "USD") {
  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.price) * Number(item.quantity ?? 1),
    0
  );
  const tax = Number((subtotal * taxRate).toFixed(2));
  const total = Number((subtotal + tax).toFixed(2));
  return { subtotal, tax, total, currency };
}

function validateOrderPayload(body) {
  const errors = [];
  const { customer, items, pickupTime, taxRate, notes, paymentRef, paymentStatus } = body;

  if (!customer?.name) errors.push("customer.name is required");
  if (!customer?.phone) errors.push("customer.phone is required");

  if (!Array.isArray(items) || items.length === 0) {
    errors.push("items must be a non-empty array");
  } else {
    items.forEach((item, idx) => {
      if (!item.itemType || !["product", "menu"].includes(item.itemType)) {
        errors.push(`items[${idx}].itemType must be 'product' or 'menu'`);
      }
      if (!item.itemId) errors.push(`items[${idx}].itemId is required`);
      if (!item.name) errors.push(`items[${idx}].name is required`);
      if (item.price === undefined || Number(item.price) < 0)
        errors.push(`items[${idx}].price must be >= 0`);
      if (!item.quantity || Number(item.quantity) < 1)
        errors.push(`items[${idx}].quantity must be >= 1`);
    });
  }

  if (taxRate !== undefined && (Number(taxRate) < 0 || Number.isNaN(Number(taxRate)))) {
    errors.push("taxRate must be a non-negative number if provided");
  }

  if (paymentStatus && !allowedPaymentStatuses.includes(paymentStatus)) {
    errors.push(`paymentStatus must be one of ${allowedPaymentStatuses.join(", ")}`);
  }

  // Require payment to be completed before order can be created
  if (paymentStatus !== "paid") {
    errors.push("Payment must be completed before order can be created. paymentStatus must be 'paid'");
  }

  // If payment is paid, paymentRef should be provided
  if (paymentStatus === "paid" && !paymentRef) {
    errors.push("paymentRef is required when paymentStatus is 'paid'");
  }

  if (pickupTime && Number.isNaN(Date.parse(pickupTime))) {
    errors.push("pickupTime must be a valid date if provided");
  }

  return errors;
}

// POST /api/orders
// Use optionalAuth to support both authenticated and guest orders
router.post("/", optionalAuth, async (req, res, next) => {
  try {
    const errors = validateOrderPayload(req.body);
    if (errors.length) {
      return errorResponse(res, 400, "Validation failed", errors);
    }

    const { customer, items, pickupTime, taxRate = 0, notes, paymentRef, paymentStatus } =
      req.body;
    const totals = computeTotals(items, taxRate);

    // Check if user is authenticated (req.user is set by optionalAuth middleware if token is valid)
    // If no req.user, it's a guest order
    const isGuest = !req.user;
    const userId = req.user?._id || undefined;

    const order = await Order.create({
      userId,
      isGuest,
      customer,
      items,
      pickupTime,
      notes,
      paymentRef,
      paymentStatus: paymentStatus || "pending",
      status: "placed",
      totals,
    });

    // Attempt to print receipt if payment is successful (non-blocking)
    if (paymentStatus === "paid") {
      try {
        const { printReceipt } = await import("../services/clover.js");
        printReceipt(order).catch((err) => {
          console.error("Receipt printing failed for order:", order._id, err);
          // Don't fail the order creation if printing fails
        });
      } catch (err) {
        console.error("Failed to import printReceipt service:", err);
      }
    }

    res.status(201).json({ data: order });
  } catch (err) {
    next(err);
  }
});

// GET /api/orders/:id
router.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      return errorResponse(res, 400, "Invalid order id");
    }
    const order = await Order.findById(id).lean();
    if (!order) {
      return errorResponse(res, 404, "Order not found");
    }
    res.json({ data: order });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/orders/:id/status
router.patch("/:id/status", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, paymentStatus } = req.body;

    if (!isObjectId(id)) {
      return errorResponse(res, 400, "Invalid order id");
    }

    if (status && !allowedStatuses.includes(status)) {
      return errorResponse(
        res,
        400,
        `status must be one of ${allowedStatuses.join(", ")}`
      );
    }

    if (paymentStatus && !allowedPaymentStatuses.includes(paymentStatus)) {
      return errorResponse(
        res,
        400,
        `paymentStatus must be one of ${allowedPaymentStatuses.join(", ")}`
      );
    }

    const update = {};
    if (status) update.status = status;
    if (paymentStatus) update.paymentStatus = paymentStatus;

    if (!Object.keys(update).length) {
      return errorResponse(res, 400, "No valid fields to update");
    }

    const order = await Order.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true, runValidators: true }
    ).lean();

    if (!order) {
      return errorResponse(res, 404, "Order not found");
    }

    res.json({ data: order });
  } catch (err) {
    next(err);
  }
});

// POST /api/orders/webhook (stub)
router.post("/webhook", async (req, res) => {
  // TODO: verify signature once payment provider is integrated (e.g., Clover).
  console.log("Received webhook payload:", req.body);
  res.status(200).json({ received: true });
});

export default router;

