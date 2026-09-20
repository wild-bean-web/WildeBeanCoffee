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
  smallint,
  text,
  uniqueIndex,
  uuid,
  varchar,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

import { organizations } from "./core";
import {
  productTypeEnum,
  uomDimensionEnum,
  vendorStatusEnum,
} from "./enums";
import { type JsonObject, lifecycleTimestamps } from "./shared";

export const unitsOfMeasure = pgTable(
  "units_of_measure",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 32 }).notNull(),
    name: text("name").notNull(),
    symbol: varchar("symbol", { length: 16 }).notNull(),
    dimension: uomDimensionEnum("dimension").notNull(),
    decimalPlaces: smallint("decimal_places").default(3).notNull(),
    isDimensionBase: boolean("is_dimension_base").default(false).notNull(),
    externalId: text("external_id"),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex("uom_org_code_uidx").on(table.organizationId, table.code),
    uniqueIndex("uom_org_external_uidx")
      .on(table.organizationId, table.externalId)
      .where(sql`${table.externalId} is not null`),
    uniqueIndex("uom_org_dimension_base_uidx")
      .on(table.organizationId, table.dimension)
      .where(sql`${table.isDimensionBase}`),
    check("uom_code_not_blank", sql`btrim(${table.code}) <> ''`),
    check(
      "uom_decimal_places_range",
      sql`${table.decimalPlaces} between 0 and 12`,
    ),
  ],
);

export const vendors = pgTable(
  "vendors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 64 }).notNull(),
    name: text("name").notNull(),
    externalId: text("external_id"),
    status: vendorStatusEnum("status").default("active").notNull(),
    defaultCurrency: varchar("default_currency", { length: 3 })
      .default("USD")
      .notNull(),
    paymentTermsDays: integer("payment_terms_days"),
    taxIdentifier: text("tax_identifier"),
    contact: jsonb("contact").$type<JsonObject>(),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex("vendor_org_code_uidx").on(
      table.organizationId,
      table.code,
    ),
    uniqueIndex("vendor_org_external_uidx")
      .on(table.organizationId, table.externalId)
      .where(sql`${table.externalId} is not null`),
    index("vendor_org_status_idx").on(table.organizationId, table.status),
    check("vendor_code_not_blank", sql`btrim(${table.code}) <> ''`),
    check("vendor_name_not_blank", sql`btrim(${table.name}) <> ''`),
    check(
      "vendor_currency_iso_code",
      sql`${table.defaultCurrency} ~ '^[A-Z]{3}$'`,
    ),
    check(
      "vendor_terms_nonnegative",
      sql`${table.paymentTermsDays} is null or ${table.paymentTermsDays} >= 0`,
    ),
  ],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    sku: varchar("sku", { length: 96 }).notNull(),
    name: text("name").notNull(),
    description: text("description"),
    productType: productTypeEnum("product_type").notNull(),
    inventoryUomId: uuid("inventory_uom_id")
      .notNull()
      .references(() => unitsOfMeasure.id, { onDelete: "restrict" }),
    category: text("category"),
    barcode: varchar("barcode", { length: 64 }),
    externalId: text("external_id"),
    defaultUnitCostCents: numeric("default_unit_cost_cents", {
      precision: 20,
      scale: 6,
      mode: "string",
    }),
    trackInventory: boolean("track_inventory").default(true).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex("product_org_sku_uidx").on(
      table.organizationId,
      table.sku,
    ),
    uniqueIndex("product_org_barcode_uidx")
      .on(table.organizationId, table.barcode)
      .where(sql`${table.barcode} is not null`),
    uniqueIndex("product_org_external_uidx")
      .on(table.organizationId, table.externalId)
      .where(sql`${table.externalId} is not null`),
    index("product_org_active_type_idx").on(
      table.organizationId,
      table.isActive,
      table.productType,
    ),
    index("product_inventory_uom_idx").on(table.inventoryUomId),
    check("product_sku_not_blank", sql`btrim(${table.sku}) <> ''`),
    check("product_name_not_blank", sql`btrim(${table.name}) <> ''`),
    check(
      "product_default_cost_nonnegative",
      sql`${table.defaultUnitCostCents} is null or ${table.defaultUnitCostCents} >= 0`,
    ),
  ],
);

export const uomConversions = pgTable(
  "uom_conversions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "restrict",
    }),
    fromUomId: uuid("from_uom_id")
      .notNull()
      .references(() => unitsOfMeasure.id, { onDelete: "restrict" }),
    toUomId: uuid("to_uom_id")
      .notNull()
      .references(() => unitsOfMeasure.id, { onDelete: "restrict" }),
    multiplier: numeric("multiplier", {
      precision: 24,
      scale: 12,
      mode: "string",
    }).notNull(),
    offset: numeric("offset", {
      precision: 24,
      scale: 12,
      mode: "string",
    })
      .default("0")
      .notNull(),
    effectiveFrom: date("effective_from", { mode: "string" })
      .default(sql`current_date`)
      .notNull(),
    effectiveTo: date("effective_to", { mode: "string" }),
    supersedesConversionId: uuid("supersedes_conversion_id").references(
      (): AnyPgColumn => uomConversions.id,
      { onDelete: "restrict" },
    ),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex("uom_conversion_generic_uidx")
      .on(
        table.organizationId,
        table.fromUomId,
        table.toUomId,
        table.effectiveFrom,
      )
      .where(sql`${table.productId} is null`),
    uniqueIndex("uom_conversion_product_uidx")
      .on(
        table.organizationId,
        table.productId,
        table.fromUomId,
        table.toUomId,
        table.effectiveFrom,
      )
      .where(sql`${table.productId} is not null`),
    uniqueIndex("uom_conversion_supersedes_uidx")
      .on(table.supersedesConversionId)
      .where(sql`${table.supersedesConversionId} is not null`),
    index("uom_conversion_lookup_idx").on(
      table.organizationId,
      table.productId,
      table.fromUomId,
      table.toUomId,
      table.effectiveTo,
    ),
    check(
      "uom_conversion_distinct_units",
      sql`${table.fromUomId} <> ${table.toUomId}`,
    ),
    check(
      "uom_conversion_multiplier_positive",
      sql`${table.multiplier} > 0`,
    ),
    check(
      "uom_conversion_dates_ordered",
      sql`${table.effectiveTo} is null or ${table.effectiveTo} >= ${table.effectiveFrom}`,
    ),
  ],
);

export const vendorItems = pgTable(
  "vendor_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "restrict" }),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "restrict",
    }),
    purchaseUomId: uuid("purchase_uom_id")
      .notNull()
      .references(() => unitsOfMeasure.id, { onDelete: "restrict" }),
    vendorSku: varchar("vendor_sku", { length: 128 }).notNull(),
    description: text("description").notNull(),
    manufacturerPartNumber: varchar("manufacturer_part_number", {
      length: 128,
    }),
    externalId: text("external_id"),
    minimumOrderQuantity: numeric("minimum_order_quantity", {
      precision: 20,
      scale: 6,
      mode: "string",
    }),
    leadTimeDays: integer("lead_time_days"),
    isActive: boolean("is_active").default(true).notNull(),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex("vendor_item_vendor_sku_uidx").on(
      table.vendorId,
      table.vendorSku,
    ),
    uniqueIndex("vendor_item_vendor_external_uidx")
      .on(table.vendorId, table.externalId)
      .where(sql`${table.externalId} is not null`),
    index("vendor_item_org_product_idx").on(
      table.organizationId,
      table.productId,
    ),
    index("vendor_item_vendor_active_idx").on(
      table.vendorId,
      table.isActive,
    ),
    check(
      "vendor_item_sku_not_blank",
      sql`btrim(${table.vendorSku}) <> ''`,
    ),
    check(
      "vendor_item_minimum_positive",
      sql`${table.minimumOrderQuantity} is null or ${table.minimumOrderQuantity} > 0`,
    ),
    check(
      "vendor_item_lead_time_nonnegative",
      sql`${table.leadTimeDays} is null or ${table.leadTimeDays} >= 0`,
    ),
  ],
);

export const purchasePacks = pgTable(
  "purchase_packs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    vendorItemId: uuid("vendor_item_id")
      .notNull()
      .references(() => vendorItems.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 64 }).notNull(),
    externalId: text("external_id"),
    packUomId: uuid("pack_uom_id")
      .notNull()
      .references(() => unitsOfMeasure.id, { onDelete: "restrict" }),
    containedQuantity: numeric("contained_quantity", {
      precision: 20,
      scale: 6,
      mode: "string",
    }).notNull(),
    containedUomId: uuid("contained_uom_id")
      .notNull()
      .references(() => unitsOfMeasure.id, { onDelete: "restrict" }),
    minimumOrderPacks: numeric("minimum_order_packs", {
      precision: 20,
      scale: 6,
      mode: "string",
    }),
    isDefault: boolean("is_default").default(false).notNull(),
    effectiveFrom: date("effective_from", { mode: "string" })
      .default(sql`current_date`)
      .notNull(),
    effectiveTo: date("effective_to", { mode: "string" }),
    supersedesPurchasePackId: uuid("supersedes_purchase_pack_id").references(
      (): AnyPgColumn => purchasePacks.id,
      { onDelete: "restrict" },
    ),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex("purchase_pack_item_code_uidx").on(
      table.vendorItemId,
      table.code,
      table.effectiveFrom,
    ),
    uniqueIndex("purchase_pack_item_external_uidx")
      .on(table.vendorItemId, table.externalId)
      .where(sql`${table.externalId} is not null`),
    uniqueIndex("purchase_pack_supersedes_uidx")
      .on(table.supersedesPurchasePackId)
      .where(sql`${table.supersedesPurchasePackId} is not null`),
    index("purchase_pack_item_active_idx").on(
      table.vendorItemId,
      table.effectiveTo,
    ),
    check("purchase_pack_code_not_blank", sql`btrim(${table.code}) <> ''`),
    check(
      "purchase_pack_quantity_positive",
      sql`${table.containedQuantity} > 0`,
    ),
    check(
      "purchase_pack_minimum_positive",
      sql`${table.minimumOrderPacks} is null or ${table.minimumOrderPacks} > 0`,
    ),
    check(
      "purchase_pack_dates_ordered",
      sql`${table.effectiveTo} is null or ${table.effectiveTo} >= ${table.effectiveFrom}`,
    ),
  ],
);

export type UnitOfMeasure = typeof unitsOfMeasure.$inferSelect;
export type NewUnitOfMeasure = typeof unitsOfMeasure.$inferInsert;
export type Vendor = typeof vendors.$inferSelect;
export type NewVendor = typeof vendors.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type UomConversion = typeof uomConversions.$inferSelect;
export type NewUomConversion = typeof uomConversions.$inferInsert;
export type VendorItem = typeof vendorItems.$inferSelect;
export type NewVendorItem = typeof vendorItems.$inferInsert;
export type PurchasePack = typeof purchasePacks.$inferSelect;
export type NewPurchasePack = typeof purchasePacks.$inferInsert;
