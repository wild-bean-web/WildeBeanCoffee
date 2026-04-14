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
import {
  recordHostedCheckoutPlacementFailure,
  markHostedCheckoutPaymentApproved,
} from "../services/cloverHostedWebhook.js";
import { tryMarkHostedCheckoutPaidFromCloverPaymentLookup } from "../services/clover.js";
import { notifyOrderOpsAlert } from "../services/orderOpsAlerts.js";
import { resolveKitchenDateRangeFromQuery } from "../utils/kitchenQueryDateRange.js";

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
    let approvedAt = draftDoc.paymentApprovedAt || null;
    if (!approvedAt) {
      for (let i = 0; i < 4; i += 1) {
        await new Promise((r) => setTimeout(r, 750));
        const latest = await HostedCheckoutDraft.findOne({
          checkoutSessionId: checkoutId,
        })
          .select("paymentApprovedAt")
          .lean();
        if (latest?.paymentApprovedAt) {
          approvedAt = latest.paymentApprovedAt;
          break;
        }
      }
    }
    if (!approvedAt) {
      const inferred = await tryMarkHostedCheckoutPaidFromCloverPaymentLookup(
        checkoutId,
        draftDoc,
      );
      if (inferred.ok) {
        await markHostedCheckoutPaymentApproved(checkoutId, inferred.paymentId);
        approvedAt = new Date();
      }
    }
    if (!approvedAt) {
      return errorResponse(
        res,
        409,
        "We could not confirm your payment in our ordering system yet. If you see a charge, please call or email the shop right away with the reference below so we can find your order. Please do not submit the same order again until we have helped you.",
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

    const result = await placeOnlineOrder(body, user, {
      orderEventEmitter,
      hostedCheckoutPaidPlacementBypassPickupScheduling: true,
    });
    if (!result.ok) {
      await recordHostedCheckoutPlacementFailure(checkoutId, "recover_failed", result);
      await notifyOrderOpsAlert(
        `recover-hosted-checkout failed checkoutId=${checkoutId} ${JSON.stringify(result).slice(0, 600)}`,
      );
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

/**
 * GET /api/orders/kitchen/checkout-alerts
 * Paid checkout drafts that need kitchen attention: placement errors, or recent pending
 * with no Order yet (possible paid-but-not-synced). Includes orderDraft for display.
 */
router.get(
  "/kitchen/checkout-alerts",
  authenticate,
  requireKitchenAdmin,
  async (req, res, next) => {
    try {
      const pendingWindowMs = 48 * 60 * 60 * 1000;
      const pendingSince = new Date(Date.now() - pendingWindowMs);

      const withErrors = await HostedCheckoutDraft.find({
        lastPlacementError: { $nin: [null, ""] },
        paymentApprovedAt: { $ne: null },
      })
        .select(
          "checkoutSessionId orderDraft amountCents status lastPlacementError lastPlacementErrorAt createdAt paymentApprovedAt",
        )
        .sort({ lastPlacementErrorAt: -1 })
        .limit(30)
        .lean();

      const pendingRecent = await HostedCheckoutDraft.find({
        status: "pending",
        paymentApprovedAt: { $ne: null },
        createdAt: { $gte: pendingSince },
      })
        .select(
          "checkoutSessionId orderDraft amountCents status createdAt lastPlacementError paymentApprovedAt",
        )
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      const pendingIds = pendingRecent.map((d) => d.checkoutSessionId);
      let haveOrder = new Set();
      if (pendingIds.length) {
        const ord = await Order.find({ paymentRef: { $in: pendingIds } })
          .select("paymentRef")
          .lean();
        haveOrder = new Set(ord.map((o) => o.paymentRef));
      }

      const pendingNoOrder = pendingRecent.filter(
        (d) =>
          !haveOrder.has(d.checkoutSessionId) &&
          (!d.lastPlacementError || String(d.lastPlacementError).trim() === ""),
      );

      const bySession = new Map();
      for (const d of withErrors) {
        bySession.set(d.checkoutSessionId, {
          checkoutSessionId: d.checkoutSessionId,
          orderDraft: d.orderDraft,
          amountCents: d.amountCents,
          paymentApprovedAt: d.paymentApprovedAt || null,
          createdAt: d.createdAt,
          lastPlacementError: d.lastPlacementError,
          lastPlacementErrorAt: d.lastPlacementErrorAt,
          alertKind: "placement_failed",
        });
      }
      for (const d of pendingNoOrder) {
        if (!bySession.has(d.checkoutSessionId)) {
          bySession.set(d.checkoutSessionId, {
            checkoutSessionId: d.checkoutSessionId,
            orderDraft: d.orderDraft,
            amountCents: d.amountCents,
            paymentApprovedAt: d.paymentApprovedAt || null,
            createdAt: d.createdAt,
            lastPlacementError: null,
            lastPlacementErrorAt: null,
            alertKind: "pending_no_order",
          });
        }
      }

      const alerts = Array.from(bySession.values()).sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      );

      res.json({ data: alerts });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/orders/kitchen/force-resolve-hosted-checkout
 * Kitchen-only: create the paid order from the saved hosted-checkout draft while skipping
 * pickup lead / store-hours and online-only menu checks (e.g. pickup slot long in the past).
 */
router.post(
  "/kitchen/force-resolve-hosted-checkout",
  authenticate,
  requireKitchenAdmin,
  async (req, res, next) => {
    try {
      const checkoutId = String(req.body?.checkoutId || "").trim();
      if (!checkoutId) {
        return errorResponse(res, 400, "checkoutId is required", ["checkoutId"]);
      }

      const existingOrder = await Order.findOne({ paymentRef: checkoutId }).lean();
      if (existingOrder) {
        await HostedCheckoutDraft.findOneAndUpdate(
          { checkoutSessionId: checkoutId },
          {
            $set: {
              status: "fulfilled",
              fulfilledOrderId: existingOrder._id,
            },
            $unset: { lastPlacementError: 1, lastPlacementErrorAt: 1 },
          },
        ).catch(() => {});
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
          "No saved checkout found for this session.",
          ["checkoutId"],
        );
      }
      let paymentApproved = Boolean(draftDoc.paymentApprovedAt);
      if (!paymentApproved) {
        for (let i = 0; i < 4; i += 1) {
          await new Promise((r) => setTimeout(r, 750));
          const latest = await HostedCheckoutDraft.findOne({
            checkoutSessionId: checkoutId,
          })
            .select("paymentApprovedAt")
            .lean();
          if (latest?.paymentApprovedAt) {
            paymentApproved = true;
            break;
          }
        }
      }
      if (!paymentApproved) {
        const inferred = await tryMarkHostedCheckoutPaidFromCloverPaymentLookup(
          checkoutId,
          draftDoc,
        );
        if (inferred.ok) {
          await markHostedCheckoutPaymentApproved(checkoutId, inferred.paymentId);
          paymentApproved = true;
        }
      }
      if (!paymentApproved) {
        return errorResponse(
          res,
          409,
          "Payment is not marked confirmed for this checkout in our system. Verify the charge in Clover, check the Hosted Checkout webhook, then retry or place the order manually. Use the checkout reference below when talking to support.",
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

      const result = await placeOnlineOrder(body, user, {
        orderEventEmitter,
        kitchenBypassHostedCheckoutBlockers: true,
      });

      if (!result.ok) {
        await recordHostedCheckoutPlacementFailure(
          checkoutId,
          "kitchen_force_resolve_failed",
          result,
        );
        await notifyOrderOpsAlert(
          `kitchen force-resolve-hosted-checkout failed checkoutId=${checkoutId} ${JSON.stringify(result).slice(0, 600)}`,
        );
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
        source: "kitchen_force_resolve_hosted_checkout",
      });
    } catch (err) {
      next(err);
    }
  },
);

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
// Prefer ?rangeStart=&rangeEnd= ISO from the app. Else ?startDate=&endDate=, ?date=, ?all=true
router.get(
  "/kitchen/previous",
  authenticate,
  requireKitchenAdmin,
  async (req, res, next) => {
    try {
      const resolved = resolveKitchenDateRangeFromQuery(req.query);

      const query = {
        paymentStatus: "paid",
        status: "completed",
      };

      if (resolved.useAll) {
        // No date filtering
      } else {
        const { rangeStart, rangeEnd } = resolved;
        query.$or = [
          { updatedAt: { $gte: rangeStart, $lte: rangeEnd } },
          { createdAt: { $gte: rangeStart, $lte: rangeEnd } },
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
