import { sql } from "drizzle-orm";
import {
  check,
  date,
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
import { sourceDocuments } from "./documents";
import {
  settlementLineTypeEnum,
  settlementStatusEnum,
} from "./enums";
import { salesOrders } from "./sales";
import { type JsonObject, lifecycleTimestamps } from "./shared";

export const settlements = pgTable(
  "settlements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    locationId: uuid("location_id").references(() => locations.id, {
      onDelete: "restrict",
    }),
    sourceDocumentId: uuid("source_document_id").references(
      () => sourceDocuments.id,
      { onDelete: "restrict" },
    ),
    sourceSystem: varchar("source_system", { length: 96 }).notNull(),
    externalId: text("external_id").notNull(),
    settlementNumber: varchar("settlement_number", { length: 96 }),
    status: settlementStatusEnum("status").default("pending").notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    periodStartsOn: date("period_starts_on", { mode: "string" }),
    periodEndsOn: date("period_ends_on", { mode: "string" }),
    initiatedAt: timestamp("initiated_at", {
      withTimezone: true,
      precision: 3,
    }),
    paidAt: timestamp("paid_at", {
      withTimezone: true,
      precision: 3,
    }),
    grossCents: integer("gross_cents").notNull(),
    refundCents: integer("refund_cents").default(0).notNull(),
    feeCents: integer("fee_cents").default(0).notNull(),
    adjustmentCents: integer("adjustment_cents").default(0).notNull(),
    netCents: integer("net_cents").notNull(),
    bankReference: text("bank_reference"),
    rawData: jsonb("raw_data").$type<JsonObject>().default({}).notNull(),
    reversalOfSettlementId: uuid("reversal_of_settlement_id").references(
      (): AnyPgColumn => settlements.id,
      { onDelete: "restrict" },
    ),
    supersedesSettlementId: uuid("supersedes_settlement_id").references(
      (): AnyPgColumn => settlements.id,
      { onDelete: "restrict" },
    ),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex("settlement_source_external_uidx").on(
      table.organizationId,
      table.sourceSystem,
      table.externalId,
    ),
    uniqueIndex("settlement_reversal_of_uidx")
      .on(table.reversalOfSettlementId)
      .where(sql`${table.reversalOfSettlementId} is not null`),
    uniqueIndex("settlement_supersedes_uidx")
      .on(table.supersedesSettlementId)
      .where(sql`${table.supersedesSettlementId} is not null`),
    index("settlement_org_status_paid_idx").on(
      table.organizationId,
      table.status,
      table.paidAt,
    ),
    index("settlement_location_period_idx").on(
      table.locationId,
      table.periodStartsOn,
      table.periodEndsOn,
    ),
    check(
      "settlement_source_not_blank",
      sql`btrim(${table.sourceSystem}) <> ''`,
    ),
    check(
      "settlement_currency_iso_code",
      sql`${table.currency} ~ '^[A-Z]{3}$'`,
    ),
    check(
      "settlement_period_dates_ordered",
      sql`${table.periodEndsOn} is null or ${table.periodStartsOn} is null or ${table.periodEndsOn} >= ${table.periodStartsOn}`,
    ),
    check(
      "settlement_amounts_reconcile",
      sql`${table.netCents} = ${table.grossCents} - ${table.refundCents} - ${table.feeCents} + ${table.adjustmentCents}`,
    ),
    check(
      "settlement_paid_state",
      sql`${table.status} not in ('paid', 'reversed') or ${table.paidAt} is not null`,
    ),
    check(
      "settlement_reversal_not_self",
      sql`${table.reversalOfSettlementId} is null or ${table.reversalOfSettlementId} <> ${table.id}`,
    ),
    check(
      "settlement_supersedes_not_self",
      sql`${table.supersedesSettlementId} is null or ${table.supersedesSettlementId} <> ${table.id}`,
    ),
  ],
);

export const settlementLines = pgTable(
  "settlement_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    settlementId: uuid("settlement_id")
      .notNull()
      .references(() => settlements.id, { onDelete: "restrict" }),
    lineNumber: integer("line_number").notNull(),
    lineType: settlementLineTypeEnum("line_type").notNull(),
    salesOrderId: uuid("sales_order_id").references(() => salesOrders.id, {
      onDelete: "restrict",
    }),
    externalId: text("external_id"),
    sourceTransactionId: text("source_transaction_id"),
    occurredAt: timestamp("occurred_at", {
      withTimezone: true,
      precision: 3,
    }),
    description: text("description"),
    amountCents: integer("amount_cents").notNull(),
    reversalOfSettlementLineId: uuid(
      "reversal_of_settlement_line_id",
    ).references((): AnyPgColumn => settlementLines.id, {
      onDelete: "restrict",
    }),
    supersedesSettlementLineId: uuid(
      "supersedes_settlement_line_id",
    ).references((): AnyPgColumn => settlementLines.id, {
      onDelete: "restrict",
    }),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex("settlement_line_number_uidx").on(
      table.settlementId,
      table.lineNumber,
    ),
    uniqueIndex("settlement_line_external_uidx")
      .on(table.settlementId, table.externalId)
      .where(sql`${table.externalId} is not null`),
    uniqueIndex("settlement_line_reversal_uidx")
      .on(table.reversalOfSettlementLineId)
      .where(sql`${table.reversalOfSettlementLineId} is not null`),
    uniqueIndex("settlement_line_supersedes_uidx")
      .on(table.supersedesSettlementLineId)
      .where(sql`${table.supersedesSettlementLineId} is not null`),
    index("settlement_line_sales_order_idx").on(table.salesOrderId),
    index("settlement_line_source_tx_idx").on(
      table.organizationId,
      table.sourceTransactionId,
    ),
    check("settlement_line_number_positive", sql`${table.lineNumber} > 0`),
    check(
      "settlement_line_amount_nonzero",
      sql`${table.amountCents} <> 0`,
    ),
    check(
      "settlement_line_reversal_not_self",
      sql`${table.reversalOfSettlementLineId} is null or ${table.reversalOfSettlementLineId} <> ${table.id}`,
    ),
    check(
      "settlement_line_supersedes_not_self",
      sql`${table.supersedesSettlementLineId} is null or ${table.supersedesSettlementLineId} <> ${table.id}`,
    ),
  ],
);

export type Settlement = typeof settlements.$inferSelect;
export type NewSettlement = typeof settlements.$inferInsert;
export type SettlementLine = typeof settlementLines.$inferSelect;
export type NewSettlementLine = typeof settlementLines.$inferInsert;
