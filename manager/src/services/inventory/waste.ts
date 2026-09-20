import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  DomainDecimal,
  businessDateInTimezone,
  canonicalDecimal,
  planWasteQuantity,
  wasteSourceSystem,
  type WasteReason,
} from "@/domain/inventory";
import { inventoryMovements, products, unitsOfMeasure } from "@/db/schema";
import type { ManagerSession } from "@/lib/auth/session";
import { appendAuditEvent } from "@/services/audit/append";
import { requireInventoryLedger } from "./context";
import { InventoryServiceError } from "./errors";
import { onHandQuantity } from "./on-hand";

export interface RecordWasteInput {
  session: ManagerSession;
  productId: string;
  quantity: string;
  reason: WasteReason;
  occurredAt?: string;
  note?: string;
}

export interface RecordWasteResult {
  movementId: string;
  quantity: string;
  onHandAfter: string;
  wentNegative: boolean;
}

export async function recordWaste(
  input: RecordWasteInput,
): Promise<RecordWasteResult> {
  const context = await requireInventoryLedger(input.session);
  const occurredAt = input.occurredAt
    ? new Date(input.occurredAt)
    : new Date();
  const signedQuantity = planWasteQuantity(input.quantity);
  const externalId = randomUUID();

  const [product] = await context.db
    .select({
      id: products.id,
      name: products.name,
      inventoryUomId: products.inventoryUomId,
      trackInventory: products.trackInventory,
      isActive: products.isActive,
    })
    .from(products)
    .where(
      and(
        eq(products.id, input.productId),
        eq(products.organizationId, context.organizationId),
      ),
    )
    .limit(1);

  if (!product || !product.isActive || !product.trackInventory) {
    throw new InventoryServiceError(
      "Choose an active inventory product before recording waste.",
      400,
      "PRODUCT_NOT_COUNTABLE",
    );
  }

  const [unit] = await context.db
    .select({ id: unitsOfMeasure.id })
    .from(unitsOfMeasure)
    .where(eq(unitsOfMeasure.id, product.inventoryUomId))
    .limit(1);
  if (!unit) {
    throw new InventoryServiceError(
      "The product is missing a stocking unit.",
      400,
      "PRODUCT_UNIT_MISSING",
    );
  }

  const onHandBefore = await onHandQuantity(context, {
    productId: product.id,
  });
  const onHandAfter = new DomainDecimal(onHandBefore).plus(signedQuantity);
  const wentNegative = onHandAfter.isNegative();

  const [movement] = await context.db
    .insert(inventoryMovements)
    .values({
      organizationId: context.organizationId,
      locationId: context.locationId,
      productId: product.id,
      uomId: product.inventoryUomId,
      movementType: "waste",
      quantity: signedQuantity,
      occurredAt,
      businessDate: businessDateInTimezone(occurredAt, context.timezone),
      sourceSystem: wasteSourceSystem(input.reason),
      externalId,
      createdByStaffMemberId: context.staffMemberId,
    })
    .returning({ id: inventoryMovements.id });

  await appendAuditEvent({
    organizationId: context.organizationId,
    actorType: "staff",
    actorStaffMemberId: context.staffMemberId,
    actorExternalId: input.session.userId,
    sourceSystem: wasteSourceSystem(input.reason),
    action: "inventory.waste_recorded",
    entityType: "inventory_movement",
    entityId: movement.id,
    eventData: {
      productId: product.id,
      productName: product.name,
      quantity: signedQuantity,
      reason: input.reason,
      wentNegative,
      ...(input.note ? { note: input.note } : {}),
    },
  });

  return {
    movementId: movement.id,
    quantity: signedQuantity,
    onHandAfter: canonicalDecimal(onHandAfter),
    wentNegative,
  };
}
