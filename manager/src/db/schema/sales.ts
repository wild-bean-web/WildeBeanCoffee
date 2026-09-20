import { sql } from "drizzle-orm";
import {
  boolean,
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

import { products } from "./catalog";
import { locations, organizations } from "./core";
import {
  mappingStatusEnum,
  salesLineTypeEnum,
  salesOrderStatusEnum,
} from "./enums";
import { recipeVersions } from "./recipes";
import { type JsonObject, lifecycleTimestamps } from "./shared";

export const salesOrders = pgTable(
  "sales_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
    sourceSystem: varchar("source_system", { length: 96 }).notNull(),
    externalId: text("external_id").notNull(),
    reportingRole: varchar("reporting_role", { length: 32 })
      .default("authoritative")
      .notNull(),
    orderNumber: varchar("order_number", { length: 96 }),
    businessDate: date("business_date", { mode: "string" }).notNull(),
    status: salesOrderStatusEnum("status").notNull(),
    openedAt: timestamp("opened_at", {
      withTimezone: true,
      precision: 3,
    }).notNull(),
    closedAt: timestamp("closed_at", {
      withTimezone: true,
      precision: 3,
    }),
    currency: varchar("currency", { length: 3 }).notNull(),
    subtotalCents: integer("subtotal_cents").notNull(),
    discountCents: integer("discount_cents").default(0).notNull(),
    taxCents: integer("tax_cents").default(0).notNull(),
    tipCents: integer("tip_cents").default(0).notNull(),
    totalCents: integer("total_cents").notNull(),
    guestCount: integer("guest_count"),
    customerReference: text("customer_reference"),
    rawData: jsonb("raw_data").$type<JsonObject>().default({}).notNull(),
    reversalOfSalesOrderId: uuid("reversal_of_sales_order_id").references(
      (): AnyPgColumn => salesOrders.id,
      { onDelete: "restrict" },
    ),
    supersedesSalesOrderId: uuid("supersedes_sales_order_id").references(
      (): AnyPgColumn => salesOrders.id,
      { onDelete: "restrict" },
    ),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex("sales_order_source_external_uidx").on(
      table.locationId,
      table.sourceSystem,
      table.externalId,
    ),
    uniqueIndex("sales_order_reversal_of_uidx")
      .on(table.reversalOfSalesOrderId)
      .where(sql`${table.reversalOfSalesOrderId} is not null`),
    uniqueIndex("sales_order_supersedes_uidx")
      .on(table.supersedesSalesOrderId)
      .where(sql`${table.supersedesSalesOrderId} is not null`),
    index("sales_order_org_business_date_idx").on(
      table.organizationId,
      table.businessDate,
    ),
    index("sales_order_location_status_idx").on(
      table.locationId,
      table.status,
      table.businessDate,
    ),
    check(
      "sales_order_source_not_blank",
      sql`btrim(${table.sourceSystem}) <> ''`,
    ),
    check(
      "sales_order_reporting_role_allowed",
      sql`${table.reportingRole} in ('authoritative', 'supplemental')`,
    ),
    check(
      "sales_order_times_ordered",
      sql`${table.closedAt} is null or ${table.closedAt} >= ${table.openedAt}`,
    ),
    check(
      "sales_order_currency_iso_code",
      sql`${table.currency} ~ '^[A-Z]{3}$'`,
    ),
    check(
      "sales_order_amounts_reconcile",
      sql`${table.totalCents} = ${table.subtotalCents} - ${table.discountCents} + ${table.taxCents} + ${table.tipCents}`,
    ),
    check(
      "sales_order_guest_count_nonnegative",
      sql`${table.guestCount} is null or ${table.guestCount} >= 0`,
    ),
    check(
      "sales_order_closed_state",
      sql`${table.status} = 'open' or ${table.closedAt} is not null`,
    ),
    check(
      "sales_order_reversal_not_self",
      sql`${table.reversalOfSalesOrderId} is null or ${table.reversalOfSalesOrderId} <> ${table.id}`,
    ),
    check(
      "sales_order_supersedes_not_self",
      sql`${table.supersedesSalesOrderId} is null or ${table.supersedesSalesOrderId} <> ${table.id}`,
    ),
  ],
);

export const salesOrderLinks = pgTable(
  "sales_order_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    primarySalesOrderId: uuid("primary_sales_order_id")
      .notNull()
      .references(() => salesOrders.id, { onDelete: "restrict" }),
    linkedSalesOrderId: uuid("linked_sales_order_id")
      .notNull()
      .references(() => salesOrders.id, { onDelete: "restrict" }),
    relationship: varchar("relationship", { length: 64 })
      .default("same_sale")
      .notNull(),
    matchMethod: varchar("match_method", { length: 64 }).notNull(),
    confidence: numeric("confidence", {
      precision: 7,
      scale: 6,
      mode: "string",
    }),
    status: varchar("status", { length: 32 }).default("proposed").notNull(),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex("sales_order_link_pair_uidx").on(
      table.primarySalesOrderId,
      table.linkedSalesOrderId,
      table.relationship,
    ),
    index("sales_order_link_linked_idx").on(table.linkedSalesOrderId),
    check(
      "sales_order_link_distinct_orders",
      sql`${table.primarySalesOrderId} <> ${table.linkedSalesOrderId}`,
    ),
    check(
      "sales_order_link_status_allowed",
      sql`${table.status} in ('proposed', 'confirmed', 'rejected', 'reversed')`,
    ),
    check(
      "sales_order_link_confidence_range",
      sql`${table.confidence} is null or (${table.confidence} >= 0 and ${table.confidence} <= 1)`,
    ),
  ],
);

export const salesOrderLines = pgTable(
  "sales_order_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    salesOrderId: uuid("sales_order_id")
      .notNull()
      .references(() => salesOrders.id, { onDelete: "restrict" }),
    lineNumber: integer("line_number").notNull(),
    externalId: text("external_id"),
    lineType: salesLineTypeEnum("line_type").default("item").notNull(),
    mappingStatus: mappingStatusEnum("mapping_status")
      .default("unmapped")
      .notNull(),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "restrict",
    }),
    recipeVersionId: uuid("recipe_version_id").references(
      () => recipeVersions.id,
      { onDelete: "restrict" },
    ),
    displayName: text("display_name").notNull(),
    quantity: numeric("quantity", {
      precision: 20,
      scale: 6,
      mode: "string",
    })
      .default("1")
      .notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    subtotalCents: integer("subtotal_cents").notNull(),
    discountCents: integer("discount_cents").default(0).notNull(),
    taxCents: integer("tax_cents").default(0).notNull(),
    totalCents: integer("total_cents").notNull(),
    isVoided: boolean("is_voided").default(false).notNull(),
    voidedAt: timestamp("voided_at", {
      withTimezone: true,
      precision: 3,
    }),
    reversalOfSalesOrderLineId: uuid(
      "reversal_of_sales_order_line_id",
    ).references((): AnyPgColumn => salesOrderLines.id, {
      onDelete: "restrict",
    }),
    supersedesSalesOrderLineId: uuid(
      "supersedes_sales_order_line_id",
    ).references((): AnyPgColumn => salesOrderLines.id, {
      onDelete: "restrict",
    }),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex("sales_order_line_number_uidx").on(
      table.salesOrderId,
      table.lineNumber,
    ),
    uniqueIndex("sales_order_line_external_uidx")
      .on(table.salesOrderId, table.externalId)
      .where(sql`${table.externalId} is not null`),
    uniqueIndex("sales_order_line_reversal_uidx")
      .on(table.reversalOfSalesOrderLineId)
      .where(sql`${table.reversalOfSalesOrderLineId} is not null`),
    uniqueIndex("sales_order_line_supersedes_uidx")
      .on(table.supersedesSalesOrderLineId)
      .where(sql`${table.supersedesSalesOrderLineId} is not null`),
    index("sales_order_line_org_product_idx").on(
      table.organizationId,
      table.productId,
    ),
    index("sales_order_line_recipe_idx").on(table.recipeVersionId),
    check("sales_order_line_number_positive", sql`${table.lineNumber} > 0`),
    check(
      "sales_order_line_name_not_blank",
      sql`btrim(${table.displayName}) <> ''`,
    ),
    check(
      "sales_order_line_quantity_nonzero",
      sql`${table.quantity} <> 0`,
    ),
    check(
      "sales_order_line_item_product",
      sql`${table.lineType} <> 'item' or ${table.mappingStatus} <> 'confirmed' or coalesce(${table.productId}, ${table.recipeVersionId}) is not null`,
    ),
    check(
      "sales_order_line_amounts_reconcile",
      sql`${table.totalCents} = ${table.subtotalCents} - ${table.discountCents} + ${table.taxCents}`,
    ),
    check(
      "sales_order_line_void_state",
      sql`not ${table.isVoided} or ${table.voidedAt} is not null`,
    ),
    check(
      "sales_order_line_reversal_not_self",
      sql`${table.reversalOfSalesOrderLineId} is null or ${table.reversalOfSalesOrderLineId} <> ${table.id}`,
    ),
    check(
      "sales_order_line_supersedes_not_self",
      sql`${table.supersedesSalesOrderLineId} is null or ${table.supersedesSalesOrderLineId} <> ${table.id}`,
    ),
  ],
);

export const salesOrderModifiers = pgTable(
  "sales_order_modifiers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    salesOrderLineId: uuid("sales_order_line_id")
      .notNull()
      .references(() => salesOrderLines.id, { onDelete: "restrict" }),
    parentModifierId: uuid("parent_modifier_id").references(
      (): AnyPgColumn => salesOrderModifiers.id,
      { onDelete: "restrict" },
    ),
    lineNumber: integer("line_number").notNull(),
    externalId: text("external_id"),
    mappingStatus: mappingStatusEnum("mapping_status")
      .default("unmapped")
      .notNull(),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "restrict",
    }),
    recipeVersionId: uuid("recipe_version_id").references(
      () => recipeVersions.id,
      { onDelete: "restrict" },
    ),
    displayName: text("display_name").notNull(),
    quantity: numeric("quantity", {
      precision: 20,
      scale: 6,
      mode: "string",
    })
      .default("1")
      .notNull(),
    unitPriceCents: integer("unit_price_cents").default(0).notNull(),
    subtotalCents: integer("subtotal_cents").default(0).notNull(),
    discountCents: integer("discount_cents").default(0).notNull(),
    taxCents: integer("tax_cents").default(0).notNull(),
    totalCents: integer("total_cents").default(0).notNull(),
    isRemoved: boolean("is_removed").default(false).notNull(),
    reversalOfModifierId: uuid("reversal_of_modifier_id").references(
      (): AnyPgColumn => salesOrderModifiers.id,
      { onDelete: "restrict" },
    ),
    supersedesModifierId: uuid("supersedes_modifier_id").references(
      (): AnyPgColumn => salesOrderModifiers.id,
      { onDelete: "restrict" },
    ),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex("sales_modifier_line_number_uidx").on(
      table.salesOrderLineId,
      table.lineNumber,
    ),
    uniqueIndex("sales_modifier_external_uidx")
      .on(table.salesOrderLineId, table.externalId)
      .where(sql`${table.externalId} is not null`),
    uniqueIndex("sales_modifier_reversal_uidx")
      .on(table.reversalOfModifierId)
      .where(sql`${table.reversalOfModifierId} is not null`),
    uniqueIndex("sales_modifier_supersedes_uidx")
      .on(table.supersedesModifierId)
      .where(sql`${table.supersedesModifierId} is not null`),
    index("sales_modifier_product_idx").on(
      table.organizationId,
      table.productId,
    ),
    index("sales_modifier_recipe_idx").on(table.recipeVersionId),
    index("sales_modifier_parent_idx").on(table.parentModifierId),
    check("sales_modifier_line_positive", sql`${table.lineNumber} > 0`),
    check(
      "sales_modifier_name_not_blank",
      sql`btrim(${table.displayName}) <> ''`,
    ),
    check("sales_modifier_quantity_nonzero", sql`${table.quantity} <> 0`),
    check(
      "sales_modifier_confirmed_target",
      sql`${table.mappingStatus} <> 'confirmed' or coalesce(${table.productId}, ${table.recipeVersionId}) is not null`,
    ),
    check(
      "sales_modifier_amounts_reconcile",
      sql`${table.totalCents} = ${table.subtotalCents} - ${table.discountCents} + ${table.taxCents}`,
    ),
    check(
      "sales_modifier_parent_not_self",
      sql`${table.parentModifierId} is null or ${table.parentModifierId} <> ${table.id}`,
    ),
    check(
      "sales_modifier_reversal_not_self",
      sql`${table.reversalOfModifierId} is null or ${table.reversalOfModifierId} <> ${table.id}`,
    ),
    check(
      "sales_modifier_supersedes_not_self",
      sql`${table.supersedesModifierId} is null or ${table.supersedesModifierId} <> ${table.id}`,
    ),
  ],
);

export const salesPayments = pgTable(
  "sales_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
    salesOrderId: uuid("sales_order_id").references(() => salesOrders.id, {
      onDelete: "restrict",
    }),
    sourceSystem: varchar("source_system", { length: 96 }).notNull(),
    externalId: text("external_id").notNull(),
    businessDate: date("business_date", { mode: "string" }).notNull(),
    occurredAt: timestamp("occurred_at", {
      withTimezone: true,
      precision: 3,
    }).notNull(),
    status: varchar("status", { length: 64 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    amountCents: integer("amount_cents").notNull(),
    taxCents: integer("tax_cents").default(0).notNull(),
    tipCents: integer("tip_cents").default(0).notNull(),
    totalCollectedCents: integer("total_collected_cents").notNull(),
    refundedCents: integer("refunded_cents").default(0).notNull(),
    netCollectedCents: integer("net_collected_cents").notNull(),
    tenderExternalId: text("tender_external_id"),
    tenderType: varchar("tender_type", { length: 64 }).notNull(),
    tenderLabel: text("tender_label").notNull(),
    sourceChannel: varchar("source_channel", { length: 64 }).notNull(),
    rawData: jsonb("raw_data").$type<JsonObject>().default({}).notNull(),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex("sales_payment_source_external_uidx").on(
      table.locationId,
      table.sourceSystem,
      table.externalId,
    ),
    index("sales_payment_business_date_idx").on(
      table.organizationId,
      table.businessDate,
    ),
    index("sales_payment_order_idx").on(table.salesOrderId),
    index("sales_payment_tender_idx").on(
      table.locationId,
      table.tenderType,
      table.businessDate,
    ),
    check(
      "sales_payment_source_not_blank",
      sql`btrim(${table.sourceSystem}) <> ''`,
    ),
    check(
      "sales_payment_currency_iso_code",
      sql`${table.currency} ~ '^[A-Z]{3}$'`,
    ),
    check(
      "sales_payment_amounts_reconcile",
      sql`${table.totalCollectedCents} = ${table.amountCents} + ${table.tipCents} and ${table.netCollectedCents} = ${table.totalCollectedCents} - ${table.refundedCents}`,
    ),
  ],
);

export const salesRefunds = pgTable(
  "sales_refunds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
    salesOrderId: uuid("sales_order_id").references(() => salesOrders.id, {
      onDelete: "restrict",
    }),
    salesPaymentId: uuid("sales_payment_id").references(
      () => salesPayments.id,
      { onDelete: "restrict" },
    ),
    sourceSystem: varchar("source_system", { length: 96 }).notNull(),
    externalId: text("external_id").notNull(),
    businessDate: date("business_date", { mode: "string" }).notNull(),
    occurredAt: timestamp("occurred_at", {
      withTimezone: true,
      precision: 3,
    }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    amountCents: integer("amount_cents").notNull(),
    taxCents: integer("tax_cents").default(0).notNull(),
    tipCents: integer("tip_cents").default(0).notNull(),
    sourceChannel: varchar("source_channel", { length: 64 }).notNull(),
    rawData: jsonb("raw_data").$type<JsonObject>().default({}).notNull(),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex("sales_refund_source_external_uidx").on(
      table.locationId,
      table.sourceSystem,
      table.externalId,
    ),
    index("sales_refund_business_date_idx").on(
      table.organizationId,
      table.businessDate,
    ),
    index("sales_refund_order_idx").on(table.salesOrderId),
    index("sales_refund_payment_idx").on(table.salesPaymentId),
    check(
      "sales_refund_source_not_blank",
      sql`btrim(${table.sourceSystem}) <> ''`,
    ),
    check(
      "sales_refund_currency_iso_code",
      sql`${table.currency} ~ '^[A-Z]{3}$'`,
    ),
    check(
      "sales_refund_amounts_nonnegative",
      sql`${table.amountCents} >= 0 and ${table.taxCents} >= 0 and ${table.tipCents} >= 0`,
    ),
  ],
);

export const dailySalesControls = pgTable(
  "daily_sales_controls",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
    sourceSystem: varchar("source_system", { length: 96 }).notNull(),
    businessDate: date("business_date", { mode: "string" }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    status: varchar("status", { length: 32 })
      .default("provisional")
      .notNull(),
    orderCount: integer("order_count").default(0).notNull(),
    paymentCount: integer("payment_count").default(0).notNull(),
    refundCount: integer("refund_count").default(0).notNull(),
    grossCents: integer("gross_cents").default(0).notNull(),
    discountCents: integer("discount_cents").default(0).notNull(),
    taxCents: integer("tax_cents").default(0).notNull(),
    tipCents: integer("tip_cents").default(0).notNull(),
    refundCents: integer("refund_cents").default(0).notNull(),
    netCollectedCents: integer("net_collected_cents").default(0).notNull(),
    controls: jsonb("controls").$type<JsonObject>().notNull(),
    reconciledAt: timestamp("reconciled_at", {
      withTimezone: true,
      precision: 3,
    }),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex("daily_sales_control_source_date_uidx").on(
      table.locationId,
      table.sourceSystem,
      table.businessDate,
    ),
    index("daily_sales_control_org_date_idx").on(
      table.organizationId,
      table.businessDate,
    ),
    index("daily_sales_control_status_idx").on(
      table.organizationId,
      table.status,
    ),
    check(
      "daily_sales_control_status_allowed",
      sql`${table.status} in ('provisional', 'verified', 'exception')`,
    ),
    check(
      "daily_sales_control_currency_iso",
      sql`${table.currency} ~ '^[A-Z]{3}$'`,
    ),
    check(
      "daily_sales_control_counts_nonnegative",
      sql`${table.orderCount} >= 0 and ${table.paymentCount} >= 0 and ${table.refundCount} >= 0`,
    ),
  ],
);

export type SalesOrder = typeof salesOrders.$inferSelect;
export type NewSalesOrder = typeof salesOrders.$inferInsert;
export type SalesOrderLink = typeof salesOrderLinks.$inferSelect;
export type NewSalesOrderLink = typeof salesOrderLinks.$inferInsert;
export type SalesOrderLine = typeof salesOrderLines.$inferSelect;
export type NewSalesOrderLine = typeof salesOrderLines.$inferInsert;
export type SalesOrderModifier = typeof salesOrderModifiers.$inferSelect;
export type NewSalesOrderModifier = typeof salesOrderModifiers.$inferInsert;
export type SalesPayment = typeof salesPayments.$inferSelect;
export type NewSalesPayment = typeof salesPayments.$inferInsert;
export type SalesRefund = typeof salesRefunds.$inferSelect;
export type NewSalesRefund = typeof salesRefunds.$inferInsert;
export type DailySalesControl = typeof dailySalesControls.$inferSelect;
export type NewDailySalesControl = typeof dailySalesControls.$inferInsert;
