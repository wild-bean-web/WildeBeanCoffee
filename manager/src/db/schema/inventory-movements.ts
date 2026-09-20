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

import { products, unitsOfMeasure } from "./catalog";
import { locations, organizations, staffMembers } from "./core";
import { inventoryMovementTypeEnum } from "./enums";
import { inventoryCountLines } from "./inventory-counts";
import {
  goodsReceiptLines,
  purchaseLines,
} from "./purchasing";
import { recipeVersions } from "./recipes";
import { salesOrderLines } from "./sales";

export const inventoryMovements = pgTable(
  "inventory_movements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    uomId: uuid("uom_id")
      .notNull()
      .references(() => unitsOfMeasure.id, { onDelete: "restrict" }),
    movementType: inventoryMovementTypeEnum("movement_type").notNull(),
    quantity: numeric("quantity", {
      precision: 20,
      scale: 6,
      mode: "string",
    }).notNull(),
    unitCostCents: numeric("unit_cost_cents", {
      precision: 20,
      scale: 6,
      mode: "string",
    }),
    extendedCostCents: integer("extended_cost_cents"),
    occurredAt: timestamp("occurred_at", {
      withTimezone: true,
      precision: 3,
    }).notNull(),
    businessDate: date("business_date", { mode: "string" }).notNull(),
    lotCode: varchar("lot_code", { length: 128 }),
    sourceSystem: varchar("source_system", { length: 96 }),
    externalId: text("external_id"),
    movementGroupId: uuid("movement_group_id"),
    goodsReceiptLineId: uuid("goods_receipt_line_id").references(
      () => goodsReceiptLines.id,
      { onDelete: "restrict" },
    ),
    purchaseLineId: uuid("purchase_line_id").references(
      () => purchaseLines.id,
      { onDelete: "restrict" },
    ),
    salesOrderLineId: uuid("sales_order_line_id").references(
      () => salesOrderLines.id,
      { onDelete: "restrict" },
    ),
    inventoryCountLineId: uuid("inventory_count_line_id").references(
      () => inventoryCountLines.id,
      { onDelete: "restrict" },
    ),
    recipeVersionId: uuid("recipe_version_id").references(
      () => recipeVersions.id,
      { onDelete: "restrict" },
    ),
    counterpartMovementId: uuid("counterpart_movement_id").references(
      (): AnyPgColumn => inventoryMovements.id,
      { onDelete: "restrict" },
    ),
    reversalOfMovementId: uuid("reversal_of_movement_id").references(
      (): AnyPgColumn => inventoryMovements.id,
      { onDelete: "restrict" },
    ),
    supersedesMovementId: uuid("supersedes_movement_id").references(
      (): AnyPgColumn => inventoryMovements.id,
      { onDelete: "restrict" },
    ),
    createdByStaffMemberId: uuid("created_by_staff_member_id").references(
      () => staffMembers.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      precision: 3,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("inventory_movement_source_external_uidx")
      .on(table.organizationId, table.sourceSystem, table.externalId)
      .where(
        sql`${table.sourceSystem} is not null and ${table.externalId} is not null`,
      ),
    uniqueIndex("inventory_movement_reversal_uidx")
      .on(table.reversalOfMovementId)
      .where(sql`${table.reversalOfMovementId} is not null`),
    uniqueIndex("inventory_movement_supersedes_uidx")
      .on(table.supersedesMovementId)
      .where(sql`${table.supersedesMovementId} is not null`),
    index("inventory_movement_balance_idx").on(
      table.locationId,
      table.productId,
      table.businessDate,
      table.occurredAt,
    ),
    index("inventory_movement_org_product_idx").on(
      table.organizationId,
      table.productId,
      table.occurredAt,
    ),
    index("inventory_movement_group_idx").on(table.movementGroupId),
    index("inventory_movement_receipt_line_idx").on(
      table.goodsReceiptLineId,
    ),
    index("inventory_movement_sales_line_idx").on(table.salesOrderLineId),
    index("inventory_movement_count_line_idx").on(
      table.inventoryCountLineId,
    ),
    check(
      "inventory_movement_quantity_nonzero",
      sql`${table.quantity} <> 0`,
    ),
    check(
      "inventory_movement_unit_cost_nonnegative",
      sql`${table.unitCostCents} is null or ${table.unitCostCents} >= 0`,
    ),
    check(
      "inventory_movement_transfer_group",
      sql`${table.movementType} not in ('transfer_in', 'transfer_out') or ${table.movementGroupId} is not null`,
    ),
    check(
      "inventory_movement_receipt_source",
      sql`${table.movementType} <> 'goods_receipt' or ${table.goodsReceiptLineId} is not null`,
    ),
    check(
      "inventory_movement_sale_source",
      sql`${table.movementType} not in ('sale', 'sale_return') or ${table.salesOrderLineId} is not null`,
    ),
    check(
      "inventory_movement_count_source",
      sql`${table.movementType} <> 'count_adjustment' or ${table.inventoryCountLineId} is not null`,
    ),
    check(
      "inventory_movement_recipe_source",
      sql`${table.movementType} not in ('recipe_consumption', 'recipe_production') or ${table.recipeVersionId} is not null`,
    ),
    check(
      "inventory_movement_reversal_source",
      sql`${table.movementType} <> 'reversal' or ${table.reversalOfMovementId} is not null`,
    ),
    check(
      "inventory_movement_counterpart_not_self",
      sql`${table.counterpartMovementId} is null or ${table.counterpartMovementId} <> ${table.id}`,
    ),
    check(
      "inventory_movement_reversal_not_self",
      sql`${table.reversalOfMovementId} is null or ${table.reversalOfMovementId} <> ${table.id}`,
    ),
    check(
      "inventory_movement_supersedes_not_self",
      sql`${table.supersedesMovementId} is null or ${table.supersedesMovementId} <> ${table.id}`,
    ),
  ],
);

export type InventoryMovement = typeof inventoryMovements.$inferSelect;
export type NewInventoryMovement = typeof inventoryMovements.$inferInsert;
