import { sql } from "drizzle-orm";
import {
  check,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { locations, organizations } from "./core";
import { lifecycleTimestamps } from "./shared";

export const locationSubscriptions = pgTable(
  "location_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
    status: varchar("status", { length: 32 }).default("trialing").notNull(),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    currentPeriodEnd: timestamp("current_period_end", {
      withTimezone: true,
      precision: 3,
    }),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex("location_subscription_location_uidx").on(table.locationId),
    check(
      "location_subscription_status_allowed",
      sql`${table.status} in ('trialing', 'active', 'past_due', 'canceled', 'unpaid')`,
    ),
  ],
);
