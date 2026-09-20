import { sql } from "drizzle-orm";
import {
  boolean,
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
import { organizations, staffMembers } from "./core";
import {
  recipeComponentTypeEnum,
  recipeVersionStatusEnum,
} from "./enums";
import { lifecycleTimestamps } from "./shared";

export const recipes = pgTable(
  "recipes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    outputProductId: uuid("output_product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 96 }).notNull(),
    name: text("name").notNull(),
    sourceSystem: varchar("source_system", { length: 96 }),
    externalId: text("external_id"),
    isActive: boolean("is_active").default(true).notNull(),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex("recipe_org_code_uidx").on(
      table.organizationId,
      table.code,
    ),
    uniqueIndex("recipe_source_external_uidx")
      .on(table.organizationId, table.sourceSystem, table.externalId)
      .where(
        sql`${table.sourceSystem} is not null and ${table.externalId} is not null`,
      ),
    index("recipe_org_output_idx").on(
      table.organizationId,
      table.outputProductId,
      table.isActive,
    ),
    check("recipe_code_not_blank", sql`btrim(${table.code}) <> ''`),
    check("recipe_name_not_blank", sql`btrim(${table.name}) <> ''`),
  ],
);

export const recipeVersions = pgTable(
  "recipe_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "restrict" }),
    versionNumber: integer("version_number").notNull(),
    status: recipeVersionStatusEnum("status").default("draft").notNull(),
    effectiveFrom: date("effective_from", { mode: "string" }).notNull(),
    effectiveTo: date("effective_to", { mode: "string" }),
    yieldQuantity: numeric("yield_quantity", {
      precision: 20,
      scale: 6,
      mode: "string",
    }).notNull(),
    yieldUomId: uuid("yield_uom_id")
      .notNull()
      .references(() => unitsOfMeasure.id, { onDelete: "restrict" }),
    instructions: text("instructions"),
    createdByStaffMemberId: uuid("created_by_staff_member_id").references(
      () => staffMembers.id,
      { onDelete: "set null" },
    ),
    approvedByStaffMemberId: uuid("approved_by_staff_member_id").references(
      () => staffMembers.id,
      { onDelete: "set null" },
    ),
    approvedAt: timestamp("approved_at", {
      withTimezone: true,
      precision: 3,
    }),
    supersedesRecipeVersionId: uuid(
      "supersedes_recipe_version_id",
    ).references((): AnyPgColumn => recipeVersions.id, {
      onDelete: "restrict",
    }),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex("recipe_version_number_uidx").on(
      table.recipeId,
      table.versionNumber,
    ),
    uniqueIndex("recipe_version_supersedes_uidx")
      .on(table.supersedesRecipeVersionId)
      .where(sql`${table.supersedesRecipeVersionId} is not null`),
    index("recipe_version_effective_idx").on(
      table.recipeId,
      table.status,
      table.effectiveFrom,
      table.effectiveTo,
    ),
    check(
      "recipe_version_number_positive",
      sql`${table.versionNumber} > 0`,
    ),
    check(
      "recipe_version_yield_positive",
      sql`${table.yieldQuantity} > 0`,
    ),
    check(
      "recipe_version_dates_ordered",
      sql`${table.effectiveTo} is null or ${table.effectiveTo} >= ${table.effectiveFrom}`,
    ),
    check(
      "recipe_version_approval_state",
      sql`${table.status} <> 'active' or ${table.approvedAt} is not null`,
    ),
    check(
      "recipe_version_not_self_superseded",
      sql`${table.supersedesRecipeVersionId} is null or ${table.supersedesRecipeVersionId} <> ${table.id}`,
    ),
  ],
);

export const recipeComponents = pgTable(
  "recipe_components",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    recipeVersionId: uuid("recipe_version_id")
      .notNull()
      .references(() => recipeVersions.id, { onDelete: "restrict" }),
    lineNumber: integer("line_number").notNull(),
    componentType: recipeComponentTypeEnum("component_type").notNull(),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "restrict",
    }),
    nestedRecipeVersionId: uuid("nested_recipe_version_id").references(
      () => recipeVersions.id,
      { onDelete: "restrict" },
    ),
    quantity: numeric("quantity", {
      precision: 20,
      scale: 6,
      mode: "string",
    }).notNull(),
    uomId: uuid("uom_id")
      .notNull()
      .references(() => unitsOfMeasure.id, { onDelete: "restrict" }),
    wasteFactor: numeric("waste_factor", {
      precision: 9,
      scale: 8,
      mode: "string",
    })
      .default("0")
      .notNull(),
    isOptional: boolean("is_optional").default(false).notNull(),
    notes: text("notes"),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex("recipe_component_line_uidx").on(
      table.recipeVersionId,
      table.lineNumber,
    ),
    index("recipe_component_product_idx").on(
      table.organizationId,
      table.productId,
    ),
    index("recipe_component_nested_idx").on(table.nestedRecipeVersionId),
    check(
      "recipe_component_line_positive",
      sql`${table.lineNumber} > 0`,
    ),
    check(
      "recipe_component_quantity_positive",
      sql`${table.quantity} > 0`,
    ),
    check(
      "recipe_component_waste_range",
      sql`${table.wasteFactor} >= 0 and ${table.wasteFactor} < 1`,
    ),
    check(
      "recipe_component_target",
      sql`
        (
          ${table.componentType} = 'product'
          and ${table.productId} is not null
          and ${table.nestedRecipeVersionId} is null
        )
        or (
          ${table.componentType} = 'recipe'
          and ${table.productId} is null
          and ${table.nestedRecipeVersionId} is not null
        )
      `,
    ),
    check(
      "recipe_component_not_self_nested",
      sql`${table.nestedRecipeVersionId} is null or ${table.nestedRecipeVersionId} <> ${table.recipeVersionId}`,
    ),
  ],
);

export type Recipe = typeof recipes.$inferSelect;
export type NewRecipe = typeof recipes.$inferInsert;
export type RecipeVersion = typeof recipeVersions.$inferSelect;
export type NewRecipeVersion = typeof recipeVersions.$inferInsert;
export type RecipeComponent = typeof recipeComponents.$inferSelect;
export type NewRecipeComponent = typeof recipeComponents.$inferInsert;
