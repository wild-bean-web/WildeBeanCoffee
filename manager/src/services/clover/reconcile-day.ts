import "server-only";

import { and, eq } from "drizzle-orm";
import {
  calculateDailyControlTotals,
  CloverApiError,
  CloverFetchReadClient,
  NormalizedOrderSchema,
  NormalizedPaymentSchema,
  NormalizedRefundSchema,
  normalizeCloverOrder,
  normalizeCloverPayment,
  normalizeCloverRefund,
  reconcileDailyControlTotals,
  type NormalizedOrder,
  type NormalizedPayment,
  type NormalizedRefund,
} from "@/integrations/clover";
import { getDb } from "@/db/client";
import {
  dailySalesControls,
  integrationConnections,
  locations,
  salesOrders,
  salesPayments,
  salesRefunds,
} from "@/db/schema";
import type { JsonObject } from "@/db/schema/shared";
import type { ManagerSession } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/env";
import { addDaysIso, eachIsoDate, todayIso, zonedDayStartMs } from "@/lib/date-range";
import { requireLocationScope } from "@/services/locations/scope";
import { SalesServiceError } from "@/services/sales/errors";
import { cloverClientConfigForConnection } from "./connection-config";
import {
  persistNormalizedCloverOrder,
  persistNormalizedCloverPayment,
  persistNormalizedCloverRefund,
} from "./process-event";

function filterWindow(businessDate: string, timezone: string): string {
  const startMs = zonedDayStartMs(businessDate, timezone);
  const endMs = zonedDayStartMs(addDaysIso(businessDate, 1), timezone);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    throw new Error("A valid business date is required.");
  }
  return `createdTime>=${startMs},createdTime<${endMs}`;
}

function asJson(value: unknown): JsonObject {
  return JSON.parse(JSON.stringify(value)) as JsonObject;
}

export async function reconcileCloverBusinessDate(input: {
  organizationId: string;
  businessDate: string;
  locationId?: string;
}) {
  const env = getServerEnv();
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  const db = getDb();
  const connectionFilters = [
    eq(integrationConnections.organizationId, input.organizationId),
    eq(integrationConnections.sourceSystem, "clover"),
    eq(integrationConnections.status, "active"),
  ];
  if (input.locationId) {
    connectionFilters.push(
      eq(integrationConnections.locationId, input.locationId),
    );
  }
  const [connection] = await db
    .select()
    .from(integrationConnections)
    .where(and(...connectionFilters))
    .limit(1);
  if (!connection?.locationId) {
    throw new Error("Active Clover location connection was not found.");
  }

  const [cafe] = await db
    .select({ timezone: locations.timezone })
    .from(locations)
    .where(eq(locations.id, connection.locationId))
    .limit(1);
  const timezone = cafe?.timezone ?? env.MANAGER_TIMEZONE;
  const config = cloverClientConfigForConnection(connection);
  const client = new CloverFetchReadClient(config);
  const filter = filterWindow(input.businessDate, timezone);
  const externalOrders: NormalizedOrder[] = [];
  const externalPayments: NormalizedPayment[] = [];
  const externalRefunds: NormalizedRefund[] = [];

  for await (const order of client.listOrders({
    filter,
    maxPages: 100,
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
  })) {
    const normalized = normalizeCloverOrder(order, {
      merchantId: config.merchantId,
    });
    externalOrders.push(normalized);
    await persistNormalizedCloverOrder({
      organizationId: input.organizationId,
      locationId: connection.locationId,
      order: normalized,
      timezone,
    });
  }

  for await (const payment of client.listPayments({
    filter,
    maxPages: 100,
    expand: ["refunds", "tender"],
  })) {
    const normalized = normalizeCloverPayment(payment, {
      merchantId: config.merchantId,
      currency: "USD",
    });
    externalPayments.push(normalized);
    const [order] = normalized.orderExternalId
      ? await db
          .select({ id: salesOrders.id })
          .from(salesOrders)
          .where(
            and(
              eq(salesOrders.locationId, connection.locationId),
              eq(salesOrders.sourceSystem, "clover"),
              eq(salesOrders.externalId, normalized.orderExternalId),
            ),
          )
          .limit(1)
      : [];
    await persistNormalizedCloverPayment({
      organizationId: input.organizationId,
      locationId: connection.locationId,
      salesOrderId: order?.id ?? null,
      payment: normalized,
      timezone,
    });
  }

  for await (const refund of client.listRefunds({
    filter,
    maxPages: 100,
  })) {
    const normalized = normalizeCloverRefund(refund, {
      merchantId: config.merchantId,
      currency: "USD",
    });
    externalRefunds.push(normalized);
    await persistNormalizedCloverRefund({
      organizationId: input.organizationId,
      locationId: connection.locationId,
      salesOrderId: null,
      salesPaymentId: null,
      refund: normalized,
      timezone,
    });
  }

  const externalControls = calculateDailyControlTotals({
    businessDate: input.businessDate,
    timeZone: timezone,
    currency: "USD",
    orders: externalOrders,
    payments: externalPayments,
    refunds: externalRefunds,
  });

  const [storedOrderRows, storedPaymentRows, storedRefundRows] =
    await Promise.all([
      db
        .select({ rawData: salesOrders.rawData })
        .from(salesOrders)
        .where(
          and(
            eq(salesOrders.organizationId, input.organizationId),
            eq(salesOrders.locationId, connection.locationId),
            eq(salesOrders.sourceSystem, "clover"),
            eq(salesOrders.businessDate, input.businessDate),
          ),
        ),
      db
        .select({ rawData: salesPayments.rawData })
        .from(salesPayments)
        .where(
          and(
            eq(salesPayments.organizationId, input.organizationId),
            eq(salesPayments.locationId, connection.locationId),
            eq(salesPayments.sourceSystem, "clover"),
            eq(salesPayments.businessDate, input.businessDate),
          ),
        ),
      db
        .select({ rawData: salesRefunds.rawData })
        .from(salesRefunds)
        .where(
          and(
            eq(salesRefunds.organizationId, input.organizationId),
            eq(salesRefunds.locationId, connection.locationId),
            eq(salesRefunds.sourceSystem, "clover"),
            eq(salesRefunds.businessDate, input.businessDate),
          ),
        ),
    ]);

  const storedControls = calculateDailyControlTotals({
    businessDate: input.businessDate,
    timeZone: timezone,
    currency: "USD",
    orders: storedOrderRows.map((row) =>
      NormalizedOrderSchema.parse(row.rawData),
    ),
    payments: storedPaymentRows.map((row) =>
      NormalizedPaymentSchema.parse(row.rawData),
    ),
    refunds: storedRefundRows.map((row) =>
      NormalizedRefundSchema.parse(row.rawData),
    ),
  });
  const report = reconcileDailyControlTotals(
    externalControls,
    storedControls,
  );
  const status = report.status === "matched" ? "verified" : "exception";

  await db
    .insert(dailySalesControls)
    .values({
      organizationId: input.organizationId,
      locationId: connection.locationId,
      sourceSystem: "clover",
      businessDate: input.businessDate,
      currency: externalControls.currency,
      status,
      orderCount: externalControls.orders.count,
      paymentCount: externalControls.payments.count,
      refundCount: externalControls.refunds.count,
      grossCents: externalControls.payments.totalCollectedCents,
      discountCents: externalControls.orders.discountCents,
      taxCents: externalControls.payments.taxCents,
      tipCents: externalControls.payments.tipCents,
      refundCents: externalControls.refunds.amountCents,
      netCollectedCents: externalControls.netCollectedCents,
      controls: asJson({ external: externalControls, stored: storedControls, report }),
      reconciledAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        dailySalesControls.locationId,
        dailySalesControls.sourceSystem,
        dailySalesControls.businessDate,
      ],
      set: {
        status,
        orderCount: externalControls.orders.count,
        paymentCount: externalControls.payments.count,
        refundCount: externalControls.refunds.count,
        grossCents: externalControls.payments.totalCollectedCents,
        discountCents: externalControls.orders.discountCents,
        taxCents: externalControls.payments.taxCents,
        tipCents: externalControls.payments.tipCents,
        refundCents: externalControls.refunds.amountCents,
        netCollectedCents: externalControls.netCollectedCents,
        controls: asJson({
          external: externalControls,
          stored: storedControls,
          report,
        }),
        reconciledAt: new Date(),
        updatedAt: new Date(),
      },
    });

  await db
    .update(integrationConnections)
    .set({ lastSyncedAt: new Date(), updatedAt: new Date() })
    .where(eq(integrationConnections.id, connection.id));

  return { status, controls: externalControls, report };
}

const MAX_IMPORT_DAYS = 31;

export async function importCloverSalesRange(
  session: ManagerSession,
  startsOn: string,
  endsOn: string,
) {
  const scope = requireLocationScope(session);
  const env = getServerEnv();
  if (!env.DATABASE_URL) {
    throw new SalesServiceError(
      "The manager database is not configured.",
      400,
      "DATABASE_NOT_CONFIGURED",
    );
  }

  const db = getDb();
  const [connection] = await db
    .select({
      id: integrationConnections.id,
      locationId: integrationConnections.locationId,
    })
    .from(integrationConnections)
    .where(
      and(
        eq(integrationConnections.organizationId, scope.organizationId),
        eq(integrationConnections.locationId, scope.locationId),
        eq(integrationConnections.sourceSystem, "clover"),
        eq(integrationConnections.status, "active"),
      ),
    )
    .limit(1);
  if (!connection?.locationId) {
    throw new SalesServiceError(
      "Connect Clover for this store in Settings before importing sales.",
      409,
      "CLOVER_CONNECTION_MISSING",
    );
  }

  const [cafe] = await db
    .select({ timezone: locations.timezone })
    .from(locations)
    .where(eq(locations.id, scope.locationId))
    .limit(1);
  const timezone = cafe?.timezone ?? env.MANAGER_TIMEZONE;
  const today = todayIso(timezone);
  const rangeEndsOn = endsOn > today ? today : endsOn;
  if (startsOn > rangeEndsOn) {
    throw new SalesServiceError(
      "That date range is still in the future for this store.",
      400,
      "FUTURE_RANGE",
    );
  }

  let dates = eachIsoDate(startsOn, rangeEndsOn);
  if (dates.length > MAX_IMPORT_DAYS) {
    dates = dates.slice(-MAX_IMPORT_DAYS);
  }

  const days = [];
  for (const businessDate of dates) {
    try {
      const result = await reconcileCloverBusinessDate({
        organizationId: scope.organizationId,
        locationId: scope.locationId,
        businessDate,
      });
      days.push({
        businessDate,
        status: result.status,
        orderCount: result.controls.orders.count,
        netCollectedCents: result.controls.netCollectedCents,
        error: null as string | null,
      });
    } catch (error) {
      if (error instanceof CloverApiError) {
        console.error("Clover sales import day failed", {
          businessDate,
          status: error.status,
          body: error.body?.slice(0, 240) ?? null,
        });
      }
      days.push({
        businessDate,
        status: "failed" as const,
        orderCount: 0,
        netCollectedCents: 0,
        error:
          error instanceof Error
            ? error.message
            : "Clover sales could not be imported for this day.",
      });
    }
  }

  return {
    startsOn: dates[0] ?? startsOn,
    endsOn: dates.at(-1) ?? rangeEndsOn,
    importedDays: days.filter((day) => day.status !== "failed").length,
    failedDays: days.filter((day) => day.status === "failed").length,
    days,
  };
}
