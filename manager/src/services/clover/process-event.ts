import "server-only";

import { and, eq, sql } from "drizzle-orm";
import {
  CloverFetchReadClient,
  CloverWebhookUpdateSchema,
  normalizeCloverOrder,
  normalizeCloverPayment,
  normalizeCloverRefund,
  parseCloverObjectId,
  type NormalizedOrder,
  type NormalizedPayment,
  type NormalizedRefund,
} from "@/integrations/clover";
import { getDb } from "@/db/client";
import {
  integrationConnections,
  integrationEvents,
  locations,
  salesOrderLines,
  salesOrderLinks,
  salesOrderModifiers,
  salesOrders,
  salesPayments,
  salesRefunds,
} from "@/db/schema";
import type { JsonObject } from "@/db/schema/shared";
import { getServerEnv } from "@/lib/env";
import { cloverClientConfigForConnection } from "./connection-config";

function dateInTimezone(timestamp: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function json(value: unknown): JsonObject {
  return JSON.parse(JSON.stringify(value)) as JsonObject;
}

function orderStatus(order: NormalizedOrder) {
  if (order.refundAmountCents > 0) {
    return order.refundAmountCents >= order.paymentAmountCents
      ? ("refunded" as const)
      : ("partially_refunded" as const);
  }
  if (order.state?.toLowerCase().includes("open")) return "open" as const;
  return "completed" as const;
}

export async function persistNormalizedCloverPayment(input: {
  organizationId: string;
  locationId: string;
  salesOrderId: string | null;
  payment: NormalizedPayment;
  timezone: string;
}) {
  const { payment } = input;
  const [record] = await getDb()
    .insert(salesPayments)
    .values({
      organizationId: input.organizationId,
      locationId: input.locationId,
      salesOrderId: input.salesOrderId,
      sourceSystem: "clover",
      externalId: payment.externalId,
      businessDate: dateInTimezone(payment.occurredAt, input.timezone),
      occurredAt: new Date(payment.occurredAt),
      status: payment.status,
      currency: payment.currency,
      amountCents: payment.amountCents,
      taxCents: payment.taxAmountCents,
      tipCents: payment.tipAmountCents,
      totalCollectedCents: payment.totalCollectedCents,
      refundedCents: payment.refundedAmountCents,
      netCollectedCents: payment.netCollectedCents,
      tenderExternalId: payment.tender.externalId,
      tenderType: payment.tender.type,
      tenderLabel: payment.tender.label,
      sourceChannel: payment.sourceChannel,
      rawData: json(payment),
    })
    .onConflictDoUpdate({
      target: [
        salesPayments.locationId,
        salesPayments.sourceSystem,
        salesPayments.externalId,
      ],
      set: {
        salesOrderId: input.salesOrderId,
        status: payment.status,
        refundedCents: payment.refundedAmountCents,
        netCollectedCents: payment.netCollectedCents,
        rawData: json(payment),
        updatedAt: new Date(),
      },
    })
    .returning({ id: salesPayments.id });

  for (const refund of payment.refunds) {
    await persistNormalizedCloverRefund({
      organizationId: input.organizationId,
      locationId: input.locationId,
      salesOrderId: input.salesOrderId,
      salesPaymentId: record.id,
      refund,
      timezone: input.timezone,
    });
  }

  if (input.salesOrderId) {
    const [websiteOrder] = await getDb()
      .select({ id: salesOrders.id })
      .from(salesOrders)
      .where(
        and(
          eq(salesOrders.locationId, input.locationId),
          eq(salesOrders.sourceSystem, "wild_bean_storefront"),
          sql`${salesOrders.rawData}->>'paymentRef' = ${payment.externalId}`,
        ),
      )
      .limit(1);
    if (websiteOrder && websiteOrder.id !== input.salesOrderId) {
      await getDb()
        .insert(salesOrderLinks)
        .values({
          organizationId: input.organizationId,
          primarySalesOrderId: input.salesOrderId,
          linkedSalesOrderId: websiteOrder.id,
          relationship: "same_sale",
          matchMethod: "clover_payment_external_id",
          confidence: "1.000000",
          status: "confirmed",
        })
        .onConflictDoNothing();
    }
  }

  return record.id;
}

export async function persistNormalizedCloverRefund(input: {
  organizationId: string;
  locationId: string;
  salesOrderId: string | null;
  salesPaymentId: string | null;
  refund: NormalizedRefund;
  timezone: string;
}) {
  const { refund } = input;
  await getDb()
    .insert(salesRefunds)
    .values({
      organizationId: input.organizationId,
      locationId: input.locationId,
      salesOrderId: input.salesOrderId,
      salesPaymentId: input.salesPaymentId,
      sourceSystem: "clover",
      externalId: refund.externalId,
      businessDate: dateInTimezone(refund.occurredAt, input.timezone),
      occurredAt: new Date(refund.occurredAt),
      currency: refund.currency,
      amountCents: refund.amountCents,
      taxCents: refund.taxAmountCents,
      tipCents: refund.tipAmountCents,
      sourceChannel: refund.sourceChannel,
      rawData: json(refund),
    })
    .onConflictDoUpdate({
      target: [
        salesRefunds.locationId,
        salesRefunds.sourceSystem,
        salesRefunds.externalId,
      ],
      set: {
        salesOrderId: input.salesOrderId,
        salesPaymentId: input.salesPaymentId,
        rawData: json(refund),
        updatedAt: new Date(),
      },
    });
}

export async function persistNormalizedCloverOrder(input: {
  organizationId: string;
  locationId: string;
  order: NormalizedOrder;
  timezone: string;
}) {
  const { order } = input;
  const status = orderStatus(order);
  const subtotalCents = order.lineItemGrossCents;
  const totalCents =
    subtotalCents -
    order.discountAmountCents +
    order.taxAmountCents +
    order.tipAmountCents;
  const [salesOrder] = await getDb()
    .insert(salesOrders)
    .values({
      organizationId: input.organizationId,
      locationId: input.locationId,
      sourceSystem: "clover",
      externalId: order.externalId,
      orderNumber: order.externalReferenceId,
      businessDate: dateInTimezone(order.createdAt, input.timezone),
      status,
      openedAt: new Date(order.createdAt),
      closedAt: status === "open"
        ? null
        : new Date(order.modifiedAt ?? order.createdAt),
      currency: order.currency,
      subtotalCents,
      discountCents: order.discountAmountCents,
      taxCents: order.taxAmountCents,
      tipCents: order.tipAmountCents,
      totalCents,
      rawData: json(order),
    })
    .onConflictDoUpdate({
      target: [
        salesOrders.locationId,
        salesOrders.sourceSystem,
        salesOrders.externalId,
      ],
      set: {
        status,
        closedAt:
          status === "open"
            ? null
            : new Date(order.modifiedAt ?? order.createdAt),
        subtotalCents,
        discountCents: order.discountAmountCents,
        taxCents: order.taxAmountCents,
        tipCents: order.tipAmountCents,
        totalCents,
        rawData: json(order),
        updatedAt: new Date(),
      },
    })
    .returning({ id: salesOrders.id });

  for (const [index, line] of order.lineItems.entries()) {
    let [lineRecord] = await getDb()
      .select({ id: salesOrderLines.id })
      .from(salesOrderLines)
      .where(
        and(
          eq(salesOrderLines.salesOrderId, salesOrder.id),
          eq(salesOrderLines.externalId, line.externalId),
        ),
      )
      .limit(1);
    const taxCents = line.taxes.reduce(
      (sum, tax) => sum + tax.amountCents,
      0,
    );
    const values = {
      displayName: line.name,
      quantity: String(line.quantity),
      unitPriceCents: line.unitPriceCents,
      subtotalCents: line.grossAmountCents,
      discountCents: line.discountAmountCents,
      taxCents,
      totalCents: line.grossAmountCents - line.discountAmountCents + taxCents,
      isVoided: line.refunded,
      voidedAt: line.refunded ? new Date() : null,
      updatedAt: new Date(),
    };
    if (lineRecord) {
      [lineRecord] = await getDb()
        .update(salesOrderLines)
        .set(values)
        .where(eq(salesOrderLines.id, lineRecord.id))
        .returning({ id: salesOrderLines.id });
    } else {
      [lineRecord] = await getDb()
        .insert(salesOrderLines)
        .values({
          organizationId: input.organizationId,
          salesOrderId: salesOrder.id,
          lineNumber: index + 1,
          externalId: line.externalId,
          lineType: "item",
          mappingStatus: "unmapped",
          ...values,
        })
        .returning({ id: salesOrderLines.id });
    }

    for (const [modifierIndex, modifier] of line.modifiers.entries()) {
      const externalId =
        modifier.externalId ??
        `${line.externalId}:modifier:${modifierIndex + 1}`;
      const subtotal = Math.round(modifier.amountCents * modifier.quantity);
      const [existingModifier] = await getDb()
        .select({ id: salesOrderModifiers.id })
        .from(salesOrderModifiers)
        .where(
          and(
            eq(salesOrderModifiers.salesOrderLineId, lineRecord.id),
            eq(salesOrderModifiers.externalId, externalId),
          ),
        )
        .limit(1);
      const modifierValues = {
        displayName: modifier.name,
        quantity: String(modifier.quantity),
        unitPriceCents: modifier.amountCents,
        subtotalCents: subtotal,
        totalCents: subtotal,
        updatedAt: new Date(),
      };
      if (existingModifier) {
        await getDb()
          .update(salesOrderModifiers)
          .set(modifierValues)
          .where(eq(salesOrderModifiers.id, existingModifier.id));
      } else {
        await getDb().insert(salesOrderModifiers).values({
          organizationId: input.organizationId,
          salesOrderLineId: lineRecord.id,
          lineNumber: modifierIndex + 1,
          externalId,
          mappingStatus: "unmapped",
          ...modifierValues,
        });
      }
    }
  }

  for (const payment of order.payments) {
    await persistNormalizedCloverPayment({
      organizationId: input.organizationId,
      locationId: input.locationId,
      salesOrderId: salesOrder.id,
      payment,
      timezone: input.timezone,
    });
  }
  for (const refund of order.refunds) {
    await persistNormalizedCloverRefund({
      organizationId: input.organizationId,
      locationId: input.locationId,
      salesOrderId: salesOrder.id,
      salesPaymentId: null,
      refund,
      timezone: input.timezone,
    });
  }
}

export async function processCloverIntegrationEvent(
  integrationEventId: string,
): Promise<{ status: "succeeded" | "ignored"; resource: string }> {
  const env = getServerEnv();
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  const db = getDb();
  const [event] = await db
    .select()
    .from(integrationEvents)
    .where(eq(integrationEvents.id, integrationEventId))
    .limit(1);
  if (!event) throw new Error("Clover integration event was not found.");
  if (event.status === "succeeded" || event.status === "ignored") {
    return { status: event.status, resource: event.aggregateType ?? "unknown" };
  }

  const merchantId =
    typeof event.payload.merchantId === "string"
      ? event.payload.merchantId
      : null;
  const connectionFilters = [
    eq(integrationConnections.organizationId, event.organizationId),
    eq(integrationConnections.sourceSystem, "clover"),
    eq(integrationConnections.status, "active"),
  ];
  if (event.locationId) {
    connectionFilters.push(
      eq(integrationConnections.locationId, event.locationId),
    );
  }
  if (merchantId) {
    connectionFilters.push(
      eq(integrationConnections.externalAccountId, merchantId),
    );
  }

  const cloverRows = await db
    .select()
    .from(integrationConnections)
    .where(and(...connectionFilters))
    .limit(2);
  const [connection] = cloverRows;
  if (!connection?.locationId || cloverRows.length !== 1) {
    throw new Error("Active Clover location connection was not found.");
  }

  const [cafe] = await db
    .select({ timezone: locations.timezone })
    .from(locations)
    .where(eq(locations.id, connection.locationId))
    .limit(1);
  const timezone = cafe?.timezone ?? env.MANAGER_TIMEZONE;

  const update = CloverWebhookUpdateSchema.parse(event.payload.update);
  const parsedObject = parseCloverObjectId(update.objectId);
  const config = cloverClientConfigForConnection(connection);
  const client = new CloverFetchReadClient(config);

  await db
    .update(integrationEvents)
    .set({
      status: "processing",
      processingStartedAt: new Date(),
      attemptCount: event.attemptCount + 1,
      updatedAt: new Date(),
    })
    .where(eq(integrationEvents.id, event.id));

  try {
    let resource = "unsupported";
    if (parsedObject.eventPrefix === "O") {
      const order = normalizeCloverOrder(
        await client.getOrder(parsedObject.externalId, {
          expand: [
            "lineItems",
            "lineItems.modifications",
            "lineItems.discounts",
            "payments",
            "payment.tender",
            "discounts",
            "refunds",
            "orderType",
          ],
        }),
        { merchantId: config.merchantId },
      );
      await persistNormalizedCloverOrder({
        organizationId: event.organizationId,
        locationId: connection.locationId,
        order,
        timezone,
      });
      resource = "order";
    } else if (parsedObject.eventPrefix === "P") {
      const payment = normalizeCloverPayment(
        await client.getPayment(parsedObject.externalId, {
          expand: ["refunds", "tender"],
        }),
        {
          merchantId: config.merchantId,
          currency: "USD",
        },
      );
      const [order] = payment.orderExternalId
        ? await db
            .select({ id: salesOrders.id })
            .from(salesOrders)
            .where(
              and(
                eq(salesOrders.locationId, connection.locationId),
                eq(salesOrders.sourceSystem, "clover"),
                eq(salesOrders.externalId, payment.orderExternalId),
              ),
            )
            .limit(1)
        : [];
      await persistNormalizedCloverPayment({
        organizationId: event.organizationId,
        locationId: connection.locationId,
        salesOrderId: order?.id ?? null,
        payment,
        timezone,
      });
      resource = "payment";
    } else if (parsedObject.eventPrefix === "R") {
      const refund = normalizeCloverRefund(
        await client.getRefund(parsedObject.externalId),
        {
          merchantId: config.merchantId,
          currency: "USD",
        },
      );
      await persistNormalizedCloverRefund({
        organizationId: event.organizationId,
        locationId: connection.locationId,
        salesOrderId: null,
        salesPaymentId: null,
        refund,
        timezone,
      });
      resource = "refund";
    } else {
      await db
        .update(integrationEvents)
        .set({
          status: "ignored",
          processedAt: new Date(),
          aggregateType: resource,
          updatedAt: new Date(),
        })
        .where(eq(integrationEvents.id, event.id));
      return { status: "ignored", resource };
    }

    await db
      .update(integrationEvents)
      .set({
        status: "succeeded",
        processedAt: new Date(),
        aggregateType: resource,
        updatedAt: new Date(),
      })
      .where(eq(integrationEvents.id, event.id));
    return { status: "succeeded", resource };
  } catch (error) {
    await db
      .update(integrationEvents)
      .set({
        status: "failed",
        lastError: error instanceof Error ? error.name : "CloverProcessingError",
        nextAttemptAt: new Date(Date.now() + 60_000),
        updatedAt: new Date(),
      })
      .where(eq(integrationEvents.id, event.id));
    throw error;
  }
}
