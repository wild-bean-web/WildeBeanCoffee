import { sql } from "drizzle-orm";
import {
  bigserial,
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

import { organizations, staffMembers } from "./core";
import { auditActorTypeEnum } from "./enums";
import { type JsonObject } from "./shared";

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sequence: bigserial("sequence", { mode: "number" }).notNull(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    occurredAt: timestamp("occurred_at", {
      withTimezone: true,
      precision: 3,
    }).notNull(),
    recordedAt: timestamp("recorded_at", {
      withTimezone: true,
      precision: 3,
    })
      .defaultNow()
      .notNull(),
    actorType: auditActorTypeEnum("actor_type").notNull(),
    actorStaffMemberId: uuid("actor_staff_member_id").references(
      () => staffMembers.id,
      { onDelete: "restrict" },
    ),
    actorExternalId: text("actor_external_id"),
    sourceSystem: varchar("source_system", { length: 96 }).notNull(),
    action: varchar("action", { length: 128 }).notNull(),
    entityType: varchar("entity_type", { length: 128 }).notNull(),
    entityId: uuid("entity_id"),
    entityExternalId: text("entity_external_id"),
    requestId: uuid("request_id"),
    correlationId: uuid("correlation_id"),
    causationId: uuid("causation_id"),
    previousAuditEventId: uuid("previous_audit_event_id").references(
      (): AnyPgColumn => auditEvents.id,
      { onDelete: "restrict" },
    ),
    previousEventHash: varchar("previous_event_hash", { length: 64 }),
    eventHash: varchar("event_hash", { length: 64 }).notNull(),
    eventData: jsonb("event_data").$type<JsonObject>().notNull(),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
  },
  (table) => [
    uniqueIndex("audit_event_sequence_uidx").on(table.sequence),
    uniqueIndex("audit_event_org_hash_uidx").on(
      table.organizationId,
      table.eventHash,
    ),
    uniqueIndex("audit_event_previous_uidx")
      .on(table.previousAuditEventId)
      .where(sql`${table.previousAuditEventId} is not null`),
    index("audit_event_org_time_idx").on(
      table.organizationId,
      table.occurredAt,
      table.sequence,
    ),
    index("audit_event_entity_idx").on(
      table.organizationId,
      table.entityType,
      table.entityId,
      table.occurredAt,
    ),
    index("audit_event_actor_idx").on(
      table.actorStaffMemberId,
      table.occurredAt,
    ),
    index("audit_event_request_idx").on(table.requestId),
    index("audit_event_correlation_idx").on(table.correlationId),
    check(
      "audit_event_source_not_blank",
      sql`btrim(${table.sourceSystem}) <> ''`,
    ),
    check("audit_event_action_not_blank", sql`btrim(${table.action}) <> ''`),
    check(
      "audit_event_entity_type_not_blank",
      sql`btrim(${table.entityType}) <> ''`,
    ),
    check(
      "audit_event_entity_identity",
      sql`${table.entityId} is not null or ${table.entityExternalId} is not null`,
    ),
    check(
      "audit_event_actor_identity",
      sql`
        (${table.actorType} <> 'staff' or ${table.actorStaffMemberId} is not null)
        and (${table.actorType} = 'staff' or ${table.actorStaffMemberId} is null)
      `,
    ),
    check(
      "audit_event_recorded_after_occurred",
      sql`${table.recordedAt} >= ${table.occurredAt}`,
    ),
    check(
      "audit_event_hash_format",
      sql`${table.eventHash} ~ '^[0-9a-fA-F]{64}$'`,
    ),
    check(
      "audit_event_previous_hash_format",
      sql`${table.previousEventHash} is null or ${table.previousEventHash} ~ '^[0-9a-fA-F]{64}$'`,
    ),
    check(
      "audit_event_chain_pair",
      sql`(${table.previousAuditEventId} is null) = (${table.previousEventHash} is null)`,
    ),
    check(
      "audit_event_previous_not_self",
      sql`${table.previousAuditEventId} is null or ${table.previousAuditEventId} <> ${table.id}`,
    ),
  ],
);

export type AuditEvent = typeof auditEvents.$inferSelect;
export type NewAuditEvent = typeof auditEvents.$inferInsert;
