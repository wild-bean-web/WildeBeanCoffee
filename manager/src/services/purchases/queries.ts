import "server-only";

import { and, desc, eq, gte, lte } from "drizzle-orm";
import { getDb } from "@/db/client";
import { purchases, vendors } from "@/db/schema";
import type { ManagerSession } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/env";
import { locationScope } from "@/services/locations/scope";

export interface PurchaseQueueItem {
  id: string;
  purchaseNumber: string;
  vendorName: string;
  purchaseDate: string;
  totalCents: number;
  currency: string;
  status: string;
  sourceSystem: string | null;
}

export async function listPurchaseQueue(
  session: ManagerSession,
  options: { limit?: number; startsOn?: string; endsOn?: string } = {},
): Promise<PurchaseQueueItem[]> {
  const env = getServerEnv();
  const scope = locationScope(session);
  if (!env.DATABASE_URL || !scope) return [];
  const limit = options.limit ?? 50;
  const filters = [
    eq(purchases.organizationId, scope.organizationId),
    eq(purchases.locationId, scope.locationId),
  ];
  if (options.startsOn) {
    filters.push(gte(purchases.purchaseDate, options.startsOn));
  }
  if (options.endsOn) {
    filters.push(lte(purchases.purchaseDate, options.endsOn));
  }

  return getDb()
    .select({
      id: purchases.id,
      purchaseNumber: purchases.purchaseNumber,
      vendorName: vendors.name,
      purchaseDate: purchases.purchaseDate,
      totalCents: purchases.totalCents,
      currency: purchases.currency,
      status: purchases.status,
      sourceSystem: purchases.sourceSystem,
    })
    .from(purchases)
    .innerJoin(vendors, eq(purchases.vendorId, vendors.id))
    .where(and(...filters))
    .orderBy(desc(purchases.purchaseDate), desc(purchases.createdAt))
    .limit(Math.min(Math.max(limit, 1), 100));
}
