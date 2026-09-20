import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

import { locations, organizations } from "./core";
import {
  integrationDirectionEnum,
  integrationEventStatusEnum,
} from "./enums";
import { type JsonObject, lifecycleTimestamps } from "./shared";

export const integrationConnections = pgTable(
  "integration_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    locationId: uuid("location_id").references(() => locations.id, {
      onDelete: "restrict",
    }),
    sourceSystem: varchar("source_system", { length: 96 }).notNull(),
    externalAccountId: text("external_account_id").notNull(),
    displayName: text("display_name").notNull(),
    status: varchar("status", { length: 32 }).default("active").notNull(),
    credentialReference: text("credential_reference"),
    cursor: jsonb("cursor").$type<JsonObject>().default({}).notNull(),
    settings: jsonb("settings").$type<JsonObject>().default({}).notNull(),
    lastSyncedAt: timestamp("last_synced_at", {
      withTimezone: true,
      precision: 3,
    }),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex("integration_connection_external_uidx").on(
      table.organizationId,
      table.sourceSystem,
      table.externalAccountId,
    ),
    index("integration_connection_location_idx").on(
      table.locationId,
      table.sourceSystem,
    ),
    index("integration_connection_status_idx").on(
      table.organizationId,
      table.status,
    ),
    check(
      "integration_connection_source_not_blank",
      sql`btrim(${table.sourceSystem}) <> ''`,
    ),
    check(
      "integration_connection_external_not_blank",
      sql`btrim(${table.externalAccountId}) <> ''`,
    ),
    check(
      "integration_connection_name_not_blank",
      sql`btrim(${table.displayName}) <> ''`,
    ),
    check(
      "integration_connection_status_allowed",
      sql`${table.status} in ('active', 'paused', 'error', 'disconnected')`,
    ),
  ],
);

export const integrationEvents = pgTable(
  "integration_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    locationId: uuid("location_id").references(() => locations.id, {
      onDelete: "restrict",
    }),
    sourceSystem: varchar("source_system", { length: 96 }).notNull(),
    direction: integrationDirectionEnum("direction").notNull(),
    eventType: varchar("event_type", { length: 128 }).notNull(),
    externalEventId: text("external_event_id"),
    idempotencyKey: text("idempotency_key").notNull(),
    status: integrationEventStatusEnum("status")
      .default("received")
      .notNull(),
    aggregateType: varchar("aggregate_type", { length: 96 }),
    aggregateId: uuid("aggregate_id"),
    aggregateVersion: integer("aggregate_version"),
    occurredAt: timestamp("occurred_at", {
      withTimezone: true,
      precision: 3,
    }).notNull(),
    receivedAt: timestamp("received_at", {
      withTimezone: true,
      precision: 3,
    })
      .defaultNow()
      .notNull(),
    processingStartedAt: timestamp("processing_started_at", {
      withTimezone: true,
      precision: 3,
    }),
    processedAt: timestamp("processed_at", {
      withTimezone: true,
      precision: 3,
    }),
    attemptCount: integer("attempt_count").default(0).notNull(),
    nextAttemptAt: timestamp("next_attempt_at", {
      withTimezone: true,
      precision: 3,
    }),
    correlationId: uuid("correlation_id"),
    causationEventId: uuid("causation_event_id").references(
      (): AnyPgColumn => integrationEvents.id,
      { onDelete: "restrict" },
    ),
    supersedesEventId: uuid("supersedes_event_id").references(
      (): AnyPgColumn => integrationEvents.id,
      { onDelete: "restrict" },
    ),
    payload: jsonb("payload").$type<JsonObject>().notNull(),
    headers: jsonb("headers").$type<JsonObject>().default({}).notNull(),
    lastError: text("last_error"),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex("integration_event_idempotency_uidx").on(
      table.organizationId,
      table.sourceSystem,
      table.direction,
      table.idempotencyKey,
    ),
    uniqueIndex("integration_event_external_uidx")
      .on(
        table.organizationId,
        table.sourceSystem,
        table.direction,
        table.externalEventId,
      )
      .where(sql`${table.externalEventId} is not null`),
    uniqueIndex("integration_event_supersedes_uidx")
      .on(table.supersedesEventId)
      .where(sql`${table.supersedesEventId} is not null`),
    index("integration_event_work_queue_idx").on(
      table.status,
      table.nextAttemptAt,
      table.receivedAt,
    ),
    index("integration_event_aggregate_idx").on(
      table.organizationId,
      table.aggregateType,
      table.aggregateId,
      table.aggregateVersion,
    ),
    index("integration_event_correlation_idx").on(table.correlationId),
    check(
      "integration_event_source_not_blank",
      sql`btrim(${table.sourceSystem}) <> ''`,
    ),
    check(
      "integration_event_type_not_blank",
      sql`btrim(${table.eventType}) <> ''`,
    ),
    check(
      "integration_event_key_not_blank",
      sql`btrim(${table.idempotencyKey}) <> ''`,
    ),
    check(
      "integration_event_attempts_nonnegative",
      sql`${table.attemptCount} >= 0`,
    ),
    check(
      "integration_event_version_positive",
      sql`${table.aggregateVersion} is null or ${table.aggregateVersion} > 0`,
    ),
    check(
      "integration_event_aggregate_pair",
      sql`(${table.aggregateType} is null) = (${table.aggregateId} is null)`,
    ),
    check(
      "integration_event_times_ordered",
      sql`
        ${table.processedAt} is null
        or ${table.processingStartedAt} is null
        or ${table.processedAt} >= ${table.processingStartedAt}
      `,
    ),
    check(
      "integration_event_causation_not_self",
      sql`${table.causationEventId} is null or ${table.causationEventId} <> ${table.id}`,
    ),
    check(
      "integration_event_supersedes_not_self",
      sql`${table.supersedesEventId} is null or ${table.supersedesEventId} <> ${table.id}`,
    ),
  ],
);

export type IntegrationEvent = typeof integrationEvents.$inferSelect;
export type NewIntegrationEvent = typeof integrationEvents.$inferInsert;
export type IntegrationConnection = typeof integrationConnections.$inferSelect;
export type NewIntegrationConnection =
  typeof integrationConnections.$inferInsert;
