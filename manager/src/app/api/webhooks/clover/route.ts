import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import {
  buildCloverWebhookIdempotencyKey,
  CLOVER_PLATFORM_AUTH_HEADER,
  CloverConfigError,
  CloverWebhookNotificationSchema,
  CloverWebhookPayloadSchema,
  parseCloverBrandConfig,
  verifyCloverPlatformAuthCode,
} from "@/integrations/clover";
import { getDb } from "@/db/client";
import {
  integrationConnections,
  integrationEvents,
} from "@/db/schema";
import type { JsonObject } from "@/db/schema/shared";
import { getServerEnv } from "@/lib/env";
import { dataResponse, errorResponse, routeErrorResponse } from "@/lib/http";
import { enqueueJob, jobNames } from "@/worker/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    let brand;
    try {
      brand = parseCloverBrandConfig();
    } catch (error) {
      if (error instanceof CloverConfigError) {
        return errorResponse(
          503,
          "CLOVER_NOT_CONFIGURED",
          "The dedicated manager Clover integration is not configured.",
        );
      }
      throw error;
    }

    if (
      !verifyCloverPlatformAuthCode(
        request.headers.get(CLOVER_PLATFORM_AUTH_HEADER),
        brand.platformWebhookAuthCode,
      )
    ) {
      return errorResponse(
        401,
        "INVALID_CLOVER_WEBHOOK",
        "The Clover notification could not be authenticated.",
      );
    }

    const rawBody = await request.text();
    let untrusted: unknown;
    try {
      untrusted = JSON.parse(rawBody);
    } catch {
      return errorResponse(
        400,
        "INVALID_JSON",
        "The Clover notification is not valid JSON.",
      );
    }

    const payload = CloverWebhookPayloadSchema.safeParse(untrusted);
    if (!payload.success) {
      return errorResponse(
        400,
        "INVALID_CLOVER_PAYLOAD",
        "The Clover notification shape was not accepted.",
      );
    }

    if ("verificationCode" in payload.data) {
      return NextResponse.json({
        verificationCode: payload.data.verificationCode,
      });
    }

    const platformNotification =
      CloverWebhookNotificationSchema.safeParse(payload.data);
    if (!platformNotification.success) {
      return errorResponse(
        400,
        "WRONG_CLOVER_WEBHOOK_TYPE",
        "Hosted Checkout notifications belong to the storefront endpoint.",
      );
    }

    const merchantIds = Object.keys(platformNotification.data.merchants);
    if (!getServerEnv().DATABASE_URL) {
      return errorResponse(
        503,
        "DATABASE_NOT_CONFIGURED",
        "The manager event ledger is not configured.",
      );
    }

    const db = getDb();
    const connections = await db
      .select({
        organizationId: integrationConnections.organizationId,
        locationId: integrationConnections.locationId,
        merchantId: integrationConnections.externalAccountId,
      })
      .from(integrationConnections)
      .where(
        and(
          eq(integrationConnections.sourceSystem, "clover"),
          eq(integrationConnections.status, "active"),
          inArray(integrationConnections.externalAccountId, merchantIds),
        ),
      );
    const connectionByMerchant = new Map(
      connections.map((connection) => [connection.merchantId, connection]),
    );

    const queuedEventIds: string[] = [];
    let accepted = 0;
    for (const merchantId of merchantIds) {
      const connection = connectionByMerchant.get(merchantId);
      if (!connection) continue;
      const merchantUpdates = platformNotification.data.merchants[merchantId];
      if (!merchantUpdates) continue;
      accepted += merchantUpdates.length;

      for (const update of merchantUpdates) {
        const idempotencyKey = buildCloverWebhookIdempotencyKey(
          merchantId,
          update,
        );
        const [inserted] = await db
          .insert(integrationEvents)
          .values({
            organizationId: connection.organizationId,
            locationId: connection.locationId,
            sourceSystem: "clover",
            direction: "inbound",
            eventType: `clover.${update.type.toLowerCase()}`,
            externalEventId: idempotencyKey,
            idempotencyKey,
            status: "received",
            occurredAt: new Date(update.ts),
            payload: {
              appId: platformNotification.data.appId,
              merchantId,
              update,
            } as JsonObject,
            headers: {
              authentication: "platform_auth_code_verified",
            },
          })
          .onConflictDoNothing()
          .returning({ id: integrationEvents.id });

        if (inserted) {
          queuedEventIds.push(inserted.id);
        }
      }
    }

    if (accepted === 0) {
      return errorResponse(
        403,
        "CLOVER_MERCHANT_MISMATCH",
        "The notification does not belong to a connected store.",
      );
    }

    await Promise.allSettled(
      queuedEventIds.map((integrationEventId) =>
        enqueueJob(
          jobNames.cloverEvent,
          { integrationEventId },
          integrationEventId,
        ),
      ),
    );

    return dataResponse(
      {
        accepted,
        newlyQueued: queuedEventIds.length,
      },
      { status: 202 },
    );
  } catch (error) {
    return routeErrorResponse(error);
  }
}
