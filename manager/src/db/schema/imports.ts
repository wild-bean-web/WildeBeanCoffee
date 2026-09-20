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
} from "drizzle-orm/pg-core";
import { organizations, staffMembers } from "./core";
import { type JsonObject, lifecycleTimestamps } from "./shared";

export const importBatches = pgTable(
  "import_batches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    importKind: varchar("import_kind", { length: 96 }).notNull(),
    sourceFilename: text("source_filename").notNull(),
    sourceSha256: varchar("source_sha256", { length: 64 }).notNull(),
    parserVersion: varchar("parser_version", { length: 64 }).notNull(),
    status: varchar("status", { length: 32 }).default("staged").notNull(),
    rowCount: integer("row_count").default(0).notNull(),
    readyCount: integer("ready_count").default(0).notNull(),
    reviewCount: integer("review_count").default(0).notNull(),
    approvedByStaffMemberId: uuid("approved_by_staff_member_id").references(
      () => staffMembers.id,
      { onDelete: "set null" },
    ),
    approvedAt: timestamp("approved_at", {
      withTimezone: true,
      precision: 3,
    }),
    metadata: jsonb("metadata").$type<JsonObject>().default({}).notNull(),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex("import_batch_source_parser_uidx").on(
      table.organizationId,
      table.importKind,
      table.sourceSha256,
      table.parserVersion,
    ),
    index("import_batch_status_idx").on(
      table.organizationId,
      table.status,
      table.createdAt,
    ),
    check(
      "import_batch_status_allowed",
      sql`${table.status} in ('staged', 'reviewing', 'approved', 'posted', 'failed', 'voided')`,
    ),
    check(
      "import_batch_counts_nonnegative",
      sql`${table.rowCount} >= 0 and ${table.readyCount} >= 0 and ${table.reviewCount} >= 0`,
    ),
    check(
      "import_batch_sha_format",
      sql`${table.sourceSha256} ~ '^[0-9a-f]{64}$'`,
    ),
  ],
);

export const importRows = pgTable(
  "import_rows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    importBatchId: uuid("import_batch_id")
      .notNull()
      .references(() => importBatches.id, { onDelete: "restrict" }),
    sourceRowNumber: integer("source_row_number").notNull(),
    status: varchar("status", { length: 32 }).default("needs_review").notNull(),
    rawData: jsonb("raw_data").$type<JsonObject>().notNull(),
    normalizedData: jsonb("normalized_data").$type<JsonObject>().notNull(),
    issues: jsonb("issues").$type<readonly string[]>().default([]).notNull(),
    targetEntityType: varchar("target_entity_type", { length: 96 }),
    targetEntityId: uuid("target_entity_id"),
    reviewedByStaffMemberId: uuid("reviewed_by_staff_member_id").references(
      () => staffMembers.id,
      { onDelete: "set null" },
    ),
    reviewedAt: timestamp("reviewed_at", {
      withTimezone: true,
      precision: 3,
    }),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex("import_row_batch_source_uidx").on(
      table.importBatchId,
      table.sourceRowNumber,
    ),
    index("import_row_batch_status_idx").on(
      table.importBatchId,
      table.status,
      table.sourceRowNumber,
    ),
    index("import_row_target_idx").on(
      table.organizationId,
      table.targetEntityType,
      table.targetEntityId,
    ),
    check(
      "import_row_source_positive",
      sql`${table.sourceRowNumber} > 0`,
    ),
    check(
      "import_row_status_allowed",
      sql`${table.status} in ('ready', 'needs_review', 'approved', 'posted', 'rejected')`,
    ),
    check(
      "import_row_target_pair",
      sql`(${table.targetEntityType} is null) = (${table.targetEntityId} is null)`,
    ),
  ],
);

export type ImportBatch = typeof importBatches.$inferSelect;
export type NewImportBatch = typeof importBatches.$inferInsert;
export type ImportRow = typeof importRows.$inferSelect;
export type NewImportRow = typeof importRows.$inferInsert;
