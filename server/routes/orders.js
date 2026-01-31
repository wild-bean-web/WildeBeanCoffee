import express from "express";
import mongoose from "mongoose";
import { Order } from "../models/index.js";
import { errorResponse, isObjectId } from "../utils/validation.js";
import { optionalAuth } from "../middleware/auth.js";
import { EventEmitter } from "events";

const router = express.Router();

// Event emitter for real-time order updates
export const orderEventEmitter = new EventEmitter();

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
  // Exception: Admin orders with ADMIN_DISCOUNT paymentRef don't need actual payment
  const isAdminOrder = paymentRef === "ADMIN_DISCOUNT";
  if (paymentStatus !== "paid") {
    errors.push("Payment must be completed before order can be created. paymentStatus must be 'paid'");
  }

  // If payment is paid, paymentRef should be provided (unless it's an admin order)
  if (paymentStatus === "paid" && !paymentRef && !isAdminOrder) {
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
    
    // Check if this is an admin order (paymentRef === "ADMIN_DISCOUNT")
    const isAdminOrder = paymentRef === "ADMIN_DISCOUNT";
    
    // Calculate totals - apply 100% discount for admin orders
    let totals = computeTotals(items, taxRate);
    if (isAdminOrder) {
      totals = {
        subtotal: totals.subtotal,
        tax: totals.tax,
        total: 0, // Admin orders are free
        currency: totals.currency,
      };
    }

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

    // Emit event for real-time dashboard updates
    orderEventEmitter.emit("order:created", order);

    res.status(201).json({ data: order });
  } catch (err) {
    next(err);
  }
});

// GET /api/orders/kitchen
// Get orders for kitchen dashboard (paid orders that are not completed or cancelled)
// Must be before /:id route to avoid conflicts
router.get("/kitchen", async (req, res, next) => {
  try {
    const orders = await Order.find({
      paymentStatus: "paid",
      status: { $nin: ["completed", "cancelled"] },
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ data: orders });
  } catch (err) {
    next(err);
  }
});

// GET /api/orders/kitchen/previous
// Get completed (picked up) orders for previous orders page
// Supports date filtering via query params: ?date=YYYY-MM-DD
// Supports show all via query params: ?all=true
router.get("/kitchen/previous", async (req, res, next) => {
  try {
    const { date, all } = req.query;
    
    const query = {
      paymentStatus: "paid",
      status: "completed",
    };

    // If "all" is true, don't filter by date - show all completed orders
    if (all === "true") {
      // No date filtering, just get all completed orders
    } else if (date) {
      // If date is provided, filter by that date
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      // Filter by updatedAt (when it was marked as completed) or createdAt
      // Use $or to match orders that were either completed on this date or created on this date
      query.$or = [
        { updatedAt: { $gte: startOfDay, $lte: endOfDay } },
        { createdAt: { $gte: startOfDay, $lte: endOfDay } },
      ];
    } else {
      // Default to today if no date specified and "all" is not true
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);
      
      query.$or = [
        { updatedAt: { $gte: today, $lte: endOfToday } },
        { createdAt: { $gte: today, $lte: endOfToday } },
      ];
    }

    const orders = await Order.find(query)
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();

    res.json({ data: orders });
  } catch (err) {
    next(err);
  }
});

// GET /api/orders/kitchen/stream
// Server-Sent Events endpoint for real-time order updates
router.get("/kitchen/stream", (req, res) => {
  // Set headers for SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering

  // Send initial connection message
  res.write(`: connected\n\n`);

  // Event handlers
  const onOrderCreated = (order) => {
    res.write(`event: order:created\n`);
    res.write(`data: ${JSON.stringify(order)}\n\n`);
  };

  const onOrderUpdated = (order) => {
    res.write(`event: order:updated\n`);
    res.write(`data: ${JSON.stringify(order)}\n\n`);
  };

  // Register event listeners
  orderEventEmitter.on("order:created", onOrderCreated);
  orderEventEmitter.on("order:updated", onOrderUpdated);

  // Send heartbeat every 30 seconds to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(`: heartbeat\n\n`);
  }, 30000);

  // Cleanup on client disconnect
  req.on("close", () => {
    clearInterval(heartbeat);
    orderEventEmitter.off("order:created", onOrderCreated);
    orderEventEmitter.off("order:updated", onOrderUpdated);
    res.end();
  });
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

    // Emit event for real-time dashboard updates
    orderEventEmitter.emit("order:updated", order);

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

