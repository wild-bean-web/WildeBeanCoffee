import "server-only";

import { and, desc, eq, gte, lte } from "drizzle-orm";
import { getDb } from "@/db/client";
import { dailySalesControls } from "@/db/schema";
import type { ManagerSession } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/env";
import { locationScope } from "@/services/locations/scope";

export async function listDailySalesControls(
  session: ManagerSession,
  limit = 14,
) {
  const scope = locationScope(session);
  if (!getServerEnv().DATABASE_URL || !scope) return [];
  return getDb()
    .select()
    .from(dailySalesControls)
    .where(
      and(
        eq(dailySalesControls.organizationId, scope.organizationId),
        eq(dailySalesControls.locationId, scope.locationId),
      ),
    )
    .orderBy(desc(dailySalesControls.businessDate))
    .limit(Math.min(Math.max(limit, 1), 31));
}

export async function listDailySalesControlsForRange(
  session: ManagerSession,
  startsOn?: string,
  endsOn?: string,
) {
  const scope = locationScope(session);
  if (!getServerEnv().DATABASE_URL || !scope) return [];
  return getDb()
    .select()
    .from(dailySalesControls)
    .where(
      and(
        eq(dailySalesControls.organizationId, scope.organizationId),
        eq(dailySalesControls.locationId, scope.locationId),
        startsOn ? gte(dailySalesControls.businessDate, startsOn) : undefined,
        endsOn ? lte(dailySalesControls.businessDate, endsOn) : undefined,
      ),
    )
    .orderBy(desc(dailySalesControls.businessDate));
}
