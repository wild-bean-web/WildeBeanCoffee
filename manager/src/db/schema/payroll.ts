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
} from "drizzle-orm/pg-core";

import { accountingPeriods } from "./accounting";
import { locations, organizations, staffMembers } from "./core";
import { sourceDocuments } from "./documents";
import { payrollRunStatusEnum } from "./enums";
import { type JsonObject, lifecycleTimestamps } from "./shared";

export const payrollRuns = pgTable(
  "payroll_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
    sourceDocumentId: uuid("source_document_id")
      .notNull()
      .references(() => sourceDocuments.id, { onDelete: "restrict" }),
    accountingPeriodId: uuid("accounting_period_id").references(
      () => accountingPeriods.id,
      { onDelete: "restrict" },
    ),
    status: payrollRunStatusEnum("status").default("draft").notNull(),
    companyName: text("company_name"),
    checkDate: date("check_date", { mode: "string" }),
    periodStartsOn: date("period_starts_on", { mode: "string" }),
    periodEndsOn: date("period_ends_on", { mode: "string" }),
    batchReference: varchar("batch_reference", { length: 96 }),
    employeeCount: integer("employee_count").default(0).notNull(),
    regularHours: numeric("regular_hours", {
      precision: 20,
      scale: 6,
      mode: "string",
    })
      .default("0")
      .notNull(),
    overtimeHours: numeric("overtime_hours", {
      precision: 20,
      scale: 6,
      mode: "string",
    })
      .default("0")
      .notNull(),
    totalHours: numeric("total_hours", {
      precision: 20,
      scale: 6,
      mode: "string",
    })
      .default("0")
      .notNull(),
    regularWagesCents: integer("regular_wages_cents").default(0).notNull(),
    overtimeWagesCents: integer("overtime_wages_cents").default(0).notNull(),
    tipsCents: integer("tips_cents").default(0).notNull(),
    wagesCents: integer("wages_cents").default(0).notNull(),
    grossCents: integer("gross_cents").default(0).notNull(),
    employeeTaxCents: integer("employee_tax_cents").default(0).notNull(),
    netPayCents: integer("net_pay_cents").default(0).notNull(),
    employerTaxCents: integer("employer_tax_cents").default(0).notNull(),
    loadedLaborCents: integer("loaded_labor_cents").default(0).notNull(),
    snapshot: jsonb("snapshot").$type<JsonObject>().default({}).notNull(),
    postedAt: timestamp("posted_at", {
      withTimezone: true,
      precision: 3,
    }),
    postedByStaffMemberId: uuid("posted_by_staff_member_id").references(
      () => staffMembers.id,
      { onDelete: "set null" },
    ),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex("payroll_run_source_document_uidx").on(table.sourceDocumentId),
    uniqueIndex("payroll_run_location_period_uidx")
      .on(
        table.locationId,
        table.periodStartsOn,
        table.periodEndsOn,
        table.checkDate,
      )
      .where(sql`${table.status} <> 'voided'`),
    index("payroll_run_location_status_idx").on(
      table.locationId,
      table.status,
      table.periodEndsOn,
    ),
    check(
      "payroll_run_employee_count_nonnegative",
      sql`${table.employeeCount} >= 0`,
    ),
    check(
      "payroll_run_money_nonnegative",
      sql`${table.regularWagesCents} >= 0
        and ${table.overtimeWagesCents} >= 0
        and ${table.tipsCents} >= 0
        and ${table.wagesCents} >= 0
        and ${table.grossCents} >= 0
        and ${table.employeeTaxCents} >= 0
        and ${table.netPayCents} >= 0
        and ${table.employerTaxCents} >= 0
        and ${table.loadedLaborCents} >= 0`,
    ),
    check(
      "payroll_run_posting_state",
      sql`${table.status} <> 'posted' or ${table.postedAt} is not null`,
    ),
  ],
);

export const payrollEmployees = pgTable(
  "payroll_employees",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    payrollRunId: uuid("payroll_run_id")
      .notNull()
      .references(() => payrollRuns.id, { onDelete: "restrict" }),
    lineNumber: integer("line_number").notNull(),
    displayName: text("display_name").notNull(),
    familyName: text("family_name").notNull(),
    givenName: text("given_name").notNull(),
    regularHours: numeric("regular_hours", {
      precision: 20,
      scale: 6,
      mode: "string",
    })
      .default("0")
      .notNull(),
    overtimeHours: numeric("overtime_hours", {
      precision: 20,
      scale: 6,
      mode: "string",
    })
      .default("0")
      .notNull(),
    totalHours: numeric("total_hours", {
      precision: 20,
      scale: 6,
      mode: "string",
    })
      .default("0")
      .notNull(),
    regularRate: numeric("regular_rate", {
      precision: 20,
      scale: 6,
      mode: "string",
    }),
    overtimeRate: numeric("overtime_rate", {
      precision: 20,
      scale: 6,
      mode: "string",
    }),
    regularWagesCents: integer("regular_wages_cents").default(0).notNull(),
    overtimeWagesCents: integer("overtime_wages_cents").default(0).notNull(),
    tipsCents: integer("tips_cents").default(0).notNull(),
    wagesCents: integer("wages_cents").default(0).notNull(),
    grossCents: integer("gross_cents").default(0).notNull(),
    employeeTaxCents: integer("employee_tax_cents").default(0).notNull(),
    netPayCents: integer("net_pay_cents").default(0).notNull(),
    employerTaxCents: integer("employer_tax_cents").default(0).notNull(),
    loadedLaborCents: integer("loaded_labor_cents").default(0).notNull(),
    earnings: jsonb("earnings").$type<JsonObject>().default({}).notNull(),
    employeeTaxes: jsonb("employee_taxes").$type<JsonObject>().default({}).notNull(),
    employerLiabilities: jsonb("employer_liabilities")
      .$type<JsonObject>()
      .default({})
      .notNull(),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex("payroll_employee_run_line_uidx").on(
      table.payrollRunId,
      table.lineNumber,
    ),
    index("payroll_employee_run_name_idx").on(
      table.payrollRunId,
      table.familyName,
    ),
    check("payroll_employee_line_positive", sql`${table.lineNumber} > 0`),
    check(
      "payroll_employee_name_not_blank",
      sql`btrim(${table.displayName}) <> ''`,
    ),
  ],
);

export type PayrollRun = typeof payrollRuns.$inferSelect;
export type NewPayrollRun = typeof payrollRuns.$inferInsert;
export type PayrollEmployee = typeof payrollEmployees.$inferSelect;
export type NewPayrollEmployee = typeof payrollEmployees.$inferInsert;
