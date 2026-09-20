import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

import { organizations, staffMembers } from "./core";
import {
  accountingPeriodStatusEnum,
  accountTypeEnum,
  normalBalanceEnum,
} from "./enums";
import { lifecycleTimestamps } from "./shared";

export const accountingPeriods = pgTable(
  "accounting_periods",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    fiscalYear: integer("fiscal_year").notNull(),
    periodNumber: smallint("period_number").notNull(),
    name: text("name").notNull(),
    startsOn: date("starts_on", { mode: "string" }).notNull(),
    endsOn: date("ends_on", { mode: "string" }).notNull(),
    status: accountingPeriodStatusEnum("status").default("open").notNull(),
    softClosedAt: timestamp("soft_closed_at", {
      withTimezone: true,
      precision: 3,
    }),
    closedAt: timestamp("closed_at", {
      withTimezone: true,
      precision: 3,
    }),
    closedByStaffMemberId: uuid("closed_by_staff_member_id").references(
      () => staffMembers.id,
      { onDelete: "set null" },
    ),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex("accounting_period_year_number_uidx").on(
      table.organizationId,
      table.fiscalYear,
      table.periodNumber,
    ),
    uniqueIndex("accounting_period_dates_uidx").on(
      table.organizationId,
      table.startsOn,
      table.endsOn,
    ),
    index("accounting_period_org_status_idx").on(
      table.organizationId,
      table.status,
      table.startsOn,
    ),
    check(
      "accounting_period_number_positive",
      sql`${table.periodNumber} > 0`,
    ),
    check(
      "accounting_period_dates_ordered",
      sql`${table.endsOn} >= ${table.startsOn}`,
    ),
    check(
      "accounting_period_close_state",
      sql`
        (${table.status} = 'open' and ${table.closedAt} is null)
        or (${table.status} = 'soft_closed' and ${table.softClosedAt} is not null and ${table.closedAt} is null)
        or (${table.status} = 'closed' and ${table.closedAt} is not null)
      `,
    ),
  ],
);

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 64 }).notNull(),
    name: text("name").notNull(),
    description: text("description"),
    accountType: accountTypeEnum("account_type").notNull(),
    normalBalance: normalBalanceEnum("normal_balance").notNull(),
    parentAccountId: uuid("parent_account_id").references(
      (): AnyPgColumn => accounts.id,
      { onDelete: "restrict" },
    ),
    externalId: text("external_id"),
    allowPosting: boolean("allow_posting").default(true).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex("account_org_code_uidx").on(
      table.organizationId,
      table.code,
    ),
    uniqueIndex("account_org_external_uidx")
      .on(table.organizationId, table.externalId)
      .where(sql`${table.externalId} is not null`),
    index("account_org_type_active_idx").on(
      table.organizationId,
      table.accountType,
      table.isActive,
    ),
    index("account_parent_idx").on(table.parentAccountId),
    check("account_code_not_blank", sql`btrim(${table.code}) <> ''`),
    check("account_name_not_blank", sql`btrim(${table.name}) <> ''`),
    check(
      "account_parent_not_self",
      sql`${table.parentAccountId} is null or ${table.parentAccountId} <> ${table.id}`,
    ),
  ],
);

export type AccountingPeriod = typeof accountingPeriods.$inferSelect;
export type NewAccountingPeriod = typeof accountingPeriods.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
