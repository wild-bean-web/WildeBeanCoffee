import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

import { products, unitsOfMeasure } from "./catalog";
import { locations, organizations, staffMembers } from "./core";
import { inventoryCountStatusEnum } from "./enums";
import { lifecycleTimestamps } from "./shared";

export const inventoryCountSessions = pgTable(
  "inventory_count_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
    countNumber: varchar("count_number", { length: 96 }).notNull(),
    sourceSystem: varchar("source_system", { length: 96 }),
    externalId: text("external_id"),
    status: inventoryCountStatusEnum("status").default("draft").notNull(),
    asOf: timestamp("as_of", {
      withTimezone: true,
      precision: 3,
    }).notNull(),
    startedAt: timestamp("started_at", {
      withTimezone: true,
      precision: 3,
    }),
    submittedAt: timestamp("submitted_at", {
      withTimezone: true,
      precision: 3,
    }),
    postedAt: timestamp("posted_at", {
      withTimezone: true,
      precision: 3,
    }),
    createdByStaffMemberId: uuid("created_by_staff_member_id").references(
      () => staffMembers.id,
      { onDelete: "set null" },
    ),
    approvedByStaffMemberId: uuid("approved_by_staff_member_id").references(
      () => staffMembers.id,
      { onDelete: "set null" },
    ),
    supersedesCountSessionId: uuid(
      "supersedes_count_session_id",
    ).references((): AnyPgColumn => inventoryCountSessions.id, {
      onDelete: "restrict",
    }),
    notes: text("notes"),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex("inventory_count_org_number_uidx").on(
      table.organizationId,
      table.countNumber,
    ),
    uniqueIndex("inventory_count_source_external_uidx")
      .on(table.organizationId, table.sourceSystem, table.externalId)
      .where(
        sql`${table.sourceSystem} is not null and ${table.externalId} is not null`,
      ),
    uniqueIndex("inventory_count_supersedes_uidx")
      .on(table.supersedesCountSessionId)
      .where(sql`${table.supersedesCountSessionId} is not null`),
    index("inventory_count_location_status_idx").on(
      table.locationId,
      table.status,
      table.asOf,
    ),
    check(
      "inventory_count_number_not_blank",
      sql`btrim(${table.countNumber}) <> ''`,
    ),
    check(
      "inventory_count_times_ordered",
      sql`
        (${table.startedAt} is null or ${table.startedAt} <= ${table.asOf})
        and (${table.submittedAt} is null or ${table.startedAt} is null or ${table.submittedAt} >= ${table.startedAt})
        and (${table.postedAt} is null or ${table.submittedAt} is null or ${table.postedAt} >= ${table.submittedAt})
      `,
    ),
    check(
      "inventory_count_submission_state",
      sql`${table.status} not in ('submitted', 'posted') or ${table.submittedAt} is not null`,
    ),
    check(
      "inventory_count_posting_state",
      sql`${table.status} <> 'posted' or ${table.postedAt} is not null`,
    ),
    check(
      "inventory_count_not_self_superseded",
      sql`${table.supersedesCountSessionId} is null or ${table.supersedesCountSessionId} <> ${table.id}`,
    ),
  ],
);

export const inventoryCountSections = pgTable(
  "inventory_count_sections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    countSessionId: uuid("count_session_id")
      .notNull()
      .references(() => inventoryCountSessions.id, { onDelete: "restrict" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 64 }).notNull(),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull(),
    assignedToStaffMemberId: uuid("assigned_to_staff_member_id").references(
      () => staffMembers.id,
      { onDelete: "set null" },
    ),
    status: varchar("status", { length: 32 }).default("draft").notNull(),
    leaseExpiresAt: timestamp("lease_expires_at", {
      withTimezone: true,
      precision: 3,
    }),
    submittedAt: timestamp("submitted_at", {
      withTimezone: true,
      precision: 3,
    }),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex("count_section_session_code_uidx").on(
      table.countSessionId,
      table.code,
    ),
    uniqueIndex("count_section_session_order_uidx").on(
      table.countSessionId,
      table.sortOrder,
    ),
    index("count_section_assignee_idx").on(
      table.assignedToStaffMemberId,
      table.status,
    ),
    check("count_section_order_positive", sql`${table.sortOrder} > 0`),
    check(
      "count_section_status_allowed",
      sql`${table.status} in ('draft', 'assigned', 'in_progress', 'submitted', 'approved')`,
    ),
  ],
);

export const inventoryCountLines = pgTable(
  "inventory_count_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    countSessionId: uuid("count_session_id")
      .notNull()
      .references(() => inventoryCountSessions.id, { onDelete: "restrict" }),
    countSectionId: uuid("count_section_id").references(
      () => inventoryCountSections.id,
      { onDelete: "restrict" },
    ),
    lineNumber: integer("line_number").notNull(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    uomId: uuid("uom_id")
      .notNull()
      .references(() => unitsOfMeasure.id, { onDelete: "restrict" }),
    lotCode: varchar("lot_code", { length: 128 }),
    expectedQuantity: numeric("expected_quantity", {
      precision: 20,
      scale: 6,
      mode: "string",
    }),
    countedQuantity: numeric("counted_quantity", {
      precision: 20,
      scale: 6,
      mode: "string",
    }),
    varianceQuantity: numeric("variance_quantity", {
      precision: 20,
      scale: 6,
      mode: "string",
    }),
    unitCostCents: numeric("unit_cost_cents", {
      precision: 20,
      scale: 6,
      mode: "string",
    }),
    varianceCostCents: integer("variance_cost_cents"),
    countedByStaffMemberId: uuid("counted_by_staff_member_id").references(
      () => staffMembers.id,
      { onDelete: "set null" },
    ),
    countedAt: timestamp("counted_at", {
      withTimezone: true,
      precision: 3,
    }),
    notes: text("notes"),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex("inventory_count_line_number_uidx").on(
      table.countSessionId,
      table.lineNumber,
    ),
    uniqueIndex("inventory_count_line_product_uidx")
      .on(table.countSessionId, table.productId, table.uomId)
      .where(sql`${table.lotCode} is null`),
    uniqueIndex("inventory_count_line_lot_uidx")
      .on(
        table.countSessionId,
        table.productId,
        table.uomId,
        table.lotCode,
      )
      .where(sql`${table.lotCode} is not null`),
    index("inventory_count_line_org_product_idx").on(
      table.organizationId,
      table.productId,
    ),
    index("inventory_count_line_section_idx").on(
      table.countSectionId,
      table.lineNumber,
    ),
    check(
      "inventory_count_line_number_positive",
      sql`${table.lineNumber} > 0`,
    ),
    check(
      "inventory_count_line_expected_nonnegative",
      sql`${table.expectedQuantity} is null or ${table.expectedQuantity} >= 0`,
    ),
    check(
      "inventory_count_line_counted_nonnegative",
      sql`${table.countedQuantity} is null or ${table.countedQuantity} >= 0`,
    ),
    check(
      "inventory_count_line_variance",
      sql`
        (
          ${table.expectedQuantity} is not null
          and ${table.countedQuantity} is not null
          and ${table.varianceQuantity} = ${table.countedQuantity} - ${table.expectedQuantity}
        )
        or (
          (${table.expectedQuantity} is null or ${table.countedQuantity} is null)
          and ${table.varianceQuantity} is null
        )
      `,
    ),
    check(
      "inventory_count_line_unit_cost_nonnegative",
      sql`${table.unitCostCents} is null or ${table.unitCostCents} >= 0`,
    ),
    check(
      "inventory_count_line_counted_timestamp",
      sql`${table.countedQuantity} is null or ${table.countedAt} is not null`,
    ),
  ],
);

export const inventoryCountObservations = pgTable(
  "inventory_count_observations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    countSessionId: uuid("count_session_id")
      .notNull()
      .references(() => inventoryCountSessions.id, { onDelete: "restrict" }),
    countSectionId: uuid("count_section_id")
      .notNull()
      .references(() => inventoryCountSections.id, { onDelete: "restrict" }),
    countLineId: uuid("count_line_id")
      .notNull()
      .references(() => inventoryCountLines.id, { onDelete: "restrict" }),
    clientObservationId: uuid("client_observation_id").notNull(),
    deviceId: uuid("device_id").notNull(),
    sequenceNumber: integer("sequence_number").notNull(),
    countedQuantity: numeric("counted_quantity", {
      precision: 20,
      scale: 6,
      mode: "string",
    }).notNull(),
    uomId: uuid("uom_id")
      .notNull()
      .references(() => unitsOfMeasure.id, { onDelete: "restrict" }),
    observedAt: timestamp("observed_at", {
      withTimezone: true,
      precision: 3,
    }).notNull(),
    receivedAt: timestamp("received_at", {
      withTimezone: true,
      precision: 3,
    })
      .defaultNow()
      .notNull(),
    observedByStaffMemberId: uuid("observed_by_staff_member_id")
      .notNull()
      .references(() => staffMembers.id, { onDelete: "restrict" }),
    status: varchar("status", { length: 32 }).default("accepted").notNull(),
    supersedesObservationId: uuid("supersedes_observation_id").references(
      (): AnyPgColumn => inventoryCountObservations.id,
      { onDelete: "restrict" },
    ),
    conflictReason: text("conflict_reason"),
  },
  (table) => [
    uniqueIndex("count_observation_client_uidx").on(
      table.organizationId,
      table.clientObservationId,
    ),
    uniqueIndex("count_observation_device_sequence_uidx").on(
      table.countSessionId,
      table.deviceId,
      table.sequenceNumber,
    ),
    uniqueIndex("count_observation_supersedes_uidx")
      .on(table.supersedesObservationId)
      .where(sql`${table.supersedesObservationId} is not null`),
    index("count_observation_line_idx").on(
      table.countLineId,
      table.observedAt,
    ),
    index("count_observation_section_status_idx").on(
      table.countSectionId,
      table.status,
    ),
    check(
      "count_observation_sequence_positive",
      sql`${table.sequenceNumber} > 0`,
    ),
    check(
      "count_observation_quantity_nonnegative",
      sql`${table.countedQuantity} >= 0`,
    ),
    check(
      "count_observation_status_allowed",
      sql`${table.status} in ('accepted', 'conflict', 'superseded', 'rejected')`,
    ),
    check(
      "count_observation_not_self_superseded",
      sql`${table.supersedesObservationId} is null or ${table.supersedesObservationId} <> ${table.id}`,
    ),
  ],
);

export type InventoryCountSession =
  typeof inventoryCountSessions.$inferSelect;
export type NewInventoryCountSession =
  typeof inventoryCountSessions.$inferInsert;
export type InventoryCountLine = typeof inventoryCountLines.$inferSelect;
export type NewInventoryCountLine = typeof inventoryCountLines.$inferInsert;
export type InventoryCountSection =
  typeof inventoryCountSections.$inferSelect;
export type NewInventoryCountSection =
  typeof inventoryCountSections.$inferInsert;
export type InventoryCountObservation =
  typeof inventoryCountObservations.$inferSelect;
export type NewInventoryCountObservation =
  typeof inventoryCountObservations.$inferInsert;
