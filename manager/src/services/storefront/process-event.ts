import "server-only";

import { and, asc, eq } from "drizzle-orm";
import { moneyDecimalToCents } from "@/domain/shared";
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
} from "@/db/schema";
import type { JsonObject } from "@/db/schema/shared";
import { StorefrontOutboxEventSchema } from "@/integrations/storefront";
import { getServerEnv } from "@/lib/env";

function cents(value: number): number {
  return moneyDecimalToCents(String(value));
}

function json(value: unknown): JsonObject {
  return JSON.parse(JSON.stringify(value)) as JsonObject;
}

async function resolveStorefrontLocationId(
  organizationId: string,
  preferredLocationId: string | null,
): Promise<string> {
  const db = getDb();
  if (preferredLocationId) {
    const [preferred] = await db
      .select({ id: locations.id })
      .from(locations)
      .where(
        and(
          eq(locations.id, preferredLocationId),
          eq(locations.organizationId, organizationId),
          eq(locations.isActive, true),
        ),
      )
      .limit(1);
    if (preferred) return preferred.id;
  }

  const [connection] = await db
    .select({ locationId: integrationConnections.locationId })
    .from(integrationConnections)
    .where(
      and(
        eq(integrationConnections.organizationId, organizationId),
        eq(integrationConnections.sourceSystem, "wild_bean_storefront"),
        eq(integrationConnections.status, "active"),
      ),
    )
    .limit(1);
  if (connection?.locationId) return connection.locationId;

  const activeLocations = await db
    .select({ id: locations.id })
    .from(locations)
    .where(
      and(
        eq(locations.organizationId, organizationId),
        eq(locations.isActive, true),
      ),
    )
    .orderBy(asc(locations.createdAt));
  if (activeLocations.length === 1 && activeLocations[0]) {
    return activeLocations[0].id;
  }
  throw new Error("Storefront events need an assigned location.");
}

export async function processStorefrontIntegrationEvent(
  integrationEventId: string,
): Promise<{ status: "succeeded"; linkedToClover: boolean }> {
  if (!getServerEnv().DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  const db = getDb();
  const [integrationEvent] = await db
    .select()
    .from(integrationEvents)
    .where(eq(integrationEvents.id, integrationEventId))
    .limit(1);
  if (!integrationEvent) {
    throw new Error("Storefront integration event was not found.");
  }
  if (integrationEvent.status === "succeeded") {
    return { status: "succeeded", linkedToClover: false };
  }

  const event = StorefrontOutboxEventSchema.parse(integrationEvent.payload);
  const locationId = await resolveStorefrontLocationId(
    integrationEvent.organizationId,
    integrationEvent.locationId,
  );

  await db
    .update(integrationEvents)
    .set({
      status: "processing",
      processingStartedAt: new Date(),
      attemptCount: integrationEvent.attemptCount + 1,
      updatedAt: new Date(),
    })
    .where(eq(integrationEvents.id, integrationEvent.id));

  try {
    const subtotalCents = cents(event.order.totals.subtotal);
    const taxCents = cents(event.order.totals.tax);
    const tipCents = cents(event.order.totals.tip);
    const sourceTotalCents = cents(event.order.totals.total);
    const totalCents =
      subtotalCents + taxCents + tipCents === sourceTotalCents
        ? sourceTotalCents
        : subtotalCents + taxCents + tipCents;
    const status =
      event.order.paymentStatus === "refunded"
        ? ("refunded" as const)
        : event.order.status === "cancelled"
          ? ("voided" as const)
          : event.order.status === "completed"
            ? ("completed" as const)
            : ("open" as const);
    const [salesOrder] = await db
      .insert(salesOrders)
      .values({
        organizationId: integrationEvent.organizationId,
        locationId,
        sourceSystem: "wild_bean_storefront",
        externalId: event.order.id,
        reportingRole: "supplemental",
        orderNumber: event.order.id,
        businessDate: event.order.createdAt.slice(0, 10),
        status,
        openedAt: new Date(event.order.createdAt),
        closedAt:
          status === "open" ? null : new Date(event.order.updatedAt),
        currency: event.order.totals.currency.toUpperCase(),
        subtotalCents,
        discountCents: 0,
        taxCents,
        tipCents,
        totalCents,
        rawData: json({
          ...event.order,
          sourceTotalCents,
          normalizedTotalCents: totalCents,
        }),
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
            status === "open" ? null : new Date(event.order.updatedAt),
          subtotalCents,
          taxCents,
          tipCents,
          totalCents,
          rawData: json(event.order),
          updatedAt: new Date(),
        },
      })
      .returning({ id: salesOrders.id });

    for (const [index, item] of event.order.items.entries()) {
      const baseSubtotalCents = cents(item.price) * item.quantity;
      const modifierSubtotalCents = cents(item.modifierTotal) * item.quantity;
      const lineSubtotalCents = baseSubtotalCents + modifierSubtotalCents;
      const [existingLine] = await db
        .select({ id: salesOrderLines.id })
        .from(salesOrderLines)
        .where(
          and(
            eq(salesOrderLines.salesOrderId, salesOrder.id),
            eq(salesOrderLines.externalId, item.lineId),
          ),
        )
        .limit(1);
      const lineValues = {
        displayName: item.name,
        quantity: String(item.quantity),
        unitPriceCents: cents(item.price),
        subtotalCents: lineSubtotalCents,
        totalCents: lineSubtotalCents,
        updatedAt: new Date(),
      };
      const lineId = existingLine
        ? (
            await db
              .update(salesOrderLines)
              .set(lineValues)
              .where(eq(salesOrderLines.id, existingLine.id))
              .returning({ id: salesOrderLines.id })
          )[0].id
        : (
            await db
              .insert(salesOrderLines)
              .values({
                organizationId: integrationEvent.organizationId,
                salesOrderId: salesOrder.id,
                lineNumber: index + 1,
                externalId: item.lineId,
                lineType: "item",
                mappingStatus: "unmapped",
                ...lineValues,
              })
              .returning({ id: salesOrderLines.id })
          )[0].id;

      let modifierLine = 0;
      for (const group of item.modifiers) {
        for (const option of group.selectedOptions) {
          modifierLine += 1;
          const externalId = `${item.lineId}:${group.modifierGroupName}:${modifierLine}`;
          const optionSubtotal = cents(option.price) * option.quantity;
          const [existingModifier] = await db
            .select({ id: salesOrderModifiers.id })
            .from(salesOrderModifiers)
            .where(
              and(
                eq(salesOrderModifiers.salesOrderLineId, lineId),
                eq(salesOrderModifiers.externalId, externalId),
              ),
            )
            .limit(1);
          const modifierValues = {
            displayName: `${group.modifierGroupName}: ${option.name}`,
            quantity: String(option.quantity),
            unitPriceCents: cents(option.price),
            subtotalCents: optionSubtotal,
            totalCents: optionSubtotal,
            updatedAt: new Date(),
          };
          if (existingModifier) {
            await db
              .update(salesOrderModifiers)
              .set(modifierValues)
              .where(eq(salesOrderModifiers.id, existingModifier.id));
          } else {
            await db.insert(salesOrderModifiers).values({
              organizationId: integrationEvent.organizationId,
              salesOrderLineId: lineId,
              lineNumber: modifierLine,
              externalId,
              mappingStatus: "unmapped",
              ...modifierValues,
            });
          }
        }
      }
    }

    const [cloverPayment] = await db
      .select({ salesOrderId: salesPayments.salesOrderId })
      .from(salesPayments)
      .where(
        and(
          eq(salesPayments.locationId, locationId),
          eq(salesPayments.sourceSystem, "clover"),
          eq(salesPayments.externalId, event.order.paymentRef),
        ),
      )
      .limit(1);
    const primaryOrderId = cloverPayment?.salesOrderId;
    if (primaryOrderId && primaryOrderId !== salesOrder.id) {
      await db
        .insert(salesOrderLinks)
        .values({
          organizationId: integrationEvent.organizationId,
          primarySalesOrderId: primaryOrderId,
          linkedSalesOrderId: salesOrder.id,
          relationship: "same_sale",
          matchMethod: "clover_payment_external_id",
          confidence: "1.000000",
          status: "confirmed",
        })
        .onConflictDoNothing();
    }

    await db
      .update(integrationEvents)
      .set({
        status: "succeeded",
        processedAt: new Date(),
        aggregateType: "website_order",
        aggregateId: salesOrder.id,
        updatedAt: new Date(),
      })
      .where(eq(integrationEvents.id, integrationEvent.id));

    return {
      status: "succeeded",
      linkedToClover: Boolean(primaryOrderId),
    };
  } catch (error) {
    await db
      .update(integrationEvents)
      .set({
        status: "failed",
        lastError:
          error instanceof Error ? error.name : "StorefrontProcessingError",
        nextAttemptAt: new Date(Date.now() + 60_000),
        updatedAt: new Date(),
      })
      .where(eq(integrationEvents.id, integrationEvent.id));
    throw error;
  }
}
