import "server-only";

import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  accountingPeriods,
  documentLines,
  goodsReceiptLines,
  goodsReceipts,
  inventoryMovements,
  mappingRevisions,
  products,
  purchaseLines,
  purchases,
  sourceDocuments,
} from "@/db/schema";
import {
  IllegalDocumentTransitionError,
  assertDocumentTransition,
  type DocumentStatus,
} from "@/domain/documents";
import type { ManagerSession } from "@/lib/auth/session";
import { appendAuditEvent } from "@/services/audit/append";
import { DocumentServiceError } from "@/services/documents/errors";
import { requireLocationScope } from "@/services/locations/scope";

const POSTABLE_STATUSES = new Set<DocumentStatus>([
  "needs_review",
  "auto_ready",
  "approved",
]);

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function unitCostAndSubtotal(input: {
  quantity: string;
  unitCostCents: string | null;
  totalCents: number | null;
}): { unitCostCents: string; subtotalCents: number } {
  const parsedQuantity = Number.parseFloat(input.quantity);
  const qty =
    Number.isFinite(parsedQuantity) && parsedQuantity !== 0
      ? Math.abs(parsedQuantity)
      : 1;
  if (input.totalCents != null) {
    return {
      unitCostCents: String(Math.abs(Math.round(input.totalCents / qty))),
      subtotalCents: input.totalCents,
    };
  }
  const unit = input.unitCostCents
    ? Math.abs(Number.parseInt(input.unitCostCents, 10) || 0)
    : 0;
  return {
    unitCostCents: String(unit),
    subtotalCents: Math.round(unit * qty),
  };
}

function asDocumentStatus(status: string): DocumentStatus {
  return status as DocumentStatus;
}

export async function postMappedDocument(
  session: ManagerSession,
  documentId: string,
) {
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
  if (document.status === "posted") {
    const [existing] = await db
      .select({ id: purchases.id, purchaseNumber: purchases.purchaseNumber })
      .from(purchases)
      .where(eq(purchases.sourceDocumentId, document.id))
      .limit(1);
    return {
      documentId: document.id,
      status: "posted" as const,
      purchaseId: existing?.id ?? null,
      purchaseNumber: existing?.purchaseNumber ?? null,
    };
  }
  if (!document.vendorId) {
    throw new DocumentServiceError(
      "Map at least one line so the vendor is known before posting.",
      409,
      "VENDOR_REQUIRED",
    );
  }

  const fromStatus = asDocumentStatus(document.status);
  if (!POSTABLE_STATUSES.has(fromStatus)) {
    throw new DocumentServiceError(
      "This invoice is still a draft until every line is mapped and an owner posts it.",
      409,
      "DOCUMENT_NOT_POSTABLE",
    );
  }

  const lines = await db
    .select()
    .from(documentLines)
    .where(eq(documentLines.sourceDocumentId, document.id))
    .orderBy(asc(documentLines.lineNumber));
  if (lines.length === 0) {
    throw new DocumentServiceError(
      "This file has no line items to post.",
      409,
      "NO_DOCUMENT_LINES",
    );
  }

  const mappings = await db
    .select()
    .from(mappingRevisions)
    .where(inArray(mappingRevisions.documentLineId, lines.map((line) => line.id)))
    .orderBy(desc(mappingRevisions.revisionNumber));
  const latest = new Map<string, (typeof mappings)[number]>();
  for (const mapping of mappings) {
    if (!latest.has(mapping.documentLineId)) latest.set(mapping.documentLineId, mapping);
  }

  const unmapped = lines.filter((line) => {
    const mapping = latest.get(line.id);
    return mapping?.status !== "confirmed" || !mapping.productId;
  });
  if (unmapped.length > 0) {
    throw new DocumentServiceError(
      "Every line needs an AKA catalog match before this invoice can post.",
      409,
      "LINES_UNMAPPED",
    );
  }

  const productIds = [
    ...new Set(
      [...latest.values()]
        .map((mapping) => mapping.productId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const catalog = await db
    .select({
      id: products.id,
      name: products.name,
      inventoryUomId: products.inventoryUomId,
      trackInventory: products.trackInventory,
    })
    .from(products)
    .where(inArray(products.id, productIds));
  const productsById = new Map(catalog.map((product) => [product.id, product]));

  const purchaseDate = document.documentDate ?? todayDate();
  const [period] = await db
    .select({ id: accountingPeriods.id })
    .from(accountingPeriods)
    .where(
      and(
        eq(accountingPeriods.organizationId, scope.organizationId),
        lte(accountingPeriods.startsOn, purchaseDate),
        gte(accountingPeriods.endsOn, purchaseDate),
      ),
    )
    .limit(1);

  const lineMoney = lines.map((line) => {
    const mapping = latest.get(line.id);
    return unitCostAndSubtotal({
      quantity: mapping?.mappedQuantity ?? line.quantity ?? "1",
      unitCostCents: line.unitCostCents,
      totalCents: line.totalCents,
    }).subtotalCents;
  });
  const subtotalCents = lineMoney.reduce((sum, value) => sum + value, 0);
  const taxCents = 0;
  const totalCents = document.totalCents ?? subtotalCents + taxCents;
  const headerSubtotal = totalCents - taxCents;
  const kind = totalCents < 0 ? "credit_memo" : "invoice";
  const currency = (document.currency ?? "USD").toUpperCase();
  const purchaseNumber = `INV-${document.id.replaceAll("-", "").toUpperCase()}`;
  const receiptNumber = `GR-${document.id.replaceAll("-", "").toUpperCase()}`;
  const postedAt = new Date();

  let result: { id: string; purchaseNumber: string };
  try {
    result = await db.transaction(async (transaction) => {
      if (fromStatus !== "approved") {
        assertDocumentTransition(fromStatus, "approved");
        await transaction
          .update(sourceDocuments)
          .set({ status: "approved", updatedAt: postedAt })
          .where(eq(sourceDocuments.id, document.id));
      }
      assertDocumentTransition("approved", "posted");

      const [purchase] = await transaction
        .insert(purchases)
        .values({
          organizationId: scope.organizationId,
          locationId: scope.locationId,
          vendorId: document.vendorId as string,
          accountingPeriodId: period?.id,
          sourceDocumentId: document.id,
          purchaseType: kind,
          status: "posted",
          purchaseNumber,
          sourceSystem: "manager_document",
          purchaseDate,
          currency,
          subtotalCents: headerSubtotal,
          discountCents: 0,
          taxCents,
          shippingCents: 0,
          tipCents: 0,
          totalCents: headerSubtotal + taxCents,
          createdByStaffMemberId: session.staffMemberId,
          approvedByStaffMemberId: session.staffMemberId,
          postedAt,
        })
        .returning({ id: purchases.id, purchaseNumber: purchases.purchaseNumber });

      const postedLines = [];
      for (const [index, line] of lines.entries()) {
        const mapping = latest.get(line.id);
        const product = productsById.get(mapping?.productId ?? "");
        if (!mapping?.productId || !product) {
          throw new DocumentServiceError(
            "A mapped product is missing from the catalog.",
            409,
            "PRODUCT_MISSING",
          );
        }
        const amounts = unitCostAndSubtotal({
          quantity: mapping.mappedQuantity ?? line.quantity ?? "1",
          unitCostCents: line.unitCostCents,
          totalCents: line.totalCents,
        });
        const [purchaseLine] = await transaction
          .insert(purchaseLines)
          .values({
            organizationId: scope.organizationId,
            purchaseId: purchase.id,
            lineNumber: index + 1,
            lineType: "item",
            productId: product.id,
            vendorItemId: mapping.vendorItemId,
            sourceDocumentLineId: line.id,
            mappingRevisionId: mapping.id,
            description: product.name,
            quantity: mapping.mappedQuantity ?? line.quantity ?? "1",
            uomId: mapping.mappedUomId ?? product.inventoryUomId,
            unitCostCents: amounts.unitCostCents,
            subtotalCents: amounts.subtotalCents,
            discountCents: 0,
            taxCents: 0,
            totalCents: amounts.subtotalCents,
          })
          .returning({ id: purchaseLines.id });
        postedLines.push({
          purchaseLineId: purchaseLine.id,
          product,
          mapping,
          line,
          amounts,
        });
      }

      const inventoryLines = postedLines.filter(
        (item) => item.product.trackInventory && item.amounts.subtotalCents >= 0,
      );
      if (inventoryLines.length > 0) {
        const [receipt] = await transaction
          .insert(goodsReceipts)
          .values({
            organizationId: scope.organizationId,
            locationId: scope.locationId,
            vendorId: document.vendorId as string,
            purchaseId: purchase.id,
            sourceDocumentId: document.id,
            receiptNumber,
            sourceSystem: "manager_document",
            status: "posted",
            receivedAt: postedAt,
            receivedByStaffMemberId: session.staffMemberId,
            postedAt,
          })
          .returning({ id: goodsReceipts.id });

        for (const [index, item] of inventoryLines.entries()) {
          const quantity = item.mapping.mappedQuantity ?? item.line.quantity ?? "1";
          const [receiptLine] = await transaction
            .insert(goodsReceiptLines)
            .values({
              organizationId: scope.organizationId,
              goodsReceiptId: receipt.id,
              purchaseLineId: item.purchaseLineId,
              lineNumber: index + 1,
              productId: item.product.id,
              uomId: item.mapping.mappedUomId ?? item.product.inventoryUomId,
              expectedQuantity: quantity,
              acceptedQuantity: quantity,
              rejectedQuantity: "0",
              unitCostCents: item.amounts.unitCostCents,
            })
            .returning({ id: goodsReceiptLines.id });

          await transaction.insert(inventoryMovements).values({
            organizationId: scope.organizationId,
            locationId: scope.locationId,
            productId: item.product.id,
            uomId: item.mapping.mappedUomId ?? item.product.inventoryUomId,
            movementType: "goods_receipt",
            quantity,
            unitCostCents: item.amounts.unitCostCents,
            extendedCostCents: item.amounts.subtotalCents,
            occurredAt: postedAt,
            businessDate: purchaseDate,
            sourceSystem: "manager_document",
            externalId: `${receiptLine.id}:goods_receipt`,
            goodsReceiptLineId: receiptLine.id,
            purchaseLineId: item.purchaseLineId,
            createdByStaffMemberId: session.staffMemberId,
          });
        }
      }

      await transaction
        .update(sourceDocuments)
        .set({
          status: "posted",
          vendorId: document.vendorId,
          documentDate: purchaseDate,
          currency,
          totalCents: headerSubtotal + taxCents,
          updatedAt: postedAt,
        })
        .where(eq(sourceDocuments.id, document.id));

      return purchase;
    });
  } catch (error) {
    if (error instanceof DocumentServiceError) throw error;
    if (error instanceof IllegalDocumentTransitionError) {
      throw new DocumentServiceError(
        "This invoice cannot move from review to posted yet.",
        409,
        "ILLEGAL_DOCUMENT_TRANSITION",
      );
    }
    throw error;
  }

  await appendAuditEvent({
    organizationId: scope.organizationId,
    actorType: "staff",
    actorStaffMemberId: session.staffMemberId ?? undefined,
    actorExternalId: session.userId,
    sourceSystem: "manager_web",
    action: "document.posted",
    entityType: "source_document",
    entityId: document.id,
    eventData: {
      purchaseId: result.id,
      purchaseNumber: result.purchaseNumber,
      lineCount: lines.length,
    },
  });

  return {
    documentId: document.id,
    status: "posted" as const,
    purchaseId: result.id,
    purchaseNumber: result.purchaseNumber,
  };
}
