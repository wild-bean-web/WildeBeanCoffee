import "server-only";

import { and, asc, eq, sql } from "drizzle-orm";
import {
  canonicalVendorName,
  catalogDraftFromInventoryRow,
  InventoryNormalizedRowSchema,
  LEGACY_INVENTORY_IMPORT_KIND,
  slugCode,
} from "@/domain/catalog";
import { getDb } from "@/db/client";
import {
  importBatches,
  importRows,
  products,
  purchasePacks,
  unitsOfMeasure,
  vendorItems,
  vendors,
} from "@/db/schema";
import type { ManagerSession } from "@/lib/auth/session";
import { appendAuditEvent } from "@/services/audit/append";
import { addProductToOpenCountSheets } from "@/services/inventory/counts";
import { ImportServiceError } from "./errors";

export interface PostedInventoryCatalog {
  batchId: string;
  alreadyPosted: boolean;
  productCount: number;
  vendorCount: number;
  packCount: number;
  skippedRows: number;
}

async function requireEachUom(
  organizationId: string,
): Promise<{ id: string }> {
  const [unit] = await getDb()
    .select({ id: unitsOfMeasure.id })
    .from(unitsOfMeasure)
    .where(
      and(
        eq(unitsOfMeasure.organizationId, organizationId),
        eq(unitsOfMeasure.code, "each"),
      ),
    )
    .limit(1);
  if (!unit) {
    throw new ImportServiceError(
      "Seed units of measure before posting the count-sheet catalog.",
      409,
      "UOM_MISSING",
    );
  }
  return unit;
}

export async function postStagedInventoryCatalog(
  session: ManagerSession,
  batchId: string,
): Promise<PostedInventoryCatalog> {
  if (!session.organizationId) {
    throw new ImportServiceError(
      "Choose a store before posting the count-sheet catalog.",
      409,
      "ORGANIZATION_REQUIRED",
    );
  }

  const organizationId = session.organizationId;
  const db = getDb();
  const [batch] = await db
    .select()
    .from(importBatches)
    .where(
      and(
        eq(importBatches.id, batchId),
        eq(importBatches.organizationId, organizationId),
      ),
    )
    .limit(1);

  if (!batch) {
    throw new ImportServiceError(
      "That inventory import is not available.",
      404,
      "IMPORT_BATCH_NOT_FOUND",
    );
  }
  if (batch.importKind !== LEGACY_INVENTORY_IMPORT_KIND) {
    throw new ImportServiceError(
      "Only staged count-sheet spreadsheets can be posted into the catalog.",
      400,
      "IMPORT_KIND_UNSUPPORTED",
    );
  }
  if (batch.status === "voided" || batch.status === "failed") {
    throw new ImportServiceError(
      "That inventory import cannot be posted.",
      409,
      "IMPORT_BATCH_CLOSED",
    );
  }
  if (batch.status === "posted") {
    return {
      batchId: batch.id,
      alreadyPosted: true,
      productCount: batch.readyCount,
      vendorCount: 0,
      packCount: 0,
      skippedRows: 0,
    };
  }

  const each = await requireEachUom(organizationId);
  const rows = await db
    .select()
    .from(importRows)
    .where(eq(importRows.importBatchId, batch.id))
    .orderBy(asc(importRows.sourceRowNumber));

  const createdProducts: Array<{
    id: string;
    category: string | null;
    unitCostCents: string | null;
  }> = [];

  const summary = await db.transaction(async (transaction) => {
    const vendorByName = new Map<string, { id: string; code: string }>();
    let productCount = 0;
    let packCount = 0;
    let skippedRows = 0;

    for (const row of rows) {
      if (row.status === "posted" && row.targetEntityId) {
        productCount += 1;
        continue;
      }
      if (row.status === "rejected") {
        skippedRows += 1;
        continue;
      }

      const parsed = InventoryNormalizedRowSchema.safeParse(row.normalizedData);
      if (!parsed.success) {
        skippedRows += 1;
        continue;
      }

      const draft = catalogDraftFromInventoryRow({
        sourceSha256: batch.sourceSha256,
        sourceRow: row.sourceRowNumber,
        row: parsed.data,
      });

      const [insertedProduct] = await transaction
        .insert(products)
        .values({
          organizationId,
          sku: draft.sku,
          name: draft.countSheetName,
          description: draft.vendorDescription,
          productType: "inventory",
          inventoryUomId: each.id,
          category: draft.category,
          defaultUnitCostCents: draft.unitCostCents,
          trackInventory: true,
          isActive: true,
        })
        .onConflictDoNothing()
        .returning({ id: products.id });

      let productId = insertedProduct?.id ?? null;
      if (!productId) {
        const [existingProduct] = await transaction
          .select({ id: products.id })
          .from(products)
          .where(
            and(
              eq(products.organizationId, organizationId),
              eq(products.sku, draft.sku),
            ),
          )
          .limit(1);
        productId = existingProduct?.id ?? null;
      }
      if (!productId) {
        throw new ImportServiceError(
          "The count-sheet catalog could not be saved.",
          409,
          "PRODUCT_SAVE_FAILED",
        );
      }

      await transaction
        .update(products)
        .set({
          name: draft.countSheetName,
          description: draft.vendorDescription,
          category: draft.category,
          defaultUnitCostCents: draft.unitCostCents,
          trackInventory: true,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(products.id, productId));

      createdProducts.push({
        id: productId,
        category: draft.category,
        unitCostCents: draft.unitCostCents,
      });
      productCount += 1;

      if (draft.vendorName) {
        const canonical = canonicalVendorName(draft.vendorName);
        let vendor = vendorByName.get(canonical.toLowerCase());
        if (!vendor) {
          const [existingVendor] = await transaction
            .select({ id: vendors.id, code: vendors.code })
            .from(vendors)
            .where(
              and(
                eq(vendors.organizationId, organizationId),
                sql`lower(${vendors.name}) = ${canonical.toLowerCase()}`,
              ),
            )
            .limit(1);
          if (existingVendor) {
            vendor = existingVendor;
          } else {
            const [createdVendor] = await transaction
              .insert(vendors)
              .values({
                organizationId,
                code: slugCode(canonical, "vendor", 64),
                name: canonical,
                status: "active",
              })
              .onConflictDoNothing()
              .returning({ id: vendors.id, code: vendors.code });
            if (createdVendor) {
              vendor = createdVendor;
            } else {
              const [again] = await transaction
                .select({ id: vendors.id, code: vendors.code })
                .from(vendors)
                .where(
                  and(
                    eq(vendors.organizationId, organizationId),
                    sql`lower(${vendors.name}) = ${canonical.toLowerCase()}`,
                  ),
                )
                .limit(1);
              if (!again) {
                throw new ImportServiceError(
                  "The vendor could not be saved.",
                  409,
                  "VENDOR_SAVE_FAILED",
                );
              }
              vendor = again;
            }
          }
          vendorByName.set(canonical.toLowerCase(), vendor);
        }

        const [insertedItem] = await transaction
          .insert(vendorItems)
          .values({
            organizationId,
            vendorId: vendor.id,
            productId,
            purchaseUomId: each.id,
            vendorSku: draft.vendorSku,
            description: draft.vendorDescription,
            isActive: true,
          })
          .onConflictDoNothing()
          .returning({ id: vendorItems.id });

        let vendorItemId = insertedItem?.id ?? null;
        if (!vendorItemId) {
          const [existingItem] = await transaction
            .select({ id: vendorItems.id })
            .from(vendorItems)
            .where(
              and(
                eq(vendorItems.vendorId, vendor.id),
                eq(vendorItems.vendorSku, draft.vendorSku),
              ),
            )
            .limit(1);
          vendorItemId = existingItem?.id ?? null;
        }

        if (vendorItemId) {
          await transaction
            .update(vendorItems)
            .set({
              productId,
              description: draft.vendorDescription,
              isActive: true,
              updatedAt: new Date(),
            })
            .where(eq(vendorItems.id, vendorItemId));

          if (draft.packCode && draft.packQuantity) {
            const [insertedPack] = await transaction
              .insert(purchasePacks)
              .values({
                organizationId,
                vendorItemId,
                code: draft.packCode,
                packUomId: each.id,
                containedQuantity: draft.packQuantity,
                containedUomId: each.id,
                isDefault: true,
              })
              .onConflictDoNothing()
              .returning({ id: purchasePacks.id });
            if (insertedPack) packCount += 1;
          }
        }
      }

      await transaction
        .update(importRows)
        .set({
          status: "posted",
          targetEntityType: "product",
          targetEntityId: productId,
          reviewedByStaffMemberId: session.staffMemberId,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(importRows.id, row.id));
    }

    if (productCount === 0) {
      throw new ImportServiceError(
        "No count-sheet rows were ready to post from that spreadsheet.",
        409,
        "IMPORT_ROWS_EMPTY",
      );
    }

    await transaction
      .update(importBatches)
      .set({
        status: "posted",
        readyCount: productCount,
        reviewCount: 0,
        approvedByStaffMemberId: session.staffMemberId,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(importBatches.id, batch.id));

    return {
      productCount,
      vendorCount: vendorByName.size,
      packCount,
      skippedRows,
    };
  });

  for (const product of createdProducts) {
    await addProductToOpenCountSheets({
      organizationId,
      productId: product.id,
      inventoryUomId: each.id,
      category: product.category,
      staffMemberId: session.staffMemberId,
      defaultUnitCostCents: product.unitCostCents,
    });
  }

  await appendAuditEvent({
    organizationId,
    actorType: "staff",
    actorStaffMemberId: session.staffMemberId ?? undefined,
    actorExternalId: session.userId,
    sourceSystem: "manager_web",
    action: "catalog.inventory_import_posted",
    entityType: "import_batch",
    entityId: batch.id,
    eventData: {
      sourceFilename: batch.sourceFilename,
      productCount: summary.productCount,
      vendorCount: summary.vendorCount,
      packCount: summary.packCount,
      skippedRows: summary.skippedRows,
    },
  });

  return {
    batchId: batch.id,
    alreadyPosted: false,
    ...summary,
  };
}
