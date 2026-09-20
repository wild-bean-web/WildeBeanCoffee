import { sql } from "drizzle-orm";
import {
  check,
  date,
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

import { accounts } from "./accounting";
import { locations, organizations, staffMembers } from "./core";
import { sourceDocuments } from "./documents";
import {
  cardAccountTypeEnum,
  cardMatchMethodEnum,
  cardMatchStatusEnum,
  cardTransactionStatusEnum,
} from "./enums";
import { purchases } from "./purchasing";
import { type JsonObject, lifecycleTimestamps } from "./shared";

export const cardAccounts = pgTable(
  "card_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    accountType: cardAccountTypeEnum("account_type").notNull(),
    issuer: varchar("issuer", { length: 96 }).notNull(),
    lastFour: varchar("last_four", { length: 4 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    sourceSystem: varchar("source_system", { length: 96 }).notNull(),
    externalId: text("external_id").notNull(),
    ledgerAccountId: uuid("ledger_account_id").references(() => accounts.id, {
      onDelete: "restrict",
    }),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex("card_account_source_external_uidx").on(
      table.organizationId,
      table.sourceSystem,
      table.externalId,
    ),
    index("card_account_org_idx").on(table.organizationId),
    index("card_account_ledger_idx").on(table.ledgerAccountId),
    check("card_account_name_not_blank", sql`btrim(${table.name}) <> ''`),
    check(
      "card_account_source_not_blank",
      sql`btrim(${table.sourceSystem}) <> ''`,
    ),
    check("card_account_last_four_digits", sql`${table.lastFour} ~ '^[0-9]{4}$'`),
    check(
      "card_account_currency_iso_code",
      sql`${table.currency} ~ '^[A-Z]{3}$'`,
    ),
  ],
);

export const cardTransactions = pgTable(
  "card_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    cardAccountId: uuid("card_account_id")
      .notNull()
      .references(() => cardAccounts.id, { onDelete: "restrict" }),
    locationId: uuid("location_id").references(() => locations.id, {
      onDelete: "restrict",
    }),
    sourceDocumentId: uuid("source_document_id").references(
      () => sourceDocuments.id,
      { onDelete: "restrict" },
    ),
    sourceSystem: varchar("source_system", { length: 96 }).notNull(),
    externalId: text("external_id").notNull(),
    status: cardTransactionStatusEnum("status").default("pending").notNull(),
    authorizedAt: timestamp("authorized_at", {
      withTimezone: true,
      precision: 3,
    }),
    postedOn: date("posted_on", { mode: "string" }),
    merchantName: text("merchant_name").notNull(),
    normalizedMerchantName: text("normalized_merchant_name"),
    merchantCategoryCode: varchar("merchant_category_code", { length: 8 }),
    authorizationCode: varchar("authorization_code", { length: 64 }),
    amountCents: integer("amount_cents").notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    rawData: jsonb("raw_data").$type<JsonObject>().default({}).notNull(),
    reversalOfCardTransactionId: uuid(
      "reversal_of_card_transaction_id",
    ).references((): AnyPgColumn => cardTransactions.id, {
      onDelete: "restrict",
    }),
    supersedesCardTransactionId: uuid(
      "supersedes_card_transaction_id",
    ).references((): AnyPgColumn => cardTransactions.id, {
      onDelete: "restrict",
    }),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex("card_tx_source_external_uidx").on(
      table.cardAccountId,
      table.sourceSystem,
      table.externalId,
    ),
    uniqueIndex("card_tx_reversal_of_uidx")
      .on(table.reversalOfCardTransactionId)
      .where(sql`${table.reversalOfCardTransactionId} is not null`),
    uniqueIndex("card_tx_supersedes_uidx")
      .on(table.supersedesCardTransactionId)
      .where(sql`${table.supersedesCardTransactionId} is not null`),
    index("card_tx_org_posted_idx").on(
      table.organizationId,
      table.postedOn,
    ),
    index("card_tx_account_status_idx").on(
      table.cardAccountId,
      table.status,
      table.postedOn,
    ),
    index("card_tx_merchant_idx").on(
      table.organizationId,
      table.normalizedMerchantName,
    ),
    check(
      "card_tx_source_not_blank",
      sql`btrim(${table.sourceSystem}) <> ''`,
    ),
    check(
      "card_tx_merchant_not_blank",
      sql`btrim(${table.merchantName}) <> ''`,
    ),
    check("card_tx_amount_nonzero", sql`${table.amountCents} <> 0`),
    check(
      "card_tx_currency_iso_code",
      sql`${table.currency} ~ '^[A-Z]{3}$'`,
    ),
    check(
      "card_tx_reversal_not_self",
      sql`${table.reversalOfCardTransactionId} is null or ${table.reversalOfCardTransactionId} <> ${table.id}`,
    ),
    check(
      "card_tx_supersedes_not_self",
      sql`${table.supersedesCardTransactionId} is null or ${table.supersedesCardTransactionId} <> ${table.id}`,
    ),
  ],
);

export const cardTransactionMatches = pgTable(
  "card_transaction_matches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    cardTransactionId: uuid("card_transaction_id")
      .notNull()
      .references(() => cardTransactions.id, { onDelete: "restrict" }),
    purchaseId: uuid("purchase_id")
      .notNull()
      .references(() => purchases.id, { onDelete: "restrict" }),
    revisionNumber: integer("revision_number").notNull(),
    status: cardMatchStatusEnum("status").default("proposed").notNull(),
    method: cardMatchMethodEnum("method").notNull(),
    matchedAmountCents: integer("matched_amount_cents").notNull(),
    confidence: numeric("confidence", {
      precision: 7,
      scale: 6,
      mode: "string",
    }),
    rationale: text("rationale"),
    matchedByStaffMemberId: uuid("matched_by_staff_member_id").references(
      () => staffMembers.id,
      { onDelete: "set null" },
    ),
    supersedesMatchId: uuid("supersedes_match_id").references(
      (): AnyPgColumn => cardTransactionMatches.id,
      { onDelete: "restrict" },
    ),
    reversalOfMatchId: uuid("reversal_of_match_id").references(
      (): AnyPgColumn => cardTransactionMatches.id,
      { onDelete: "restrict" },
    ),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex("card_match_tx_purchase_revision_uidx").on(
      table.cardTransactionId,
      table.purchaseId,
      table.revisionNumber,
    ),
    uniqueIndex("card_match_supersedes_uidx")
      .on(table.supersedesMatchId)
      .where(sql`${table.supersedesMatchId} is not null`),
    uniqueIndex("card_match_reversal_of_uidx")
      .on(table.reversalOfMatchId)
      .where(sql`${table.reversalOfMatchId} is not null`),
    index("card_match_tx_status_idx").on(
      table.cardTransactionId,
      table.status,
    ),
    index("card_match_purchase_status_idx").on(table.purchaseId, table.status),
    check(
      "card_match_revision_positive",
      sql`${table.revisionNumber} > 0`,
    ),
    check(
      "card_match_amount_positive",
      sql`${table.matchedAmountCents} > 0`,
    ),
    check(
      "card_match_confidence_range",
      sql`${table.confidence} is null or (${table.confidence} >= 0 and ${table.confidence} <= 1)`,
    ),
    check(
      "card_match_not_self_superseded",
      sql`${table.supersedesMatchId} is null or ${table.supersedesMatchId} <> ${table.id}`,
    ),
    check(
      "card_match_not_self_reversed",
      sql`${table.reversalOfMatchId} is null or ${table.reversalOfMatchId} <> ${table.id}`,
    ),
  ],
);

export type CardAccount = typeof cardAccounts.$inferSelect;
export type NewCardAccount = typeof cardAccounts.$inferInsert;
export type CardTransaction = typeof cardTransactions.$inferSelect;
export type NewCardTransaction = typeof cardTransactions.$inferInsert;
export type CardTransactionMatch =
  typeof cardTransactionMatches.$inferSelect;
export type NewCardTransactionMatch =
  typeof cardTransactionMatches.$inferInsert;
