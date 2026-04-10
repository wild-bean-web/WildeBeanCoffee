import express from "express";
import mongoose from "mongoose";
import { Order, User, HostedCheckoutDraft } from "../models/index.js";
import { isBeanStampsEnabled } from "../config/featureFlags.js";
import { errorResponse, isObjectId } from "../utils/validation.js";
import {
  optionalAuth,
  authenticate,
  authenticateWithQueryToken,
} from "../middleware/auth.js";
import { requireKitchenAdmin } from "../middleware/kitchenAdmin.js";
import { revokeLoyaltyStampForOrder } from "../services/loyalty.js";
import { placeOnlineOrder } from "../services/onlineOrderPlacement.js";
import { orderEventEmitter } from "../services/orderEvents.js";

const router = express.Router();

export { orderEventEmitter };

const allowedStatuses = [
  "placed",
  "preparing",
  "ready",
  "completed",
  "cancelled",
];

// POST /api/orders
// Use optionalAuth to support both authenticated and guest orders
// Admin comped orders (ADMIN_DISCOUNT) allowed only for authenticated admin users
router.post("/", optionalAuth, async (req, res, next) => {
  try {
    const result = await placeOnlineOrder(req.body, req.user, {
      orderEventEmitter,
    });
    if (!result.ok) {
      if (result.errors?.length) {
        return errorResponse(res, result.status, "Validation failed", result.errors);
      }
      return errorResponse(
        res,
        result.status,
        result.message || "Order failed",
        result.message ? [result.message] : undefined,
      );
    }
    const status = result.idempotent ? 200 : 201;
    res.status(status).json({
      data: result.order,
      idempotent: Boolean(result.idempotent),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/orders/recover-hosted-checkout
 * If the browser lost sessionStorage after Clover payment, create the order from the server draft (idempotent).
 */
router.post("/recover-hosted-checkout", optionalAuth, async (req, res, next) => {
  try {
    const checkoutId = String(req.body?.checkoutId || "").trim();
    if (!checkoutId) {
      return errorResponse(res, 400, "checkoutId is required", ["checkoutId"]);
    }

    const existingOrder = await Order.findOne({ paymentRef: checkoutId }).lean();
    if (existingOrder) {
      return res.status(200).json({
        data: existingOrder,
        idempotent: true,
        source: "existing_order",
      });
    }

    const draftDoc = await HostedCheckoutDraft.findOne({
      checkoutSessionId: checkoutId,
    }).lean();
    if (!draftDoc?.orderDraft) {
      return errorResponse(
        res,
        404,
        "No saved checkout found for this payment. Contact support with your payment confirmation.",
        ["checkoutId"],
      );
    }

    let user = req.user || null;
    if (draftDoc.userId) {
      const draftUser = await User.findById(draftDoc.userId).select("-password");
      if (draftUser) user = draftUser;
    }

    const body = {
      ...draftDoc.orderDraft,
      paymentStatus: "paid",
      paymentRef: checkoutId,
    };

    const result = await placeOnlineOrder(body, user, { orderEventEmitter });
    if (!result.ok) {
      if (result.errors?.length) {
        return errorResponse(res, result.status, "Validation failed", result.errors);
      }
      return errorResponse(
        res,
        result.status,
        result.message || "Could not complete order",
        result.message ? [result.message] : undefined,
      );
    }

    res.status(result.idempotent ? 200 : 201).json({
      data: result.order,
      idempotent: Boolean(result.idempotent),
      source: "hosted_checkout_draft",
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/orders/kitchen
// Get orders for kitchen dashboard (paid orders that are not completed or cancelled)
// Must be before /:id route to avoid conflicts. Requires admin auth.
router.get(
  "/kitchen",
  authenticate,
  requireKitchenAdmin,
  async (req, res, next) => {
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
  },
);

// GET /api/orders/kitchen/previous
// Get completed (picked up) orders for previous orders page. Requires admin auth.
// Supports date range: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
// Legacy single date: ?date=YYYY-MM-DD
// Show all: ?all=true
router.get(
  "/kitchen/previous",
  authenticate,
  requireKitchenAdmin,
  async (req, res, next) => {
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
  },
);

// GET /api/orders/kitchen/stream
// Server-Sent Events endpoint for real-time order updates. Requires admin auth.
// Token can be in query (?token=) since EventSource cannot send headers.
router.get(
  "/kitchen/stream",
  authenticateWithQueryToken,
  requireKitchenAdmin,
  (req, res) => {
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
  },
);

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
router.patch(
  "/:id/status",
  authenticate,
  requireKitchenAdmin,
  async (req, res, next) => {
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
          `status must be one of ${allowedStatuses.join(", ")}`,
        );
      }

      if (paymentStatus && !allowedPaymentStatuses.includes(paymentStatus)) {
        return errorResponse(
          res,
          400,
          `paymentStatus must be one of ${allowedPaymentStatuses.join(", ")}`,
        );
      }

      const update = {};
      if (status) update.status = status;
      if (paymentStatus) update.paymentStatus = paymentStatus;

      if (!Object.keys(update).length) {
        return errorResponse(res, 400, "No valid fields to update");
      }

      const previous = await Order.findById(id).lean();
      if (!previous) {
        return errorResponse(res, 404, "Order not found");
      }

      const order = await Order.findByIdAndUpdate(
        id,
        { $set: update },
        { new: true, runValidators: true },
      ).lean();

      if (!order) {
        return errorResponse(res, 404, "Order not found");
      }

      if (
        isBeanStampsEnabled() &&
        update.status === "cancelled" &&
        previous.status !== "cancelled"
      ) {
        await revokeLoyaltyStampForOrder(id);
      }

      orderEventEmitter.emit("order:updated", order);

      res.json({ data: order });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/orders/webhook (stub)
router.post("/webhook", async (req, res) => {
  // TODO: verify signature once payment provider is integrated (e.g., Clover).
  console.log("Received webhook payload:", req.body);
  res.status(200).json({ received: true });
});

export default router;
