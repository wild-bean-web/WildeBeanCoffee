import "server-only";

import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { uniqueRecipeCode } from "@/domain/recipes";
import { todayIso } from "@/lib/date-range";
import { getDb } from "@/db/client";
import {
  products,
  recipeComponents,
  recipeVersions,
  recipes,
  unitsOfMeasure,
} from "@/db/schema";

const ingredientSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().positive(),
  uomId: z.string().uuid(),
  wasteFactor: z.number().min(0).lt(1).default(0),
});

const draftSchema = z.object({
  name: z.string().trim().min(1).max(160),
  outputProductId: z.string().uuid(),
  yieldQuantity: z.number().positive(),
  yieldUomId: z.string().uuid(),
  ingredients: z.array(ingredientSchema).min(1).max(24),
});

export interface RecipeListItem {
  id: string;
  name: string;
  code: string;
  outputName: string;
  status: string;
  versionNumber: number;
  yieldQuantity: string;
  yieldSymbol: string;
  ingredientCount: number;
}

export interface RecipeDraftInput {
  organizationId: string;
  staffMemberId: string | null;
  name: string;
  outputProductId: string;
  yieldQuantity: number;
  yieldUomId: string;
  ingredients: Array<{
    productId: string;
    quantity: number;
    uomId: string;
    wasteFactor: number;
  }>;
}

export async function listRecipes(organizationId: string): Promise<RecipeListItem[]> {
  const rows = await getDb()
    .select({
      id: recipes.id,
      name: recipes.name,
      code: recipes.code,
      outputName: products.name,
      status: recipeVersions.status,
      versionNumber: recipeVersions.versionNumber,
      yieldQuantity: recipeVersions.yieldQuantity,
      yieldSymbol: unitsOfMeasure.symbol,
      versionId: recipeVersions.id,
    })
    .from(recipes)
    .innerJoin(products, eq(products.id, recipes.outputProductId))
    .innerJoin(recipeVersions, eq(recipeVersions.recipeId, recipes.id))
    .innerJoin(unitsOfMeasure, eq(unitsOfMeasure.id, recipeVersions.yieldUomId))
    .where(eq(recipes.organizationId, organizationId))
    .orderBy(asc(recipes.name), desc(recipeVersions.versionNumber));

  const latest = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (!latest.has(row.id)) latest.set(row.id, row);
  }
  const versions = [...latest.values()];
  if (versions.length === 0) return [];

  const counts = await getDb()
    .select({
      recipeVersionId: recipeComponents.recipeVersionId,
    })
    .from(recipeComponents)
    .where(
      inArray(
        recipeComponents.recipeVersionId,
        versions.map((version) => version.versionId),
      ),
    );
  const countByVersion = new Map<string, number>();
  for (const row of counts) {
    countByVersion.set(row.recipeVersionId, (countByVersion.get(row.recipeVersionId) ?? 0) + 1);
  }

  return versions.map((version) => ({
    id: version.id,
    name: version.name,
    code: version.code,
    outputName: version.outputName,
    status: version.status,
    versionNumber: version.versionNumber,
    yieldQuantity: version.yieldQuantity,
    yieldSymbol: version.yieldSymbol,
    ingredientCount: countByVersion.get(version.versionId) ?? 0,
  }));
}

export async function createRecipeDraft(
  input: RecipeDraftInput,
): Promise<{ ok: true; name: string } | { ok: false; message: string }> {
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Enter a name, a yield, and at least one ingredient." };
  }
  const draft = parsed.data;
  const db = getDb();
  const [productRows, unitRows, existing] = await Promise.all([
    db
      .select({ id: products.id })
      .from(products)
      .where(
        and(eq(products.organizationId, input.organizationId), eq(products.isActive, true)),
      ),
    db
      .select({ id: unitsOfMeasure.id })
      .from(unitsOfMeasure)
      .where(eq(unitsOfMeasure.organizationId, input.organizationId)),
    db
      .select({ code: recipes.code })
      .from(recipes)
      .where(eq(recipes.organizationId, input.organizationId)),
  ]);
  const productIds = new Set(productRows.map((row) => row.id));
  const unitIds = new Set(unitRows.map((row) => row.id));
  if (!productIds.has(draft.outputProductId) || !unitIds.has(draft.yieldUomId)) {
    return { ok: false, message: "Choose a product and unit from this company." };
  }
  for (const ingredient of draft.ingredients) {
    if (!productIds.has(ingredient.productId) || !unitIds.has(ingredient.uomId)) {
      return { ok: false, message: "Each ingredient must use a product and unit from this company." };
    }
  }

  const code = uniqueRecipeCode(draft.name, new Set(existing.map((row) => row.code)));
  await db.transaction(async (tx) => {
    const [recipe] = await tx
      .insert(recipes)
      .values({
        organizationId: input.organizationId,
        outputProductId: draft.outputProductId,
        code,
        name: draft.name,
      })
      .returning({ id: recipes.id });
    if (!recipe) throw new Error("The recipe could not be saved.");
    const [version] = await tx
      .insert(recipeVersions)
      .values({
        organizationId: input.organizationId,
        recipeId: recipe.id,
        versionNumber: 1,
        status: "draft",
        effectiveFrom: todayIso(),
        yieldQuantity: draft.yieldQuantity.toFixed(6),
        yieldUomId: draft.yieldUomId,
        createdByStaffMemberId: input.staffMemberId,
      })
      .returning({ id: recipeVersions.id });
    if (!version) throw new Error("The recipe version could not be saved.");
    await tx.insert(recipeComponents).values(
      draft.ingredients.map((ingredient, index) => ({
        organizationId: input.organizationId,
        recipeVersionId: version.id,
        lineNumber: index + 1,
        componentType: "product" as const,
        productId: ingredient.productId,
        quantity: ingredient.quantity.toFixed(6),
        uomId: ingredient.uomId,
        wasteFactor: ingredient.wasteFactor.toFixed(8),
      })),
    );
  });

  return { ok: true, name: draft.name };
}

export async function listRecipeChoices(organizationId: string): Promise<{
  products: Array<{ id: string; name: string; sku: string }>;
  units: Array<{ id: string; symbol: string; name: string }>;
}> {
  const db = getDb();
  const [productRows, unitRows] = await Promise.all([
    db
      .select({ id: products.id, name: products.name, sku: products.sku })
      .from(products)
      .where(and(eq(products.organizationId, organizationId), eq(products.isActive, true)))
      .orderBy(asc(products.name))
      .limit(400),
    db
      .select({
        id: unitsOfMeasure.id,
        symbol: unitsOfMeasure.symbol,
        name: unitsOfMeasure.name,
      })
      .from(unitsOfMeasure)
      .where(eq(unitsOfMeasure.organizationId, organizationId))
      .orderBy(asc(unitsOfMeasure.name)),
  ]);
  return { products: productRows, units: unitRows };
}
