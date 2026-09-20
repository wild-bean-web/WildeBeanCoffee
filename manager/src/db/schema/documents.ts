import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

import {
  products,
  purchasePacks,
  unitsOfMeasure,
  vendorItems,
  vendors,
} from "./catalog";
import { locations, organizations, staffMembers } from "./core";
import {
  extractionRunStatusEnum,
  mappingStatusEnum,
  sourceDocumentStatusEnum,
  sourceDocumentTypeEnum,
} from "./enums";
import { type JsonObject, lifecycleTimestamps } from "./shared";

export const sourceDocuments = pgTable(
  "source_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, {
        onDelete: "restrict",
      }),
    vendorId: uuid("vendor_id").references(() => vendors.id, {
      onDelete: "restrict",
    }),
    documentType: sourceDocumentTypeEnum("document_type")
      .default("unknown")
      .notNull(),
    status: sourceDocumentStatusEnum("status").default("received").notNull(),
    sourceSystem: varchar("source_system", { length: 96 }).notNull(),
    externalId: text("external_id"),
    storageKey: text("storage_key").notNull(),
    originalFileName: text("original_file_name").notNull(),
    mimeType: varchar("mime_type", { length: 128 }).notNull(),
    byteSize: bigint("byte_size", { mode: "number" }),
    sha256: varchar("sha256", { length: 64 }).notNull(),
    receivedAt: timestamp("received_at", {
      withTimezone: true,
      precision: 3,
    })
      .defaultNow()
      .notNull(),
    documentDate: date("document_date", { mode: "string" }),
    currency: varchar("currency", { length: 3 }),
    totalCents: integer("total_cents"),
    supersedesDocumentId: uuid("supersedes_document_id").references(
      (): AnyPgColumn => sourceDocuments.id,
      { onDelete: "restrict" },
    ),
    duplicateOfDocumentId: uuid("duplicate_of_document_id").references(
      (): AnyPgColumn => sourceDocuments.id,
      { onDelete: "restrict" },
    ),
    metadata: jsonb("metadata").$type<JsonObject>().default({}).notNull(),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex("source_doc_org_storage_uidx").on(
      table.organizationId,
      table.storageKey,
    ),
    index("source_doc_org_hash_idx").on(
      table.organizationId,
      table.sha256,
    ),
    uniqueIndex("source_doc_source_external_uidx")
      .on(
        table.organizationId,
        table.locationId,
        table.sourceSystem,
        table.externalId,
      )
      .where(
        sql`${table.externalId} is not null
          and ${table.status} <> 'voided'
          and ${table.status} <> 'duplicate'`,
      ),
    uniqueIndex("source_doc_location_active_hash_uidx")
      .on(table.locationId, table.sha256)
      .where(
        sql`${table.status} <> 'voided' and ${table.status} <> 'duplicate'`,
      ),
    uniqueIndex("source_doc_supersedes_uidx")
      .on(table.supersedesDocumentId)
      .where(sql`${table.supersedesDocumentId} is not null`),
    index("source_doc_duplicate_idx").on(table.duplicateOfDocumentId),
    index("source_doc_org_status_received_idx").on(
      table.organizationId,
      table.status,
      table.receivedAt,
    ),
    index("source_doc_vendor_date_idx").on(
      table.vendorId,
      table.documentDate,
    ),
    index("source_doc_location_date_idx").on(
      table.locationId,
      table.documentDate,
    ),
    index("source_doc_location_status_received_idx").on(
      table.locationId,
      table.status,
      table.receivedAt,
    ),
    index("source_doc_location_hash_idx").on(table.locationId, table.sha256),
    foreignKey({
      name: "source_doc_location_org_fk",
      columns: [table.locationId, table.organizationId],
      foreignColumns: [locations.id, locations.organizationId],
    }),
    check(
      "source_doc_source_not_blank",
      sql`btrim(${table.sourceSystem}) <> ''`,
    ),
    check(
      "source_doc_storage_not_blank",
      sql`btrim(${table.storageKey}) <> ''`,
    ),
    check(
      "source_doc_sha256_format",
      sql`${table.sha256} ~ '^[0-9a-fA-F]{64}$'`,
    ),
    check(
      "source_doc_byte_size_nonnegative",
      sql`${table.byteSize} is null or ${table.byteSize} >= 0`,
    ),
    check(
      "source_doc_currency_iso_code",
      sql`${table.currency} is null or ${table.currency} ~ '^[A-Z]{3}$'`,
    ),
    check(
      "source_doc_not_self_superseded",
      sql`${table.supersedesDocumentId} is null or ${table.supersedesDocumentId} <> ${table.id}`,
    ),
    check(
      "source_doc_not_self_duplicate",
      sql`${table.duplicateOfDocumentId} is null or ${table.duplicateOfDocumentId} <> ${table.id}`,
    ),
  ],
);

export const extractionRuns = pgTable(
  "extraction_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    sourceDocumentId: uuid("source_document_id")
      .notNull()
      .references(() => sourceDocuments.id, { onDelete: "restrict" }),
    runNumber: integer("run_number").notNull(),
    provider: varchar("provider", { length: 96 }).notNull(),
    model: varchar("model", { length: 128 }),
    parserVersion: varchar("parser_version", { length: 64 }),
    promptVersion: varchar("prompt_version", { length: 64 }),
    status: extractionRunStatusEnum("status").default("queued").notNull(),
    startedAt: timestamp("started_at", {
      withTimezone: true,
      precision: 3,
    }),
    finishedAt: timestamp("finished_at", {
      withTimezone: true,
      precision: 3,
    }),
    confidence: numeric("confidence", {
      precision: 7,
      scale: 6,
      mode: "string",
    }),
    rawOutput: jsonb("raw_output").$type<JsonObject>(),
    errorMessage: text("error_message"),
    supersedesRunId: uuid("supersedes_run_id").references(
      (): AnyPgColumn => extractionRuns.id,
      { onDelete: "restrict" },
    ),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex("extraction_run_doc_number_uidx").on(
      table.sourceDocumentId,
      table.runNumber,
    ),
    uniqueIndex("extraction_run_supersedes_uidx")
      .on(table.supersedesRunId)
      .where(sql`${table.supersedesRunId} is not null`),
    index("extraction_run_org_status_idx").on(
      table.organizationId,
      table.status,
      table.createdAt,
    ),
    index("extraction_run_doc_finished_idx").on(
      table.sourceDocumentId,
      table.finishedAt,
    ),
    check("extraction_run_number_positive", sql`${table.runNumber} > 0`),
    check(
      "extraction_run_confidence_range",
      sql`${table.confidence} is null or (${table.confidence} >= 0 and ${table.confidence} <= 1)`,
    ),
    check(
      "extraction_run_times_ordered",
      sql`${table.finishedAt} is null or ${table.startedAt} is null or ${table.finishedAt} >= ${table.startedAt}`,
    ),
    check(
      "extraction_run_not_self_superseded",
      sql`${table.supersedesRunId} is null or ${table.supersedesRunId} <> ${table.id}`,
    ),
  ],
);

export const documentLines = pgTable(
  "document_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    sourceDocumentId: uuid("source_document_id")
      .notNull()
      .references(() => sourceDocuments.id, { onDelete: "restrict" }),
    extractionRunId: uuid("extraction_run_id")
      .notNull()
      .references(() => extractionRuns.id, { onDelete: "restrict" }),
    lineNumber: integer("line_number").notNull(),
    sourceLineId: text("source_line_id"),
    description: text("description").notNull(),
    vendorSku: varchar("vendor_sku", { length: 128 }),
    quantity: numeric("quantity", {
      precision: 20,
      scale: 6,
      mode: "string",
    }),
    uomText: varchar("uom_text", { length: 64 }),
    unitCostCents: numeric("unit_cost_cents", {
      precision: 20,
      scale: 6,
      mode: "string",
    }),
    subtotalCents: integer("subtotal_cents"),
    taxCents: integer("tax_cents"),
    totalCents: integer("total_cents"),
    serviceDate: date("service_date", { mode: "string" }),
    confidence: numeric("confidence", {
      precision: 7,
      scale: 6,
      mode: "string",
    }),
    boundingBox: jsonb("bounding_box").$type<JsonObject>(),
    rawData: jsonb("raw_data").$type<JsonObject>().default({}).notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      precision: 3,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("document_line_run_number_uidx").on(
      table.extractionRunId,
      table.lineNumber,
    ),
    uniqueIndex("document_line_run_source_uidx")
      .on(table.extractionRunId, table.sourceLineId)
      .where(sql`${table.sourceLineId} is not null`),
    index("document_line_document_idx").on(
      table.sourceDocumentId,
      table.lineNumber,
    ),
    index("document_line_org_vendor_sku_idx").on(
      table.organizationId,
      table.vendorSku,
    ),
    check("document_line_number_positive", sql`${table.lineNumber} > 0`),
    check(
      "document_line_description_not_blank",
      sql`btrim(${table.description}) <> ''`,
    ),
    check(
      "document_line_unit_cost_nonnegative",
      sql`${table.unitCostCents} is null or ${table.unitCostCents} >= 0`,
    ),
    check(
      "document_line_confidence_range",
      sql`${table.confidence} is null or (${table.confidence} >= 0 and ${table.confidence} <= 1)`,
    ),
  ],
);

export const mappingRevisions = pgTable(
  "mapping_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    documentLineId: uuid("document_line_id")
      .notNull()
      .references(() => documentLines.id, { onDelete: "restrict" }),
    revisionNumber: integer("revision_number").notNull(),
    status: mappingStatusEnum("status").default("unmapped").notNull(),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "restrict",
    }),
    vendorItemId: uuid("vendor_item_id").references(() => vendorItems.id, {
      onDelete: "restrict",
    }),
    purchasePackId: uuid("purchase_pack_id").references(
      () => purchasePacks.id,
      { onDelete: "restrict" },
    ),
    mappedQuantity: numeric("mapped_quantity", {
      precision: 20,
      scale: 6,
      mode: "string",
    }),
    mappedUomId: uuid("mapped_uom_id").references(() => unitsOfMeasure.id, {
      onDelete: "restrict",
    }),
    confidence: numeric("confidence", {
      precision: 7,
      scale: 6,
      mode: "string",
    }),
    rationale: text("rationale"),
    createdByStaffMemberId: uuid("created_by_staff_member_id").references(
      () => staffMembers.id,
      { onDelete: "set null" },
    ),
    supersedesMappingRevisionId: uuid(
      "supersedes_mapping_revision_id",
    ).references((): AnyPgColumn => mappingRevisions.id, {
      onDelete: "restrict",
    }),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      precision: 3,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("mapping_revision_line_number_uidx").on(
      table.documentLineId,
      table.revisionNumber,
    ),
    uniqueIndex("mapping_revision_supersedes_uidx")
      .on(table.supersedesMappingRevisionId)
      .where(sql`${table.supersedesMappingRevisionId} is not null`),
    index("mapping_revision_line_created_idx").on(
      table.documentLineId,
      table.createdAt,
    ),
    index("mapping_revision_product_idx").on(
      table.organizationId,
      table.productId,
    ),
    check(
      "mapping_revision_number_positive",
      sql`${table.revisionNumber} > 0`,
    ),
    check(
      "mapping_revision_confidence_range",
      sql`${table.confidence} is null or (${table.confidence} >= 0 and ${table.confidence} <= 1)`,
    ),
    check(
      "mapping_revision_quantity_uom_pair",
      sql`(${table.mappedQuantity} is null) = (${table.mappedUomId} is null)`,
    ),
    check(
      "mapping_revision_confirmed_target",
      sql`${table.status} <> 'confirmed' or coalesce(${table.productId}, ${table.vendorItemId}, ${table.purchasePackId}) is not null`,
    ),
    check(
      "mapping_revision_not_self_superseded",
      sql`${table.supersedesMappingRevisionId} is null or ${table.supersedesMappingRevisionId} <> ${table.id}`,
    ),
  ],
);

export type SourceDocument = typeof sourceDocuments.$inferSelect;
export type NewSourceDocument = typeof sourceDocuments.$inferInsert;
export type ExtractionRun = typeof extractionRuns.$inferSelect;
export type NewExtractionRun = typeof extractionRuns.$inferInsert;
export type DocumentLine = typeof documentLines.$inferSelect;
export type NewDocumentLine = typeof documentLines.$inferInsert;
export type MappingRevision = typeof mappingRevisions.$inferSelect;
export type NewMappingRevision = typeof mappingRevisions.$inferInsert;
