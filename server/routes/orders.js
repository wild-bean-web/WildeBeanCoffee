import express from "express";
import mongoose from "mongoose";
import { Order } from "../models/index.js";
import { errorResponse, isObjectId } from "../utils/validation.js";
import { optionalAuth, authenticate, authenticateWithQueryToken } from "../middleware/auth.js";
import { EventEmitter } from "events";

const router = express.Router();

const KITCHEN_ADMIN_EMAILS = ["danielwoldehana@yahoo.com", "wildbeancoffeellc@gmail.com"];

function requireKitchenAdmin(req, res, next) {
  if (!req.user) {
    return errorResponse(res, 401, "Authentication required");
  }
  const email = (req.user.email || "").toLowerCase();
  if (!KITCHEN_ADMIN_EMAILS.includes(email)) {
    return errorResponse(res, 403, "Access denied. Kitchen dashboard is restricted to authorized users.");
  }
  next();
}

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
// Admin comped orders (ADMIN_DISCOUNT) allowed only for authenticated admin users
router.post("/", optionalAuth, async (req, res, next) => {
  try {
    const errors = validateOrderPayload(req.body);
    if (errors.length) {
      return errorResponse(res, 400, "Validation failed", errors);
    }

    const { customer, items, pickupTime, taxRate = 0, notes, paymentRef, paymentStatus } =
      req.body;

    const isAdminOrder = paymentRef === "ADMIN_DISCOUNT";
    if (isAdminOrder) {
      if (!req.user) {
        return errorResponse(res, 401, "Authentication required for admin orders");
      }
      const adminEmail = (req.user.email || "").toLowerCase();
      if (!KITCHEN_ADMIN_EMAILS.includes(adminEmail)) {
        return errorResponse(res, 403, "Only authorized admins can place comped orders");
      }
    }

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
// Must be before /:id route to avoid conflicts. Requires admin auth.
router.get("/kitchen", authenticate, requireKitchenAdmin, async (req, res, next) => {
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
// Get completed (picked up) orders for previous orders page. Requires admin auth.
// Supports date range: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
// Legacy single date: ?date=YYYY-MM-DD
// Show all: ?all=true
router.get("/kitchen/previous", authenticate, requireKitchenAdmin, async (req, res, next) => {
  try {
    const { date, startDate, endDate, all } = req.query;

    const query = {
      paymentStatus: "paid",
      status: "completed",
    };

    if (all === "true") {
      // No date filtering
    } else if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.$or = [
        { updatedAt: { $gte: start, $lte: end } },
        { createdAt: { $gte: start, $lte: end } },
      ];
    } else if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      query.$or = [
        { updatedAt: { $gte: startOfDay, $lte: endOfDay } },
        { createdAt: { $gte: startOfDay, $lte: endOfDay } },
      ];
    } else {
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
// Server-Sent Events endpoint for real-time order updates. Requires admin auth.
// Token can be in query (?token=) since EventSource cannot send headers.
router.get("/kitchen/stream", authenticateWithQueryToken, requireKitchenAdmin, (req, res) => {
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

// PATCH /api/orders/:id/status (kitchen: mark ready / picked up). Requires admin auth.
router.patch("/:id/status", authenticate, requireKitchenAdmin, async (req, res, next) => {
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

