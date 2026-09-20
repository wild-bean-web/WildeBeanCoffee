import { and, eq, isNotNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { integrationConnections, locations } from "@/db/schema";
import { getServerEnv } from "@/lib/env";
import { dataResponse, errorResponse, routeErrorResponse } from "@/lib/http";
import { bearerToken, secretsEqual } from "@/lib/secrets";
import { enqueueJob, jobNames } from "@/worker/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function businessDate(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() - 24 * 60 * 60 * 1_000));
}

export async function POST(request: Request) {
  try {
    const env = getServerEnv();
    if (
      !secretsEqual(
        bearerToken(request.headers.get("authorization")),
        env.MANAGER_CRON_SECRET,
      )
    ) {
      return errorResponse(
        401,
        "INVALID_CRON_TOKEN",
        "Scheduled reconciliation was not authenticated.",
      );
    }
    if (!env.DATABASE_URL) {
      return errorResponse(
        503,
        "DATABASE_NOT_CONFIGURED",
        "The manager database is not configured.",
      );
    }

    const db = getDb();
    const connections = await db
      .select({
        organizationId: integrationConnections.organizationId,
        locationId: integrationConnections.locationId,
        timezone: locations.timezone,
      })
      .from(integrationConnections)
      .innerJoin(
        locations,
        eq(locations.id, integrationConnections.locationId),
      )
      .where(
        and(
          eq(integrationConnections.sourceSystem, "clover"),
          eq(integrationConnections.status, "active"),
          isNotNull(integrationConnections.locationId),
        ),
      );

    if (connections.length === 0) {
      return errorResponse(
        409,
        "CLOVER_CONNECTION_MISSING",
        "Connect Clover on a store in Settings before reconciling sales.",
      );
    }

    const queued = [];
    for (const connection of connections) {
      if (!connection.locationId) continue;
      const date = businessDate(connection.timezone || env.MANAGER_TIMEZONE);
      const jobId = await enqueueJob(
        jobNames.cloverReconcile,
        {
          organizationId: connection.organizationId,
          locationId: connection.locationId,
          businessDate: date,
        },
        `${connection.locationId}:${date}`,
      );
      queued.push({
        locationId: connection.locationId,
        jobId,
        businessDate: date,
      });
    }

    return dataResponse({ queued: true, jobs: queued });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
