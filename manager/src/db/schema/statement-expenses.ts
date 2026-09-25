import { sql } from "drizzle-orm";
import { date, index, integer, pgTable, text, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { organizations } from "./core";
import { lifecycleTimestamps } from "./shared";

export const statementUploads = pgTable(
  "statement_uploads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    sha256: text("sha256").notNull(),
    filename: text("filename").notNull(),
    status: varchar("status", { length: 40 }).notNull(),
    startsOn: date("starts_on", { mode: "string" }),
    endsOn: date("ends_on", { mode: "string" }),
    parsedCount: integer("parsed_count").default(0).notNull(),
    addedCount: integer("added_count").default(0).notNull(),
    skippedCount: integer("skipped_count").default(0).notNull(),
    message: text("message").notNull(),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex("statement_uploads_org_sha_uidx").on(table.organizationId, table.sha256),
    index("statement_uploads_recent_idx").on(table.organizationId, table.createdAt),
  ],
);

export const statementExpenseLines = pgTable(
  "statement_expense_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    businessDate: date("business_date", { mode: "string" }).notNull(),
    description: text("description").notNull(),
    expenseGroup: varchar("expense_group", { length: 32 }).notNull(),
    category: text("category").notNull(),
    signedCents: integer("signed_cents").notNull(),
    sourceFile: text("source_file").notNull(),
    sourceIndex: integer("source_index").notNull(),
    fingerprint: text("fingerprint"),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex("statement_expense_source_uidx").on(
      table.organizationId,
      table.sourceFile,
      table.sourceIndex,
    ),
    index("statement_expense_date_idx").on(table.organizationId, table.businessDate),
    uniqueIndex("statement_expense_fingerprint_uidx")
      .on(table.organizationId, table.fingerprint)
      .where(sql`fingerprint is not null`),
  ],
);
