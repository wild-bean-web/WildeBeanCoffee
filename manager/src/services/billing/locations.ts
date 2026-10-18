import "server-only";

import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { locationSubscriptions, locations } from "@/db/schema";
import { getServerEnv } from "@/lib/env";

export interface LocationBilling {
  id: string;
  name: string;
  status: "included" | "trialing" | "active" | "past_due" | "canceled" | "unpaid";
  currentPeriodEnd: string | null;
  checkoutReady: boolean;
}

export async function listLocationBilling(
  organizationId: string,
): Promise<LocationBilling[]> {
  const env = getServerEnv();
  const rows = await getDb()
    .select({
      id: locations.id,
      name: locations.name,
      status: locationSubscriptions.status,
      currentPeriodEnd: locationSubscriptions.currentPeriodEnd,
    })
    .from(locations)
    .leftJoin(
      locationSubscriptions,
      eq(locationSubscriptions.locationId, locations.id),
    )
    .where(eq(locations.organizationId, organizationId));

  const checkoutReady = Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_PRICE_ID);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    status: (row.status as LocationBilling["status"] | null) ?? "included",
    currentPeriodEnd: row.currentPeriodEnd?.toISOString() ?? null,
    checkoutReady,
  }));
}

export async function markLocationPaid(input: {
  locationId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}): Promise<void> {
  await getDb()
    .update(locationSubscriptions)
    .set({
      status: "active",
      stripeCustomerId: input.stripeCustomerId,
      stripeSubscriptionId: input.stripeSubscriptionId,
      updatedAt: new Date(),
    })
    .where(eq(locationSubscriptions.locationId, input.locationId));
}
