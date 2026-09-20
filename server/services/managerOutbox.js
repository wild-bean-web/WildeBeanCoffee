import { createHmac, randomUUID } from "node:crypto";
import { ManagerOutboxEvent } from "../models/index.js";

const EVENT_SCHEMA_VERSION = 1;
const OUTBOX_TIMEOUT_MS = 5_000;
const MAX_ATTEMPTS = 12;

function iso(value) {
  return new Date(value).toISOString();
}

function sanitizedItem(item, index) {
  return {
    lineId: String(item._id || item.cartKey || `${item.itemId}:${index + 1}`),
    itemType: item.itemType,
    itemId: String(item.itemId),
    name: String(item.name),
    price: Number(item.price),
    quantity: Number(item.quantity),
    modifierTotal: Number(item.modifierTotal || 0),
    modifiers: (item.modifiers || []).map((group) => ({
      modifierGroupName: String(group.modifierGroupName),
      selectedOptions: (group.selectedOptions || []).map((option) => ({
        name: String(option.name),
        price: Number(option.price || 0),
        quantity: Number(option.quantity || 1),
      })),
    })),
    loyaltyRewardApplied: Boolean(item.loyaltyRewardApplied),
  };
}

export function buildSanitizedOrderEvent(order, eventType, eventId = randomUUID()) {
  if (!order?._id || !order?.paymentRef) {
    throw new Error("A persisted paid order is required for manager outbox.");
  }

  const createdAt = order.createdAt || new Date();
  const updatedAt = order.updatedAt || createdAt;
  return {
    schemaVersion: EVENT_SCHEMA_VERSION,
    eventId,
    eventType,
    organizationSlug: "wild-bean-coffee",
    occurredAt: iso(updatedAt),
    order: {
      id: String(order._id),
      paymentRef: String(order.paymentRef),
      paymentStatus: order.paymentStatus,
      status: order.status,
      source: "wild_bean_website",
      items: (order.items || []).map(sanitizedItem),
      totals: {
        subtotal: Number(order.totals?.subtotal || 0),
        tax: Number(order.totals?.tax || 0),
        tip: Number(order.totals?.tip || 0),
        total: Number(order.totals?.total || 0),
        currency: String(order.totals?.currency || "USD").toUpperCase(),
      },
      createdAt: iso(createdAt),
      updatedAt: iso(updatedAt),
    },
  };
}

export async function appendOrderOutboxEvent({
  order,
  eventType,
  session = null,
}) {
  const payload = buildSanitizedOrderEvent(order, eventType);
  const values = {
    eventId: payload.eventId,
    eventType,
    aggregateId: order._id,
    aggregateVersion: new Date(order.updatedAt || order.createdAt).getTime(),
    schemaVersion: EVENT_SCHEMA_VERSION,
    payload,
  };

  try {
    const created = session
      ? await ManagerOutboxEvent.create([values], { session })
      : await ManagerOutboxEvent.create(values);
    return Array.isArray(created) ? created[0] : created;
  } catch (error) {
    if (error?.code === 11000) {
      return ManagerOutboxEvent.findOne({
        aggregateId: order._id,
        eventType,
        aggregateVersion: values.aggregateVersion,
      }).session(session);
    }
    throw error;
  }
}

export function signManagerOutboxBody(rawBody, secret, timestampSeconds) {
  const digest = createHmac("sha256", secret)
    .update(`${timestampSeconds}.${rawBody}`, "utf8")
    .digest("hex");
  return `t=${timestampSeconds},v1=${digest}`;
}

function retryDelayMs(attempt) {
  return Math.min(60 * 60 * 1000, 15_000 * 2 ** Math.max(0, attempt - 1));
}

export async function deliverManagerOutboxBatch({ limit = 25 } = {}) {
  const endpoint = String(process.env.MANAGER_INGESTION_URL || "").trim();
  const secret = String(process.env.MANAGER_OUTBOX_SECRET || "").trim();
  if (!endpoint || secret.length < 32) {
    return { delivered: 0, failed: 0, skipped: true };
  }

  const events = await ManagerOutboxEvent.find({
    status: "pending",
    nextAttemptAt: { $lte: new Date() },
  })
    .sort({ createdAt: 1 })
    .limit(Math.min(Math.max(limit, 1), 100));

  let delivered = 0;
  let failed = 0;

  for (const event of events) {
    const claimed = await ManagerOutboxEvent.findOneAndUpdate(
      { _id: event._id, status: "pending" },
      {
        $set: { status: "delivering", deliveringSince: new Date() },
        $inc: { attempts: 1 },
      },
      { new: true },
    );
    if (!claimed) continue;

    const rawBody = JSON.stringify(claimed.payload);
    const timestamp = Math.floor(Date.now() / 1000);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-wild-bean-signature": signManagerOutboxBody(
            rawBody,
            secret,
            timestamp,
          ),
        },
        body: rawBody,
        signal: AbortSignal.timeout(OUTBOX_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(`manager_http_${response.status}`);
      }
      await ManagerOutboxEvent.updateOne(
        { _id: claimed._id, status: "delivering" },
        {
          $set: { status: "delivered", deliveredAt: new Date() },
          $unset: { deliveringSince: 1, lastErrorCode: 1 },
        },
      );
      delivered += 1;
    } catch (error) {
      const attempts = claimed.attempts;
      const deadLetter = attempts >= MAX_ATTEMPTS;
      await ManagerOutboxEvent.updateOne(
        { _id: claimed._id, status: "delivering" },
        {
          $set: {
            status: deadLetter ? "dead_letter" : "pending",
            nextAttemptAt: new Date(Date.now() + retryDelayMs(attempts)),
            lastErrorCode:
              error instanceof Error
                ? error.message.slice(0, 120)
                : "delivery_failed",
          },
          $unset: { deliveringSince: 1 },
        },
      );
      failed += 1;
    }
  }

  return { delivered, failed, skipped: false };
}

export async function releaseStaleManagerOutboxClaims() {
  const staleBefore = new Date(Date.now() - 2 * OUTBOX_TIMEOUT_MS);
  return ManagerOutboxEvent.updateMany(
    { status: "delivering", deliveringSince: { $lt: staleBefore } },
    {
      $set: { status: "pending", nextAttemptAt: new Date() },
      $unset: { deliveringSince: 1 },
    },
  );
}
