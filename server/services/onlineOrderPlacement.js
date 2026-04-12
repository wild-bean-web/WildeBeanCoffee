import mongoose from "mongoose";
import { Order, Location, MenuItem, HostedCheckoutDraft } from "../models/index.js";
import {
  applyLoyaltyRedeemToItems,
  assertUserHasFullStampCard,
  processLoyaltyAfterPaidOrder,
} from "./loyalty.js";
import { isBeanStampsEnabled, isAdminOrderCompEnabled } from "../config/featureFlags.js";
import { isKitchenAdminEmail } from "../config/kitchenAdmins.js";

const allowedPaymentStatuses = [
  "pending",
  "authorized",
  "paid",
  "failed",
  "refunded",
];

function computeTotals(items, taxRate = 0, currency = "USD") {
  let foodSubtotalCents = 0;
  for (const item of items) {
    const unit = Math.round(Number(item.price) * 100);
    const qty = Math.max(1, Number(item.quantity ?? 1));
    foodSubtotalCents += unit * qty;
  }
  const taxCents = Math.round(foodSubtotalCents * Number(taxRate) || 0);
  const subtotal = foodSubtotalCents / 100;
  const tax = taxCents / 100;
  const total = (foodSubtotalCents + taxCents) / 100;
  return { subtotal, tax, total, currency };
}

function orderGrandTotalCents(items, taxRate, tipDollars = 0) {
  let foodSubtotalCents = 0;
  for (const item of items) {
    const unit = Math.round(Number(item.price) * 100);
    const qty = Math.max(1, Number(item.quantity ?? 1));
    foodSubtotalCents += unit * qty;
  }
  const taxCents = Math.round(foodSubtotalCents * Number(taxRate) || 0);
  const tipCents = Math.round(Number(tipDollars) * 100);
  return foodSubtotalCents + taxCents + tipCents;
}

export function validateOrderPayload(body) {
  const errors = [];
  const {
    customer,
    items,
    pickupTime,
    taxRate,
    paymentRef,
    paymentStatus,
  } = body;

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

  if (
    taxRate !== undefined &&
    (Number(taxRate) < 0 || Number.isNaN(Number(taxRate)))
  ) {
    errors.push("taxRate must be a non-negative number if provided");
  }

  if (paymentStatus && !allowedPaymentStatuses.includes(paymentStatus)) {
    errors.push(
      `paymentStatus must be one of ${allowedPaymentStatuses.join(", ")}`,
    );
  }

  const isAdminOrder = paymentRef === "ADMIN_DISCOUNT";
  if (paymentStatus !== "paid") {
    errors.push(
      "Payment must be completed before order can be created. paymentStatus must be 'paid'",
    );
  }

  if (paymentStatus === "paid" && !paymentRef && !isAdminOrder) {
    errors.push("paymentRef is required when paymentStatus is 'paid'");
  }

  if (pickupTime && Number.isNaN(Date.parse(pickupTime))) {
    errors.push("pickupTime must be a valid date if provided");
  }

  return errors;
}

const STORE_TIMEZONE = process.env.STORE_TIMEZONE || "America/New_York";

const _leadParsed = parseInt(process.env.PICKUP_MIN_LEAD_MINUTES ?? "5", 10);
const PICKUP_MIN_LEAD_MINUTES =
  Number.isFinite(_leadParsed) && _leadParsed >= 0 ? _leadParsed : 5;

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

function formatTime12Hour(hhmm) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const ampm = h < 12 ? "AM" : "PM";
  return `${hour12}:${String(m || 0).padStart(2, "0")} ${ampm}`;
}

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

function getDayNameInStoreTz(date, timeZone = STORE_TIMEZONE) {
  return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long" }).format(
    date,
  );
}

async function validatePickupTimeWithinHours(pickupTime) {
  if (!pickupTime) return null;
  const date = new Date(pickupTime);
  if (Number.isNaN(date.getTime())) return null;

  const location = await Location.findOne({ active: true }).lean();
  if (!location?.hours?.length) return null;

  const dayName = getDayNameInStoreTz(date);
  const { hour: pickupHour, minute: pickupMinute } =
    getHoursMinutesInStoreTz(date);
  const dayHours = location.hours.find((h) => h.day === dayName);

  if (
    !dayHours?.closed &&
    dayHours?.opens != null &&
    dayHours?.closes != null
  ) {
    const [openH, openM] = (dayHours.opens || "06:00").split(":").map(Number);
    const [closeH, closeM] = (dayHours.closes || "20:00")
      .split(":")
      .map(Number);
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

async function validateMenuItemsOnlineOrderable(items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  const menuIds = items
    .filter((i) => i.itemType === "menu" && i.itemId)
    .map((i) => i.itemId);
  if (menuIds.length === 0) return null;
  const objectIds = menuIds
    .map((id) =>
      mongoose.Types.ObjectId.isValid(id)
        ? new mongoose.Types.ObjectId(id)
        : null,
    )
    .filter(Boolean);
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

/**
 * Create a paid (or admin-comped) online order. Used by POST /api/orders, Clover webhook, and recovery flows.
 * @param {object} body - Same shape as POST /api/orders
 * @param {object|null} user - Authenticated user document (optional for guests)
 * @param {{ orderEventEmitter?: import("events").EventEmitter, skipPrint?: boolean, kitchenBypassHostedCheckoutBlockers?: boolean }} options
 * @returns {Promise<{ ok: true, order: object, idempotent?: boolean } | { ok: false, status: number, errors?: string[], message?: string }>}
 */
export async function placeOnlineOrder(body, user, options = {}) {
  const {
    orderEventEmitter = null,
    skipPrint = false,
    kitchenBypassHostedCheckoutBlockers = false,
  } = options;

  const errors = validateOrderPayload(body);
  if (errors.length) {
    return { ok: false, status: 400, errors };
  }

  let {
    customer,
    items,
    pickupTime,
    taxRate = 0,
    notes,
    paymentRef,
    paymentStatus,
  } = body;
  const beanStampsRedeemCartKey =
    typeof body.beanStampsRedeemCartKey === "string"
      ? body.beanStampsRedeemCartKey.trim()
      : "";

  const paymentStatusVal = paymentStatus || "pending";
  const paymentRefVal = paymentRef;

  if (
    paymentStatusVal === "paid" &&
    paymentRefVal &&
    paymentRefVal !== "ADMIN_DISCOUNT"
  ) {
    const existing = await Order.findOne({ paymentRef: paymentRefVal }).lean();
    if (existing) {
      await HostedCheckoutDraft.findOneAndUpdate(
        { checkoutSessionId: paymentRefVal, status: "pending" },
        {
          $set: {
            status: "fulfilled",
            fulfilledOrderId: existing._id,
          },
          $unset: { lastPlacementError: 1, lastPlacementErrorAt: 1 },
        },
      ).catch(() => {});
      return { ok: true, order: existing, idempotent: true };
    }
  }

  if (beanStampsRedeemCartKey && !isBeanStampsEnabled()) {
    return {
      ok: false,
      status: 400,
      errors: ["Bean Stamps is not available."],
    };
  }

  if (beanStampsRedeemCartKey && !user) {
    return {
      ok: false,
      status: 401,
      message: "Sign in to use Bean Stamps rewards.",
    };
  }

  if (!kitchenBypassHostedCheckoutBlockers) {
    const pickupLeadError = validatePickupTimeMeetsMinimumLead(pickupTime);
    if (pickupLeadError) {
      return { ok: false, status: 400, message: pickupLeadError };
    }

    const pickupTimeError = await validatePickupTimeWithinHours(pickupTime);
    if (pickupTimeError) {
      return { ok: false, status: 400, message: pickupTimeError };
    }
  }

  const isAdminOrder = paymentRefVal === "ADMIN_DISCOUNT";
  if (isAdminOrder && !isAdminOrderCompEnabled()) {
    return {
      ok: false,
      status: 403,
      message: "Admin comped orders are disabled in this environment.",
    };
  }
  if (!isAdminOrder && !kitchenBypassHostedCheckoutBlockers) {
    const inStoreOnlyError = await validateMenuItemsOnlineOrderable(items);
    if (inStoreOnlyError) {
      return { ok: false, status: 400, message: inStoreOnlyError };
    }
  }
  if (isAdminOrder) {
    if (!user) {
      return { ok: false, status: 401, message: "Authentication required for admin orders" };
    }
    if (!isKitchenAdminEmail(user.email)) {
      return {
        ok: false,
        status: 403,
        message: "Only authorized admins can place comped orders",
      };
    }
  }

  let loyaltyRedeemApplied = false;
  let loyaltyDiscountSubtotal = 0;

  if (beanStampsRedeemCartKey) {
    if (isAdminOrder) {
      return {
        ok: false,
        status: 400,
        message: "Bean Stamps cannot be applied to comped orders.",
      };
    }
    try {
      const applied = applyLoyaltyRedeemToItems(
        items,
        beanStampsRedeemCartKey,
        Number(taxRate) || 0,
      );
      items = applied.items;
      loyaltyRedeemApplied = true;
      loyaltyDiscountSubtotal = applied.loyaltyDiscountSubtotal;
    } catch (e) {
      return {
        ok: false,
        status: 400,
        message: e.message || "Invalid reward redemption",
      };
    }
  }

  let totals = computeTotals(items, taxRate);
  let tip = 0;
  if (!isAdminOrder) {
    const tipRaw = body.tip;
    if (tipRaw !== undefined && tipRaw !== null && tipRaw !== "") {
      const t = Number(tipRaw);
      if (!Number.isFinite(t) || t < 0) {
        return { ok: false, status: 400, errors: ["tip must be a non-negative number"] };
      }
      const maxTip = Number((totals.subtotal * 0.5).toFixed(2));
      if (t > maxTip + 0.001) {
        return { ok: false, status: 400, errors: ["tip exceeds maximum for this order"] };
      }
      tip = Number(t.toFixed(2));
    }
    totals = {
      ...totals,
      tip,
      total: orderGrandTotalCents(items, taxRate, tip) / 100,
    };
  } else {
    totals = {
      subtotal: totals.subtotal,
      tax: totals.tax,
      tip: 0,
      total: 0,
      currency: totals.currency,
    };
  }

  const isGuest = !user;
  const userId = user?._id || undefined;

  const session = await mongoose.startSession();
  let order;
  const orderPayload = {
    userId,
    isGuest,
    customer,
    items,
    pickupTime,
    notes,
    paymentRef: paymentRefVal,
    paymentStatus: paymentStatusVal,
    status: "placed",
    totals,
    loyaltyRedeemApplied,
    loyaltyDiscountSubtotal,
  };

  const runLoyaltyInSession = async (s) => {
    if (beanStampsRedeemCartKey) {
      await assertUserHasFullStampCard(user._id, s);
    }
    const [created] = await Order.create([orderPayload], { session: s });
    order = created;
    await processLoyaltyAfterPaidOrder({
      session: s,
      userId,
      orderId: order._id,
      totals: order.totals,
      paymentStatus: order.paymentStatus,
      paymentRef: order.paymentRef,
      loyaltyRedeemApplied,
    });
  };

  try {
    await session.withTransaction(() => runLoyaltyInSession(session));
  } catch (txnErr) {
    if (
      txnErr?.message?.includes("Bean Stamps") ||
      txnErr?.message?.includes("reward") ||
      txnErr?.message?.includes("Collect 20")
    ) {
      return { ok: false, status: 400, message: txnErr.message };
    }
    const msg = String(txnErr?.message || "");
    const noReplica =
      msg.includes("replica set") ||
      msg.includes("mongos") ||
      txnErr?.code === 20;
    if (noReplica) {
      if (beanStampsRedeemCartKey) {
        await assertUserHasFullStampCard(user._id, null);
      }
      order = await Order.create(orderPayload);
      await processLoyaltyAfterPaidOrder({
        session: null,
        userId,
        orderId: order._id,
        totals: order.totals,
        paymentStatus: order.paymentStatus,
        paymentRef: order.paymentRef,
        loyaltyRedeemApplied,
      });
    } else {
      throw txnErr;
    }
  } finally {
    await session.endSession();
  }

  const orderObj = order.toObject ? order.toObject() : order;

  if (
    paymentStatusVal === "paid" &&
    paymentRefVal &&
    paymentRefVal !== "ADMIN_DISCOUNT"
  ) {
    await HostedCheckoutDraft.findOneAndUpdate(
      { checkoutSessionId: paymentRefVal, status: "pending" },
      {
        $set: {
          status: "fulfilled",
          fulfilledOrderId: order._id,
        },
        $unset: { lastPlacementError: 1, lastPlacementErrorAt: 1 },
      },
    ).catch(() => {});
  }

  if (paymentStatusVal === "paid" && !skipPrint) {
    try {
      const { printReceipt } = await import("./clover.js");
      printReceipt(order).catch((err) => {
        console.error("Receipt printing failed for order:", order._id, err);
      });
    } catch (err) {
      console.error("Failed to import printReceipt service:", err);
    }
  }

  if (orderEventEmitter) {
    orderEventEmitter.emit("order:created", order);
  }

  return { ok: true, order: orderObj };
}
