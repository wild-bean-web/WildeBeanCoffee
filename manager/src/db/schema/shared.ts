import { timestamp } from "drizzle-orm/pg-core";

export type JsonObject = Record<string, unknown>;

export const lifecycleTimestamps = () => ({
  createdAt: timestamp("created_at", {
    withTimezone: true,
    precision: 3,
  })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", {
    withTimezone: true,
    precision: 3,
  })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
