import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { integrationEvents, organizations } from "@/db/schema";
import type { JsonObject } from "@/db/schema/shared";
import {
  STOREFRONT_SIGNATURE_HEADER,
  StorefrontOutboxEventSchema,
  verifyStorefrontEventSignature,
} from "@/integrations/storefront";
import { getServerEnv } from "@/lib/env";
import { dataResponse, errorResponse, routeErrorResponse } from "@/lib/http";
import { enqueueJob, jobNames } from "@/worker/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const env = getServerEnv();
    const rawBody = await request.text();
    if (
      !verifyStorefrontEventSignature({
        rawBody,
        signature: request.headers.get(STOREFRONT_SIGNATURE_HEADER),
        secret: env.STOREFRONT_OUTBOX_SECRET,
      })
    ) {
      return errorResponse(
        401,
        "INVALID_STOREFRONT_SIGNATURE",
        "The storefront event could not be authenticated.",
      );
    }

    let untrusted: unknown;
    try {
      untrusted = JSON.parse(rawBody);
    } catch {
      return errorResponse(
        400,
        "INVALID_JSON",
        "The storefront event is not valid JSON.",
      );
    }
    const event = StorefrontOutboxEventSchema.parse(untrusted);

    if (!env.DATABASE_URL) {
      return errorResponse(
        503,
        "DATABASE_NOT_CONFIGURED",
        "The manager event ledger is not configured.",
      );
    }

    const db = getDb();
    const [organization] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, event.organizationSlug))
      .limit(1);
    if (!organization) {
      return errorResponse(
        409,
        "ORGANIZATION_MISSING",
        "The manager organization has not been initialized.",
      );
    }

    const [inserted] = await db
      .insert(integrationEvents)
      .values({
        organizationId: organization.id,
        sourceSystem: "wild_bean_storefront",
        direction: "inbound",
        eventType: event.eventType,
        externalEventId: event.eventId,
        idempotencyKey: event.eventId,
        status: "received",
        aggregateType: "website_order",
        occurredAt: new Date(event.occurredAt),
        payload: event as unknown as JsonObject,
        headers: {
          authentication: "hmac_sha256_verified",
          schemaVersion: event.schemaVersion,
        },
      })
      .onConflictDoNothing()
      .returning({ id: integrationEvents.id });

    if (inserted) {
      await enqueueJob(
        jobNames.storefrontEvent,
        { integrationEventId: inserted.id },
        event.eventId,
      ).catch(() => null);
    }

    return dataResponse(
      { accepted: true, duplicate: !inserted },
      { status: 202 },
    );
  } catch (error) {
    return routeErrorResponse(error);
  }
}
