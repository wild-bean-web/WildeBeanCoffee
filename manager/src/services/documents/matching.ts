import "server-only";

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  documentLines,
  mappingRevisions,
  products,
  sourceDocuments,
  unitsOfMeasure,
  vendorItems,
  vendors,
} from "@/db/schema";
import {
  canonicalVendorName,
  inferProductCategory,
  normalizeVendorDescription,
  suggestCountSheetName,
} from "@/domain/catalog";
import { matchProductLine } from "@/domain/documents";
import { sha256Hex } from "@/domain/shared";
import type { ManagerSession } from "@/lib/auth/session";
import { appendAuditEvent } from "@/services/audit/append";
import { persistPacketLines } from "@/services/documents/extracted-lines";
import { DocumentServiceError } from "@/services/documents/errors";
import type {
  DocumentMatchingWorkspace,
  MatchingCandidate,
  MatchingLine,
} from "@/services/documents/matching-types";
import { addProductToOpenCountSheets } from "@/services/inventory/counts";
import { requireLocationScope } from "@/services/locations/scope";
import type { ProposedInvoicePacket } from "@/integrations/document-ai/packet";

export type {
  DocumentMatchingWorkspace,
  MatchingCandidate,
  MatchingLine,
} from "@/services/documents/matching-types";

function slugCode(value: string, fallback: string, max: number): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, max);
  return slug || fallback;
}

function vendorSkuKey(vendorSku: string | null, description: string): string {
  if (vendorSku?.trim()) return vendorSku.trim().slice(0, 128);
  return `NOSKU-${sha256Hex(normalizeVendorDescription(description)).slice(0, 20)}`;
}

async function requireEachUom(organizationId: string) {
  const [unit] = await getDb()
    .select({
      id: unitsOfMeasure.id,
      code: unitsOfMeasure.code,
    })
    .from(unitsOfMeasure)
    .where(
      and(
        eq(unitsOfMeasure.organizationId, organizationId),
        eq(unitsOfMeasure.code, "each"),
      ),
    )
    .limit(1);
  if (!unit) {
    throw new DocumentServiceError(
      "Seed units of measure before cataloging invoice lines.",
      409,
      "UOM_MISSING",
    );
  }
  return unit;
}

async function findOrCreateVendor(
  organizationId: string,
  rawName: string | null | undefined,
) {
  const db = getDb();
  const name = canonicalVendorName(rawName);
  const [existing] = await db
    .select()
    .from(vendors)
    .where(
      and(
        eq(vendors.organizationId, organizationId),
        sql`lower(${vendors.name}) = ${name.toLowerCase()}`,
      ),
    )
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(vendors)
    .values({
      organizationId,
      code: slugCode(name, "vendor", 64),
      name,
      status: "active",
    })
    .onConflictDoNothing()
    .returning();
  if (created) return created;

  const [again] = await db
    .select()
    .from(vendors)
    .where(
      and(
        eq(vendors.organizationId, organizationId),
        sql`lower(${vendors.name}) = ${name.toLowerCase()}`,
      ),
    )
    .limit(1);
  if (!again) {
    throw new DocumentServiceError(
      "The vendor could not be saved.",
      409,
      "VENDOR_SAVE_FAILED",
    );
  }
  return again;
}

async function resolveDocumentVendor(
  document: typeof sourceDocuments.$inferSelect,
  fallbackName: string | null | undefined,
) {
  const db = getDb();
  if (document.vendorId) {
    const [existing] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.id, document.vendorId))
      .limit(1);
    if (existing) return existing;
  }

  const vendor = await findOrCreateVendor(
    document.organizationId,
    fallbackName ?? vendorNameFromDocument(document),
  );
  await db
    .update(sourceDocuments)
    .set({
      vendorId: vendor.id,
      metadata: { ...document.metadata, vendorName: vendor.name },
      updatedAt: new Date(),
    })
    .where(eq(sourceDocuments.id, document.id));
  return vendor;
}

async function nextMappingRevision(documentLineId: string): Promise<number> {
  const [latest] = await getDb()
    .select({ revisionNumber: mappingRevisions.revisionNumber })
    .from(mappingRevisions)
    .where(eq(mappingRevisions.documentLineId, documentLineId))
    .orderBy(desc(mappingRevisions.revisionNumber))
    .limit(1);
  return (latest?.revisionNumber ?? 0) + 1;
}

async function latestMappings(lineIds: string[]) {
  if (lineIds.length === 0) {
    return new Map<string, typeof mappingRevisions.$inferSelect>();
  }
  const rows = await getDb()
    .select()
    .from(mappingRevisions)
    .where(inArray(mappingRevisions.documentLineId, lineIds))
    .orderBy(desc(mappingRevisions.revisionNumber));
  const latest = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (!latest.has(row.documentLineId)) latest.set(row.documentLineId, row);
  }
  return latest;
}

export async function getDocumentMatching(
  session: ManagerSession,
  documentId: string,
  packet: ProposedInvoicePacket,
): Promise<DocumentMatchingWorkspace> {
  const scope = requireLocationScope(session);
  const db = getDb();
  const [document] = await db
    .select()
    .from(sourceDocuments)
    .where(
      and(
        eq(sourceDocuments.id, documentId),
        eq(sourceDocuments.organizationId, scope.organizationId),
        eq(sourceDocuments.locationId, scope.locationId),
      ),
    )
    .limit(1);
  if (!document) {
    throw new DocumentServiceError(
      "That document is not in this location inbox.",
      404,
      "DOCUMENT_NOT_FOUND",
    );
  }

  await persistPacketLines(db, {
    organizationId: document.organizationId,
    sourceDocumentId: document.id,
    packet,
  });

  const vendorName =
    packet.invoices.find((invoice) => invoice.vendorName)?.vendorName ??
    (typeof document.metadata.vendorName === "string"
      ? document.metadata.vendorName
      : null);
  const vendor = await resolveDocumentVendor(document, vendorName);

  const lines = await db
    .select()
    .from(documentLines)
    .where(eq(documentLines.sourceDocumentId, document.id))
    .orderBy(asc(documentLines.lineNumber));

  const remembered = await db
    .select({
      id: vendorItems.id,
      vendorSku: vendorItems.vendorSku,
      description: vendorItems.description,
      productId: vendorItems.productId,
      productName: products.name,
      isActive: vendorItems.isActive,
    })
    .from(vendorItems)
    .innerJoin(products, eq(vendorItems.productId, products.id))
    .where(
      and(
        eq(vendorItems.organizationId, document.organizationId),
        eq(vendorItems.vendorId, vendor.id),
        eq(vendorItems.isActive, true),
        eq(products.isActive, true),
      ),
    );

  const catalogProducts = remembered
    .filter((item) => item.productId)
    .map((item) => ({
      catalogItemId: item.productId as string,
      vendorId: vendor.id,
      vendorSku: item.vendorSku,
      description: item.description,
      pack: { quantity: "1", unit: "each" },
      active: true,
    }));

  const mappings = await latestMappings(lines.map((line) => line.id));
  const each = await requireEachUom(document.organizationId);

  for (const line of lines) {
    const current = mappings.get(line.id);
    if (current?.status === "confirmed" && current.productId) continue;

    const sku = line.vendorSku?.trim().toUpperCase() ?? "";
    const exact =
      remembered.find(
        (item) =>
          sku && item.vendorSku.trim().toUpperCase() === sku && item.productId,
      ) ??
      remembered.find(
        (item) =>
          normalizeVendorDescription(item.description) ===
            normalizeVendorDescription(line.description) && item.productId,
      );
    if (!exact?.productId || !exact.productName) continue;

    const [created] = await db
      .insert(mappingRevisions)
      .values({
        organizationId: document.organizationId,
        documentLineId: line.id,
        revisionNumber: await nextMappingRevision(line.id),
        status: "confirmed",
        productId: exact.productId,
        vendorItemId: exact.id,
        mappedQuantity: line.quantity ?? "1",
        mappedUomId: each.id,
        rationale: sku ? "remembered_vendor_sku" : "remembered_vendor_description",
        createdByStaffMemberId: session.staffMemberId,
      })
      .onConflictDoNothing()
      .returning();
    if (created) {
      mappings.set(line.id, created);
    } else {
      const current = (await latestMappings([line.id])).get(line.id);
      if (current) mappings.set(line.id, current);
    }
  }

  const orgCatalog = await db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
    })
    .from(products)
    .where(
      and(
        eq(products.organizationId, document.organizationId),
        eq(products.isActive, true),
      ),
    )
    .orderBy(asc(products.name))
    .limit(200);

  const matchingLines: MatchingLine[] = lines.map((line) => {
    const mapping = mappings.get(line.id);
    const sku = line.vendorSku?.trim() || undefined;
    const unitPrice = line.unitCostCents
      ? Number.parseInt(line.unitCostCents, 10)
      : Number.NaN;
    let result: ReturnType<typeof matchProductLine> = {
      kind: "unmatched",
      sourceLineId: line.sourceLineId ?? line.id,
      candidates: [],
    };
    try {
      result = matchProductLine(
        {
          sourceLineId: line.sourceLineId ?? line.id,
          vendorId: vendor.id,
          vendorSku: sku,
          description: line.description,
          pack: { quantity: "1", unit: "each" },
          unitPriceCents:
            Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : undefined,
        },
        catalogProducts,
      );
    } catch {
      result = {
        kind: "unmatched",
        sourceLineId: line.sourceLineId ?? line.id,
        candidates: [],
      };
    }
    const candidateIds =
      result.kind === "candidates"
        ? result.candidates.map((candidate) => candidate.catalogItemId)
        : result.kind === "exact"
          ? [result.catalogItemId]
          : result.kind === "ambiguous_exact"
            ? [...result.catalogItemIds]
            : [];
    const candidates: MatchingCandidate[] = candidateIds
      .map((productId) => {
        const item = remembered.find((row) => row.productId === productId);
        if (!item?.productId || !item.productName) return null;
        return {
          productId: item.productId,
          productName: item.productName,
          vendorDescription: item.description,
          vendorSku: item.vendorSku,
        };
      })
      .filter((item): item is MatchingCandidate => Boolean(item));

    const confirmed = mapping?.status === "confirmed" && mapping.productId;
    const rememberedMatch = Boolean(confirmed && mapping?.rationale?.startsWith("remembered_"));
    const mappedProduct = confirmed
      ? orgCatalog.find((product) => product.id === mapping.productId) ??
        remembered.find((item) => item.productId === mapping.productId)
      : null;
    const akaName =
      mappedProduct && "name" in mappedProduct
        ? mappedProduct.name
        : mappedProduct && "productName" in mappedProduct
          ? mappedProduct.productName
          : null;

    return {
      documentLineId: line.id,
      sourceLineId: line.sourceLineId ?? line.id,
      invoiceLabel:
        typeof line.rawData.invoiceId === "string"
          ? line.rawData.invoiceId
          : null,
      vendorDescription: line.description,
      vendorSku: line.vendorSku,
      quantity: line.quantity,
      unit: line.uomText,
      amountCents: line.totalCents,
      suggestedAka: suggestCountSheetName(line.description),
      status: confirmed
        ? rememberedMatch
          ? "remembered"
          : "confirmed"
        : candidates.length > 0
          ? "suggested"
          : "unmatched",
      productId: mapping?.productId ?? null,
      akaName,
      vendorItemId: mapping?.vendorItemId ?? null,
      candidates,
    };
  });

  const mappedCount = matchingLines.filter(
    (line) => line.status === "confirmed" || line.status === "remembered",
  ).length;

  return {
    documentId: document.id,
    status: document.status,
    vendorName: vendor.name,
    mappedCount,
    lineCount: matchingLines.length,
    canApprove:
      matchingLines.length > 0 &&
      mappedCount === matchingLines.length &&
      (document.status === "needs_review" ||
        document.status === "approved" ||
        document.status === "auto_ready"),
    lines: matchingLines,
    catalog: orgCatalog,
  };
}

export async function catalogDocumentLine(
  session: ManagerSession,
  input: {
    documentId: string;
    documentLineId: string;
    akaName: string;
  },
) {
  const scope = requireLocationScope(session);
  const db = getDb();
  const akaName = input.akaName.trim();
  if (!akaName) {
    throw new DocumentServiceError(
      "Enter an AKA name for the count sheet.",
      400,
      "AKA_REQUIRED",
    );
  }

  const [document] = await db
    .select()
    .from(sourceDocuments)
    .where(
      and(
        eq(sourceDocuments.id, input.documentId),
        eq(sourceDocuments.organizationId, scope.organizationId),
        eq(sourceDocuments.locationId, scope.locationId),
      ),
    )
    .limit(1);
  const [line] = await db
    .select()
    .from(documentLines)
    .where(
      and(
        eq(documentLines.id, input.documentLineId),
        eq(documentLines.sourceDocumentId, input.documentId),
      ),
    )
    .limit(1);
  if (!document || !line) {
    throw new DocumentServiceError(
      "That invoice line is not available.",
      404,
      "DOCUMENT_LINE_NOT_FOUND",
    );
  }

  const vendor = await resolveDocumentVendor(
    document,
    vendorNameFromDocument(document),
  );
  const each = await requireEachUom(document.organizationId);
  const sku = vendorSkuKey(line.vendorSku, line.description);
  const productSku = `${vendor.code}-${sku}`.slice(0, 96);
  const category = inferProductCategory(`${akaName} ${line.description}`);
  const unitCost = line.unitCostCents;

  const [existingItem] = await db
    .select()
    .from(vendorItems)
    .where(
      and(eq(vendorItems.vendorId, vendor.id), eq(vendorItems.vendorSku, sku)),
    )
    .limit(1);

  let productId = existingItem?.productId ?? null;
  if (!productId) {
    const [createdProduct] = await db
      .insert(products)
      .values({
        organizationId: document.organizationId,
        sku: productSku,
        name: akaName,
        description: line.description,
        productType: "inventory",
        inventoryUomId: each.id,
        category,
        defaultUnitCostCents: unitCost,
        trackInventory: true,
        isActive: true,
      })
      .onConflictDoNothing()
      .returning({ id: products.id });
    if (createdProduct) {
      productId = createdProduct.id;
    } else {
      const [existingProduct] = await db
        .select({ id: products.id })
        .from(products)
        .where(
          and(
            eq(products.organizationId, document.organizationId),
            eq(products.sku, productSku),
          ),
        )
        .limit(1);
      productId = existingProduct?.id ?? null;
    }
  }

  if (!productId) {
    throw new DocumentServiceError(
      "The catalog item could not be saved.",
      409,
      "PRODUCT_SAVE_FAILED",
    );
  }

  await db
    .update(products)
    .set({
      name: akaName,
      description: line.description,
      category,
      updatedAt: new Date(),
    })
    .where(eq(products.id, productId));

  let vendorItemId = existingItem?.id ?? null;
  if (!vendorItemId) {
    const [createdItem] = await db
      .insert(vendorItems)
      .values({
        organizationId: document.organizationId,
        vendorId: vendor.id,
        productId,
        purchaseUomId: each.id,
        vendorSku: sku,
        description: line.description,
        isActive: true,
      })
      .onConflictDoNothing()
      .returning({ id: vendorItems.id });
    vendorItemId = createdItem?.id ?? null;
  } else {
    await db
      .update(vendorItems)
      .set({
        productId,
        description: line.description,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(vendorItems.id, vendorItemId));
  }

  if (!vendorItemId) {
    const [again] = await db
      .select({ id: vendorItems.id })
      .from(vendorItems)
      .where(
        and(eq(vendorItems.vendorId, vendor.id), eq(vendorItems.vendorSku, sku)),
      )
      .limit(1);
    vendorItemId = again?.id ?? null;
  }

  await db.insert(mappingRevisions).values({
    organizationId: document.organizationId,
    documentLineId: line.id,
    revisionNumber: await nextMappingRevision(line.id),
    status: "confirmed",
    productId,
    vendorItemId,
    mappedQuantity: line.quantity ?? "1",
    mappedUomId: each.id,
    rationale: "cataloged",
    createdByStaffMemberId: session.staffMemberId,
  });

  const sheetsUpdated = await addProductToOpenCountSheets({
    organizationId: document.organizationId,
    productId,
    inventoryUomId: each.id,
    category,
    staffMemberId: session.staffMemberId,
    defaultUnitCostCents: unitCost,
  });

  await appendAuditEvent({
    organizationId: document.organizationId,
    actorType: "staff",
    actorStaffMemberId: session.staffMemberId ?? undefined,
    actorExternalId: session.userId,
    sourceSystem: "manager_web",
    action: "catalog.item_mapped",
    entityType: "product",
    entityId: productId,
    eventData: {
      documentId: document.id,
      documentLineId: line.id,
      akaName,
      vendorDescription: line.description,
      sheetsUpdated,
    },
  });

  return { productId, akaName, sheetsUpdated };
}

export async function mapDocumentLine(
  session: ManagerSession,
  input: {
    documentId: string;
    documentLineId: string;
    productId: string;
  },
) {
  const scope = requireLocationScope(session);
  const db = getDb();
  const [document] = await db
    .select()
    .from(sourceDocuments)
    .where(
      and(
        eq(sourceDocuments.id, input.documentId),
        eq(sourceDocuments.organizationId, scope.organizationId),
        eq(sourceDocuments.locationId, scope.locationId),
      ),
    )
    .limit(1);
  const [line] = await db
    .select()
    .from(documentLines)
    .where(
      and(
        eq(documentLines.id, input.documentLineId),
        eq(documentLines.sourceDocumentId, input.documentId),
      ),
    )
    .limit(1);
  const [product] = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.id, input.productId),
        eq(products.organizationId, scope.organizationId),
      ),
    )
    .limit(1);
  if (!document || !line || !product) {
    throw new DocumentServiceError(
      "That catalog item is not available.",
      404,
      "PRODUCT_NOT_FOUND",
    );
  }

  const vendor = await resolveDocumentVendor(
    document,
    vendorNameFromDocument(document),
  );
  const sku = vendorSkuKey(line.vendorSku, line.description);
  const [existingItem] = await db
    .select()
    .from(vendorItems)
    .where(
      and(eq(vendorItems.vendorId, vendor.id), eq(vendorItems.vendorSku, sku)),
    )
    .limit(1);

  let vendorItemId = existingItem?.id ?? null;
  if (!vendorItemId) {
    const [created] = await db
      .insert(vendorItems)
      .values({
        organizationId: document.organizationId,
        vendorId: vendor.id,
        productId: product.id,
        purchaseUomId: product.inventoryUomId,
        vendorSku: sku,
        description: line.description,
        isActive: true,
      })
      .returning({ id: vendorItems.id });
    vendorItemId = created.id;
  } else {
    await db
      .update(vendorItems)
      .set({
        productId: product.id,
        description: line.description,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(vendorItems.id, vendorItemId));
  }

  await db.insert(mappingRevisions).values({
    organizationId: document.organizationId,
    documentLineId: line.id,
    revisionNumber: await nextMappingRevision(line.id),
    status: "confirmed",
    productId: product.id,
    vendorItemId,
    mappedQuantity: line.quantity ?? "1",
    mappedUomId: product.inventoryUomId,
    rationale: "manual",
    createdByStaffMemberId: session.staffMemberId,
  });

  const sheetsUpdated = await addProductToOpenCountSheets({
    organizationId: document.organizationId,
    productId: product.id,
    inventoryUomId: product.inventoryUomId,
    category: product.category,
    staffMemberId: session.staffMemberId,
    defaultUnitCostCents: product.defaultUnitCostCents,
  });

  return { productId: product.id, akaName: product.name, sheetsUpdated };
}

function vendorNameFromDocument(document: typeof sourceDocuments.$inferSelect) {
  return typeof document.metadata.vendorName === "string"
    ? document.metadata.vendorName
    : null;
}
