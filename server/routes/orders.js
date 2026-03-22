import express from "express";
import mongoose from "mongoose";
import { Order, Location, MenuItem } from "../models/index.js";
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

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Store timezone for business-hours comparison (e.g. America/New_York for MD). */
const STORE_TIMEZONE = process.env.STORE_TIMEZONE || "America/New_York";

const _leadParsed = parseInt(process.env.PICKUP_MIN_LEAD_MINUTES ?? "15", 10);
const PICKUP_MIN_LEAD_MINUTES =
  Number.isFinite(_leadParsed) && _leadParsed >= 0 ? _leadParsed : 15;

/** Reject pickup instants in the past or before minimum lead time from now. */
function validatePickupTimeMeetsMinimumLead(pickupTime) {
  if (!pickupTime) return null;
  const d = new Date(pickupTime);
  if (Number.isNaN(d.getTime())) return null;
  const leadMs = PICKUP_MIN_LEAD_MINUTES * 60 * 1000;
  if (d.getTime() < Date.now() + leadMs) {
    return `Pickup must be at least ${PICKUP_MIN_LEAD_MINUTES} minutes from now. Please choose a later pickup time.`;
  }
  return null;
}

/** Format "HH:mm" or "H:mm" as 12-hour e.g. "8:00 PM" for user-facing messages. */
function formatTime12Hour(hhmm) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const ampm = h < 12 ? "AM" : "PM";
  return `${hour12}:${String(m || 0).padStart(2, "0")} ${ampm}`;
}

/** Get hour and minute of a Date in the store timezone. */
function getHoursMinutesInStoreTz(date, timeZone = STORE_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const hour = parseInt(parts.find((p) => p.type === "hour").value, 10);
  const minute = parseInt(parts.find((p) => p.type === "minute").value, 10);
  return { hour, minute };
}

/** Get weekday name (e.g. "Monday") for a Date in the store timezone. */
function getDayNameInStoreTz(date, timeZone = STORE_TIMEZONE) {
  return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long" }).format(date);
}

/** Returns an error message if pickup time is outside store hours; otherwise null. */
async function validatePickupTimeWithinHours(pickupTime) {
  if (!pickupTime) return null;
  const date = new Date(pickupTime);
  if (Number.isNaN(date.getTime())) return null;

  const location = await Location.findOne({ active: true }).lean();
  if (!location?.hours?.length) return null;

  // Interpret pickup time in store timezone (e.g. America/New_York for MD).
  // The client sends ISO (UTC); server must compare to store hours in local store time.
  const dayName = getDayNameInStoreTz(date);
  const { hour: pickupHour, minute: pickupMinute } = getHoursMinutesInStoreTz(date);
  const dayHours = location.hours.find((h) => h.day === dayName);

  if (!dayHours?.closed && dayHours?.opens != null && dayHours?.closes != null) {
    const [openH, openM] = (dayHours.opens || "06:00").split(":").map(Number);
    const [closeH, closeM] = (dayHours.closes || "20:00").split(":").map(Number);
    const openMinutes = openH * 60 + (openM || 0);
    const closeMinutes = closeH * 60 + (closeM || 0);
    const pickupMinutes = pickupHour * 60 + pickupMinute;
    if (pickupMinutes < openMinutes) {
      return `Pickup time is before opening (${formatTime12Hour(dayHours.opens)}). Please choose a time when we're open.`;
    }
    if (pickupMinutes >= closeMinutes) {
      return `Pickup time is at or after closing (${formatTime12Hour(dayHours.closes)}). Please choose a time when we're open.`;
    }
  } else if (dayHours?.closed) {
    return "We're closed on that day. Please choose another pickup date.";
  }
  return null;
}

/** Reject if any menu item is in-store only (onlineOrderable: false). */
async function validateMenuItemsOnlineOrderable(items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  const menuIds = items
    .filter((i) => i.itemType === "menu" && i.itemId)
    .map((i) => i.itemId);
  if (menuIds.length === 0) return null;
  const objectIds = menuIds.map((id) =>
    mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null
  ).filter(Boolean);
  if (objectIds.length === 0) return null;
  const docs = await MenuItem.find({ _id: { $in: objectIds } })
    .select("name onlineOrderable")
    .lean();
  const byId = new Map(docs.map((d) => [d._id.toString(), d]));
  for (const line of items) {
    if (line.itemType !== "menu" || !line.itemId) continue;
    const doc = byId.get(String(line.itemId));
    if (doc && doc.onlineOrderable === false) {
      return `"${line.name || doc.name}" is only available in-store. Please remove it from your cart to complete your order.`;
    }
  }
  return null;
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

    const pickupLeadError = validatePickupTimeMeetsMinimumLead(pickupTime);
    if (pickupLeadError) {
      return errorResponse(res, 400, pickupLeadError, ["pickupTime"]);
    }

    const pickupTimeError = await validatePickupTimeWithinHours(pickupTime);
    if (pickupTimeError) {
      return errorResponse(res, 400, pickupTimeError, ["pickupTime"]);
    }

    const isAdminOrder = paymentRef === "ADMIN_DISCOUNT";
    if (!isAdminOrder) {
      const inStoreOnlyError = await validateMenuItemsOnlineOrderable(items);
      if (inStoreOnlyError) {
        return errorResponse(res, 400, inStoreOnlyError, ["items"]);
      }
    }
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

