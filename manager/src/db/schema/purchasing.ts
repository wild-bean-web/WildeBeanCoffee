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

import { accountingPeriods } from "./accounting";
import {
  products,
  purchasePacks,
  unitsOfMeasure,
  vendorItems,
  vendors,
} from "./catalog";
import { locations, organizations, staffMembers } from "./core";
import {
  documentLines,
  mappingRevisions,
  sourceDocuments,
} from "./documents";
import {
  goodsReceiptStatusEnum,
  purchaseLineTypeEnum,
  purchaseStatusEnum,
  purchaseTypeEnum,
} from "./enums";
import { lifecycleTimestamps } from "./shared";

export const purchases = pgTable(
  "purchases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "restrict" }),
    accountingPeriodId: uuid("accounting_period_id").references(
      () => accountingPeriods.id,
      { onDelete: "restrict" },
    ),
    sourceDocumentId: uuid("source_document_id").references(
      () => sourceDocuments.id,
      { onDelete: "restrict" },
    ),
    purchaseType: purchaseTypeEnum("purchase_type").notNull(),
    status: purchaseStatusEnum("status").default("draft").notNull(),
    purchaseNumber: varchar("purchase_number", { length: 96 }).notNull(),
    sourceSystem: varchar("source_system", { length: 96 }),
    externalId: text("external_id"),
    purchaseDate: date("purchase_date", { mode: "string" }).notNull(),
    dueDate: date("due_date", { mode: "string" }),
    currency: varchar("currency", { length: 3 }).notNull(),
    subtotalCents: integer("subtotal_cents").notNull(),
    discountCents: integer("discount_cents").default(0).notNull(),
    taxCents: integer("tax_cents").default(0).notNull(),
    shippingCents: integer("shipping_cents").default(0).notNull(),
    tipCents: integer("tip_cents").default(0).notNull(),
    totalCents: integer("total_cents").notNull(),
    createdByStaffMemberId: uuid("created_by_staff_member_id").references(
      () => staffMembers.id,
      { onDelete: "set null" },
    ),
    approvedByStaffMemberId: uuid("approved_by_staff_member_id").references(
      () => staffMembers.id,
      { onDelete: "set null" },
    ),
    postedAt: timestamp("posted_at", {
      withTimezone: true,
      precision: 3,
    }),
    reversalOfPurchaseId: uuid("reversal_of_purchase_id").references(
      (): AnyPgColumn => purchases.id,
      { onDelete: "restrict" },
    ),
    supersedesPurchaseId: uuid("supersedes_purchase_id").references(
      (): AnyPgColumn => purchases.id,
      { onDelete: "restrict" },
    ),
    notes: text("notes"),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex("purchase_org_number_uidx").on(
      table.organizationId,
      table.purchaseNumber,
    ),
    uniqueIndex("purchase_source_external_uidx")
      .on(table.organizationId, table.sourceSystem, table.externalId)
      .where(
        sql`${table.sourceSystem} is not null and ${table.externalId} is not null`,
      ),
    uniqueIndex("purchase_source_document_uidx")
      .on(table.sourceDocumentId)
      .where(sql`${table.sourceDocumentId} is not null`),
    uniqueIndex("purchase_reversal_of_uidx")
      .on(table.reversalOfPurchaseId)
      .where(sql`${table.reversalOfPurchaseId} is not null`),
    uniqueIndex("purchase_supersedes_uidx")
      .on(table.supersedesPurchaseId)
      .where(sql`${table.supersedesPurchaseId} is not null`),
    index("purchase_org_status_date_idx").on(
      table.organizationId,
      table.status,
      table.purchaseDate,
    ),
    index("purchase_vendor_date_idx").on(table.vendorId, table.purchaseDate),
    index("purchase_location_date_idx").on(
      table.locationId,
      table.purchaseDate,
    ),
    index("purchase_period_idx").on(table.accountingPeriodId),
    check(
      "purchase_number_not_blank",
      sql`btrim(${table.purchaseNumber}) <> ''`,
    ),
    check(
      "purchase_currency_iso_code",
      sql`${table.currency} ~ '^[A-Z]{3}$'`,
    ),
    check(
      "purchase_dates_ordered",
      sql`${table.dueDate} is null or ${table.dueDate} >= ${table.purchaseDate}`,
    ),
    check(
      "purchase_amounts_reconcile",
      sql`${table.totalCents} = ${table.subtotalCents} - ${table.discountCents} + ${table.taxCents} + ${table.shippingCents} + ${table.tipCents}`,
    ),
    check(
      "purchase_posting_state",
      sql`${table.status} not in ('posted', 'reversed') or ${table.postedAt} is not null`,
    ),
    check(
      "purchase_reversal_not_self",
      sql`${table.reversalOfPurchaseId} is null or ${table.reversalOfPurchaseId} <> ${table.id}`,
    ),
    check(
      "purchase_supersedes_not_self",
      sql`${table.supersedesPurchaseId} is null or ${table.supersedesPurchaseId} <> ${table.id}`,
    ),
    check(
      "purchase_distinct_revision_links",
      sql`${table.reversalOfPurchaseId} is null or ${table.supersedesPurchaseId} is null or ${table.reversalOfPurchaseId} <> ${table.supersedesPurchaseId}`,
    ),
  ],
);

export const purchaseLines = pgTable(
  "purchase_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    purchaseId: uuid("purchase_id")
      .notNull()
      .references(() => purchases.id, { onDelete: "restrict" }),
    lineNumber: integer("line_number").notNull(),
    lineType: purchaseLineTypeEnum("line_type").default("item").notNull(),
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
    sourceDocumentLineId: uuid("source_document_line_id").references(
      () => documentLines.id,
      { onDelete: "restrict" },
    ),
    mappingRevisionId: uuid("mapping_revision_id").references(
      () => mappingRevisions.id,
      { onDelete: "restrict" },
    ),
    description: text("description").notNull(),
    quantity: numeric("quantity", {
      precision: 20,
      scale: 6,
      mode: "string",
    }),
    uomId: uuid("uom_id").references(() => unitsOfMeasure.id, {
      onDelete: "restrict",
    }),
    unitCostCents: numeric("unit_cost_cents", {
      precision: 20,
      scale: 6,
      mode: "string",
    }),
    subtotalCents: integer("subtotal_cents").notNull(),
    discountCents: integer("discount_cents").default(0).notNull(),
    taxCents: integer("tax_cents").default(0).notNull(),
    totalCents: integer("total_cents").notNull(),
    expectedOn: date("expected_on", { mode: "string" }),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex("purchase_line_number_uidx").on(
      table.purchaseId,
      table.lineNumber,
    ),
    uniqueIndex("purchase_line_document_line_uidx")
      .on(table.sourceDocumentLineId)
      .where(sql`${table.sourceDocumentLineId} is not null`),
    uniqueIndex("purchase_line_mapping_revision_uidx")
      .on(table.mappingRevisionId)
      .where(sql`${table.mappingRevisionId} is not null`),
    index("purchase_line_org_product_idx").on(
      table.organizationId,
      table.productId,
    ),
    index("purchase_line_vendor_item_idx").on(table.vendorItemId),
    check("purchase_line_number_positive", sql`${table.lineNumber} > 0`),
    check(
      "purchase_line_description_not_blank",
      sql`btrim(${table.description}) <> ''`,
    ),
    check(
      "purchase_line_quantity_uom_pair",
      sql`(${table.quantity} is null) = (${table.uomId} is null)`,
    ),
    check(
      "purchase_line_item_fields",
      sql`${table.lineType} <> 'item' or (${table.productId} is not null and ${table.quantity} is not null and ${table.uomId} is not null and ${table.unitCostCents} is not null)`,
    ),
    check(
      "purchase_line_unit_cost_nonnegative",
      sql`${table.unitCostCents} is null or ${table.unitCostCents} >= 0`,
    ),
    check(
      "purchase_line_amounts_reconcile",
      sql`${table.totalCents} = ${table.subtotalCents} - ${table.discountCents} + ${table.taxCents}`,
    ),
  ],
);

export const goodsReceipts = pgTable(
  "goods_receipts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "restrict" }),
    purchaseId: uuid("purchase_id").references(() => purchases.id, {
      onDelete: "restrict",
    }),
    sourceDocumentId: uuid("source_document_id").references(
      () => sourceDocuments.id,
      { onDelete: "restrict" },
    ),
    receiptNumber: varchar("receipt_number", { length: 96 }).notNull(),
    sourceSystem: varchar("source_system", { length: 96 }),
    externalId: text("external_id"),
    status: goodsReceiptStatusEnum("status").default("draft").notNull(),
    receivedAt: timestamp("received_at", {
      withTimezone: true,
      precision: 3,
    }).notNull(),
    receivedByStaffMemberId: uuid("received_by_staff_member_id").references(
      () => staffMembers.id,
      { onDelete: "set null" },
    ),
    postedAt: timestamp("posted_at", {
      withTimezone: true,
      precision: 3,
    }),
    reversalOfGoodsReceiptId: uuid(
      "reversal_of_goods_receipt_id",
    ).references((): AnyPgColumn => goodsReceipts.id, {
      onDelete: "restrict",
    }),
    supersedesGoodsReceiptId: uuid(
      "supersedes_goods_receipt_id",
    ).references((): AnyPgColumn => goodsReceipts.id, {
      onDelete: "restrict",
    }),
    notes: text("notes"),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex("goods_receipt_org_number_uidx").on(
      table.organizationId,
      table.receiptNumber,
    ),
    uniqueIndex("goods_receipt_source_external_uidx")
      .on(table.organizationId, table.sourceSystem, table.externalId)
      .where(
        sql`${table.sourceSystem} is not null and ${table.externalId} is not null`,
      ),
    uniqueIndex("goods_receipt_reversal_of_uidx")
      .on(table.reversalOfGoodsReceiptId)
      .where(sql`${table.reversalOfGoodsReceiptId} is not null`),
    uniqueIndex("goods_receipt_supersedes_uidx")
      .on(table.supersedesGoodsReceiptId)
      .where(sql`${table.supersedesGoodsReceiptId} is not null`),
    index("goods_receipt_purchase_idx").on(table.purchaseId, table.receivedAt),
    index("goods_receipt_location_date_idx").on(
      table.locationId,
      table.receivedAt,
    ),
    index("goods_receipt_org_status_idx").on(
      table.organizationId,
      table.status,
    ),
    check(
      "goods_receipt_number_not_blank",
      sql`btrim(${table.receiptNumber}) <> ''`,
    ),
    check(
      "goods_receipt_posting_state",
      sql`${table.status} not in ('posted', 'reversed') or ${table.postedAt} is not null`,
    ),
    check(
      "goods_receipt_reversal_not_self",
      sql`${table.reversalOfGoodsReceiptId} is null or ${table.reversalOfGoodsReceiptId} <> ${table.id}`,
    ),
    check(
      "goods_receipt_supersedes_not_self",
      sql`${table.supersedesGoodsReceiptId} is null or ${table.supersedesGoodsReceiptId} <> ${table.id}`,
    ),
  ],
);

export const goodsReceiptLines = pgTable(
  "goods_receipt_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    goodsReceiptId: uuid("goods_receipt_id")
      .notNull()
      .references(() => goodsReceipts.id, { onDelete: "restrict" }),
    purchaseLineId: uuid("purchase_line_id").references(
      () => purchaseLines.id,
      { onDelete: "restrict" },
    ),
    lineNumber: integer("line_number").notNull(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    uomId: uuid("uom_id")
      .notNull()
      .references(() => unitsOfMeasure.id, { onDelete: "restrict" }),
    expectedQuantity: numeric("expected_quantity", {
      precision: 20,
      scale: 6,
      mode: "string",
    }),
    acceptedQuantity: numeric("accepted_quantity", {
      precision: 20,
      scale: 6,
      mode: "string",
    }).notNull(),
    rejectedQuantity: numeric("rejected_quantity", {
      precision: 20,
      scale: 6,
      mode: "string",
    })
      .default("0")
      .notNull(),
    unitCostCents: numeric("unit_cost_cents", {
      precision: 20,
      scale: 6,
      mode: "string",
    }),
    lotCode: varchar("lot_code", { length: 128 }),
    expiresOn: date("expires_on", { mode: "string" }),
    notes: text("notes"),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex("goods_receipt_line_number_uidx").on(
      table.goodsReceiptId,
      table.lineNumber,
    ),
    index("goods_receipt_line_purchase_line_idx").on(table.purchaseLineId),
    index("goods_receipt_line_org_product_idx").on(
      table.organizationId,
      table.productId,
    ),
    index("goods_receipt_line_lot_idx").on(table.productId, table.lotCode),
    check(
      "goods_receipt_line_number_positive",
      sql`${table.lineNumber} > 0`,
    ),
    check(
      "goods_receipt_line_expected_nonnegative",
      sql`${table.expectedQuantity} is null or ${table.expectedQuantity} >= 0`,
    ),
    check(
      "goods_receipt_line_accepted_nonnegative",
      sql`${table.acceptedQuantity} >= 0`,
    ),
    check(
      "goods_receipt_line_rejected_nonnegative",
      sql`${table.rejectedQuantity} >= 0`,
    ),
    check(
      "goods_receipt_line_cost_nonnegative",
      sql`${table.unitCostCents} is null or ${table.unitCostCents} >= 0`,
    ),
  ],
);

export type Purchase = typeof purchases.$inferSelect;
export type NewPurchase = typeof purchases.$inferInsert;
export type PurchaseLine = typeof purchaseLines.$inferSelect;
export type NewPurchaseLine = typeof purchaseLines.$inferInsert;
export type GoodsReceipt = typeof goodsReceipts.$inferSelect;
export type NewGoodsReceipt = typeof goodsReceipts.$inferInsert;
export type GoodsReceiptLine = typeof goodsReceiptLines.$inferSelect;
export type NewGoodsReceiptLine = typeof goodsReceiptLines.$inferInsert;
