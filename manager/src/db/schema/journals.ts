import { sql } from "drizzle-orm";
import {
  check,
  date,
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

import { accountingPeriods, accounts } from "./accounting";
import { cardTransactions } from "./cards";
import { locations, organizations, staffMembers } from "./core";
import { journalBatchStatusEnum } from "./enums";
import { inventoryMovements } from "./inventory-movements";
import { purchaseLines } from "./purchasing";
import { salesOrderLines } from "./sales";
import { settlementLines } from "./settlements";
import { lifecycleTimestamps } from "./shared";

export const journalBatches = pgTable(
  "journal_batches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    accountingPeriodId: uuid("accounting_period_id")
      .notNull()
      .references(() => accountingPeriods.id, { onDelete: "restrict" }),
    batchNumber: varchar("batch_number", { length: 96 }).notNull(),
    journalDate: date("journal_date", { mode: "string" }).notNull(),
    status: journalBatchStatusEnum("status").default("draft").notNull(),
    description: text("description").notNull(),
    sourceSystem: varchar("source_system", { length: 96 }),
    sourceType: varchar("source_type", { length: 96 }),
    sourceId: uuid("source_id"),
    externalId: text("external_id"),
    controlDebitCents: integer("control_debit_cents").default(0).notNull(),
    controlCreditCents: integer("control_credit_cents").default(0).notNull(),
    postedAt: timestamp("posted_at", {
      withTimezone: true,
      precision: 3,
    }),
    postedByStaffMemberId: uuid("posted_by_staff_member_id").references(
      () => staffMembers.id,
      { onDelete: "set null" },
    ),
    reversalOfJournalBatchId: uuid(
      "reversal_of_journal_batch_id",
    ).references((): AnyPgColumn => journalBatches.id, {
      onDelete: "restrict",
    }),
    supersedesJournalBatchId: uuid(
      "supersedes_journal_batch_id",
    ).references((): AnyPgColumn => journalBatches.id, {
      onDelete: "restrict",
    }),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex("journal_batch_org_number_uidx").on(
      table.organizationId,
      table.batchNumber,
    ),
    uniqueIndex("journal_batch_source_external_uidx")
      .on(table.organizationId, table.sourceSystem, table.externalId)
      .where(
        sql`${table.sourceSystem} is not null and ${table.externalId} is not null`,
      ),
    uniqueIndex("journal_batch_reversal_uidx")
      .on(table.reversalOfJournalBatchId)
      .where(sql`${table.reversalOfJournalBatchId} is not null`),
    uniqueIndex("journal_batch_supersedes_uidx")
      .on(table.supersedesJournalBatchId)
      .where(sql`${table.supersedesJournalBatchId} is not null`),
    index("journal_batch_period_status_idx").on(
      table.accountingPeriodId,
      table.status,
      table.journalDate,
    ),
    index("journal_batch_source_idx").on(
      table.organizationId,
      table.sourceType,
      table.sourceId,
    ),
    check(
      "journal_batch_number_not_blank",
      sql`btrim(${table.batchNumber}) <> ''`,
    ),
    check(
      "journal_batch_description_not_blank",
      sql`btrim(${table.description}) <> ''`,
    ),
    check(
      "journal_batch_source_pair",
      sql`(${table.sourceType} is null) = (${table.sourceId} is null)`,
    ),
    check(
      "journal_batch_control_nonnegative",
      sql`${table.controlDebitCents} >= 0 and ${table.controlCreditCents} >= 0`,
    ),
    check(
      "journal_batch_control_balanced",
      sql`${table.controlDebitCents} = ${table.controlCreditCents}`,
    ),
    check(
      "journal_batch_posted_state",
      sql`${table.status} = 'draft' or ${table.postedAt} is not null`,
    ),
    check(
      "journal_batch_reversal_not_self",
      sql`${table.reversalOfJournalBatchId} is null or ${table.reversalOfJournalBatchId} <> ${table.id}`,
    ),
    check(
      "journal_batch_supersedes_not_self",
      sql`${table.supersedesJournalBatchId} is null or ${table.supersedesJournalBatchId} <> ${table.id}`,
    ),
  ],
);

export const journalLines = pgTable(
  "journal_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    journalBatchId: uuid("journal_batch_id")
      .notNull()
      .references(() => journalBatches.id, { onDelete: "restrict" }),
    lineNumber: integer("line_number").notNull(),
    externalId: text("external_id"),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    locationId: uuid("location_id").references(() => locations.id, {
      onDelete: "restrict",
    }),
    description: text("description"),
    debitCents: integer("debit_cents").default(0).notNull(),
    creditCents: integer("credit_cents").default(0).notNull(),
    foreignCurrency: varchar("foreign_currency", { length: 3 }),
    foreignAmountCents: integer("foreign_amount_cents"),
    exchangeRate: numeric("exchange_rate", {
      precision: 20,
      scale: 10,
      mode: "string",
    }),
    purchaseLineId: uuid("purchase_line_id").references(
      () => purchaseLines.id,
      { onDelete: "restrict" },
    ),
    cardTransactionId: uuid("card_transaction_id").references(
      () => cardTransactions.id,
      { onDelete: "restrict" },
    ),
    inventoryMovementId: uuid("inventory_movement_id").references(
      () => inventoryMovements.id,
      { onDelete: "restrict" },
    ),
    salesOrderLineId: uuid("sales_order_line_id").references(
      () => salesOrderLines.id,
      { onDelete: "restrict" },
    ),
    settlementLineId: uuid("settlement_line_id").references(
      () => settlementLines.id,
      { onDelete: "restrict" },
    ),
    reversalOfJournalLineId: uuid(
      "reversal_of_journal_line_id",
    ).references((): AnyPgColumn => journalLines.id, {
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
    uniqueIndex("journal_line_batch_number_uidx").on(
      table.journalBatchId,
      table.lineNumber,
    ),
    uniqueIndex("journal_line_batch_external_uidx")
      .on(table.journalBatchId, table.externalId)
      .where(sql`${table.externalId} is not null`),
    uniqueIndex("journal_line_reversal_uidx")
      .on(table.reversalOfJournalLineId)
      .where(sql`${table.reversalOfJournalLineId} is not null`),
    index("journal_line_account_batch_idx").on(
      table.accountId,
      table.journalBatchId,
    ),
    index("journal_line_location_idx").on(table.locationId),
    index("journal_line_purchase_idx").on(table.purchaseLineId),
    index("journal_line_card_idx").on(table.cardTransactionId),
    index("journal_line_inventory_idx").on(table.inventoryMovementId),
    index("journal_line_sales_idx").on(table.salesOrderLineId),
    index("journal_line_settlement_idx").on(table.settlementLineId),
    check("journal_line_number_positive", sql`${table.lineNumber} > 0`),
    check(
      "journal_line_one_sided_amount",
      sql`
        (${table.debitCents} > 0 and ${table.creditCents} = 0)
        or (${table.creditCents} > 0 and ${table.debitCents} = 0)
      `,
    ),
    check(
      "journal_line_foreign_values",
      sql`
        (
          ${table.foreignCurrency} is null
          and ${table.foreignAmountCents} is null
          and ${table.exchangeRate} is null
        )
        or (
          ${table.foreignCurrency} ~ '^[A-Z]{3}$'
          and ${table.foreignAmountCents} is not null
          and ${table.exchangeRate} > 0
        )
      `,
    ),
    check(
      "journal_line_single_source",
      sql`
        num_nonnulls(
          ${table.purchaseLineId},
          ${table.cardTransactionId},
          ${table.inventoryMovementId},
          ${table.salesOrderLineId},
          ${table.settlementLineId}
        ) <= 1
      `,
    ),
    check(
      "journal_line_reversal_not_self",
      sql`${table.reversalOfJournalLineId} is null or ${table.reversalOfJournalLineId} <> ${table.id}`,
    ),
  ],
);

export type JournalBatch = typeof journalBatches.$inferSelect;
export type NewJournalBatch = typeof journalBatches.$inferInsert;
export type JournalLine = typeof journalLines.$inferSelect;
export type NewJournalLine = typeof journalLines.$inferInsert;
