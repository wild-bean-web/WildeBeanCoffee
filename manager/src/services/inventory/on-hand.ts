import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { DomainDecimal, canonicalDecimal } from "@/domain/inventory";
import { inventoryMovements } from "@/db/schema";
import type { InventoryLedgerContext } from "./context";

export async function onHandQuantity(
  context: InventoryLedgerContext,
  input: { productId: string; locationId?: string },
): Promise<string> {
  const [row] = await context.db
    .select({
      quantity: sql<string>`coalesce(sum(${inventoryMovements.quantity}), 0)`,
    })
    .from(inventoryMovements)
    .where(
      and(
        eq(inventoryMovements.organizationId, context.organizationId),
        eq(
          inventoryMovements.locationId,
          input.locationId ?? context.locationId,
        ),
        eq(inventoryMovements.productId, input.productId),
      ),
    );

  return canonicalDecimal(new DomainDecimal(row?.quantity ?? "0"));
}

export async function hasOpeningBalance(
  context: InventoryLedgerContext,
  productId?: string,
): Promise<boolean> {
  const filters = [
    eq(inventoryMovements.organizationId, context.organizationId),
    eq(inventoryMovements.locationId, context.locationId),
    eq(inventoryMovements.movementType, "opening_balance"),
  ];
  if (productId) {
    filters.push(eq(inventoryMovements.productId, productId));
  }

  const [row] = await context.db
    .select({ id: inventoryMovements.id })
    .from(inventoryMovements)
    .where(and(...filters))
    .limit(1);

  return Boolean(row);
}
