import "server-only";

import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import {
  COUNT_SECTION_DEFINITIONS,
  costingFromPersistedPeriod,
  countSectionCodeForCategory,
  parseWasteReason,
} from "@/domain/inventory";
import { getDb } from "@/db/client";
import {
  accountingPeriods,
  inventoryCountLines,
  inventoryCountSessions,
  inventoryMovements,
  products,
  unitsOfMeasure,
  vendorItems,
  vendors,
} from "@/db/schema";
import { hasCapability } from "@/lib/auth/capabilities";
import type { ManagerSession } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/env";
import { locationScope } from "@/services/locations/scope";

export interface InventoryProductOption {
  id: string;
  name: string;
  sku: string;
  category: string | null;
  unitSymbol: string;
  vendorDescription: string | null;
  vendorName: string | null;
  sectionName: string;
}

export interface InventoryControlSnapshot {
  productCount: number;
  baselinePosted: boolean;
  openCount: {
    id: string;
    status: string;
    countNumber: string;
    asOf: Date;
    countedLines: number;
    totalLines: number;
  } | null;
  latestPostedCount: {
    id: string;
    countNumber: string;
    postedAt: Date | null;
  } | null;
  postedCountCount: number;
  wasteThisPeriod: number;
  currentPeriod: {
    id: string;
    name: string;
    status: string;
    startsOn: string;
    endsOn: string;
  } | null;
}

export async function listCountableProducts(
  session: ManagerSession,
): Promise<InventoryProductOption[]> {
  if (!getServerEnv().DATABASE_URL || !session.organizationId) return [];

  const rows = await getDb()
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      category: products.category,
      unitSymbol: unitsOfMeasure.symbol,
      vendorDescription: vendorItems.description,
      vendorName: vendors.name,
    })
    .from(products)
    .innerJoin(unitsOfMeasure, eq(products.inventoryUomId, unitsOfMeasure.id))
    .leftJoin(
      vendorItems,
      and(
        eq(vendorItems.productId, products.id),
        eq(vendorItems.isActive, true),
      ),
    )
    .leftJoin(vendors, eq(vendorItems.vendorId, vendors.id))
    .where(
      and(
        eq(products.organizationId, session.organizationId),
        eq(products.isActive, true),
        eq(products.trackInventory, true),
      ),
    )
    .orderBy(asc(products.name), asc(vendors.name));

  const unique = new Map<string, InventoryProductOption>();
  for (const row of rows) {
    if (unique.has(row.id)) continue;
    const sectionCode = countSectionCodeForCategory(row.category);
    unique.set(row.id, {
      id: row.id,
      name: row.name,
      sku: row.sku,
      category: row.category,
      unitSymbol: row.unitSymbol,
      vendorDescription: row.vendorDescription,
      vendorName: row.vendorName,
      sectionName:
        COUNT_SECTION_DEFINITIONS.find((section) => section.code === sectionCode)
          ?.name ?? "Packaging and dry storage",
    });
  }
  return [...unique.values()];
}

export async function getInventoryControlSnapshot(
  session: ManagerSession,
  options?: { asOf?: string },
): Promise<InventoryControlSnapshot> {
  const empty: InventoryControlSnapshot = {
    productCount: 0,
    baselinePosted: false,
    openCount: null,
    latestPostedCount: null,
    postedCountCount: 0,
    wasteThisPeriod: 0,
    currentPeriod: null,
  };
  if (!getServerEnv().DATABASE_URL || !session.organizationId) {
    return empty;
  }

  const scope = locationScope(session);
  if (!scope) return empty;

  const organizationId = scope.organizationId;
  const locationId = scope.locationId;
  const db = getDb();
  const today = options?.asOf ?? new Date().toISOString().slice(0, 10);

  const [productCountRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(products)
    .where(
      and(
        eq(products.organizationId, organizationId),
        eq(products.isActive, true),
        eq(products.trackInventory, true),
      ),
    );

  const [baseline] = await db
    .select({ id: inventoryMovements.id })
    .from(inventoryMovements)
    .where(
      and(
        eq(inventoryMovements.organizationId, organizationId),
        eq(inventoryMovements.locationId, locationId),
        eq(inventoryMovements.movementType, "opening_balance"),
      ),
    )
    .limit(1);

  const [period] = await db
    .select({
      id: accountingPeriods.id,
      name: accountingPeriods.name,
      status: accountingPeriods.status,
      startsOn: accountingPeriods.startsOn,
      endsOn: accountingPeriods.endsOn,
    })
    .from(accountingPeriods)
    .where(
      and(
        eq(accountingPeriods.organizationId, organizationId),
        lte(accountingPeriods.startsOn, today),
        gte(accountingPeriods.endsOn, today),
      ),
    )
    .limit(1);

  const [openCount] = await db
    .select({
      id: inventoryCountSessions.id,
      status: inventoryCountSessions.status,
      countNumber: inventoryCountSessions.countNumber,
      asOf: inventoryCountSessions.asOf,
    })
    .from(inventoryCountSessions)
    .where(
      and(
        eq(inventoryCountSessions.organizationId, organizationId),
        eq(inventoryCountSessions.locationId, locationId),
        sql`${inventoryCountSessions.status} in ('draft', 'in_progress', 'submitted')`,
      ),
    )
    .orderBy(desc(inventoryCountSessions.asOf))
    .limit(1);

  let openCountSnapshot: InventoryControlSnapshot["openCount"] = null;
  if (openCount) {
    const [lineCounts] = await db
      .select({
        totalLines: sql<number>`count(*)`,
        countedLines: sql<number>`count(${inventoryCountLines.countedQuantity})`,
      })
      .from(inventoryCountLines)
      .where(eq(inventoryCountLines.countSessionId, openCount.id));
    openCountSnapshot = {
      ...openCount,
      countedLines: Number(lineCounts?.countedLines ?? 0),
      totalLines: Number(lineCounts?.totalLines ?? 0),
    };
  }

  const [postedCountRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(inventoryCountSessions)
    .where(
      and(
        eq(inventoryCountSessions.organizationId, organizationId),
        eq(inventoryCountSessions.locationId, locationId),
        eq(inventoryCountSessions.status, "posted"),
      ),
    );

  const [latestPostedCount] = await db
    .select({
      id: inventoryCountSessions.id,
      countNumber: inventoryCountSessions.countNumber,
      postedAt: inventoryCountSessions.postedAt,
    })
    .from(inventoryCountSessions)
    .where(
      and(
        eq(inventoryCountSessions.organizationId, organizationId),
        eq(inventoryCountSessions.locationId, locationId),
        eq(inventoryCountSessions.status, "posted"),
      ),
    )
    .orderBy(desc(inventoryCountSessions.postedAt))
    .limit(1);

  let wasteThisPeriod = 0;
  if (period) {
    const [wasteRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(inventoryMovements)
      .where(
        and(
          eq(inventoryMovements.organizationId, organizationId),
          eq(inventoryMovements.locationId, locationId),
          eq(inventoryMovements.movementType, "waste"),
          gte(inventoryMovements.businessDate, period.startsOn),
          lte(inventoryMovements.businessDate, period.endsOn),
        ),
      );
    wasteThisPeriod = Number(wasteRow?.count ?? 0);
  }

  return {
    productCount: Number(productCountRow?.count ?? 0),
    baselinePosted: Boolean(baseline),
    openCount: openCountSnapshot,
    latestPostedCount: latestPostedCount ?? null,
    postedCountCount: Number(postedCountRow?.count ?? 0),
    wasteThisPeriod,
    currentPeriod: period ?? null,
  };
}

export async function getCloseCostingPreview(
  session: ManagerSession,
  options?: { asOf?: string },
) {
  const snapshot = await getInventoryControlSnapshot(session, options);
  const pending = {
    snapshot,
    valuedProducts: 0,
    unvaluedProducts: 0,
    postingValueCents: null as {
      cogs: number;
      waste: number;
      endingInventory: number;
    } | null,
  };

  if (!getServerEnv().DATABASE_URL || !session.organizationId) {
    return { ...pending, status: "awaiting_ledger" as const };
  }
  if (!snapshot.baselinePosted) {
    return { ...pending, status: "awaiting_baseline" as const };
  }
  if (snapshot.postedCountCount < 2 || !snapshot.latestPostedCount) {
    return { ...pending, status: "awaiting_closing_count" as const };
  }
  if (!snapshot.currentPeriod) {
    return { ...pending, status: "awaiting_period" as const };
  }

  const db = getDb();
  const scope = locationScope(session);
  if (!scope) {
    return { ...pending, status: "awaiting_ledger" as const };
  }
  const organizationId = scope.organizationId;
  const locationId = scope.locationId;
  const period = snapshot.currentPeriod;
  const countedLines = await db
    .select({
      productId: inventoryCountLines.productId,
      countedQuantity: inventoryCountLines.countedQuantity,
    })
    .from(inventoryCountLines)
    .where(
      eq(inventoryCountLines.countSessionId, snapshot.latestPostedCount.id),
    );

  const openingRows = await db
    .select({
      productId: inventoryMovements.productId,
      movementType: inventoryMovements.movementType,
      quantity: inventoryMovements.quantity,
      unitCostCents: inventoryMovements.unitCostCents,
      extendedCostCents: inventoryMovements.extendedCostCents,
      id: inventoryMovements.id,
    })
    .from(inventoryMovements)
    .where(
      and(
        eq(inventoryMovements.organizationId, organizationId),
        eq(inventoryMovements.locationId, locationId),
        eq(inventoryMovements.movementType, "opening_balance"),
      ),
    );

  const periodRows = await db
    .select({
      productId: inventoryMovements.productId,
      movementType: inventoryMovements.movementType,
      quantity: inventoryMovements.quantity,
      unitCostCents: inventoryMovements.unitCostCents,
      extendedCostCents: inventoryMovements.extendedCostCents,
      id: inventoryMovements.id,
    })
    .from(inventoryMovements)
    .where(
      and(
        eq(inventoryMovements.organizationId, organizationId),
        eq(inventoryMovements.locationId, locationId),
        gte(inventoryMovements.businessDate, period.startsOn),
        lte(inventoryMovements.businessDate, period.endsOn),
        sql`${inventoryMovements.movementType} in ('goods_receipt', 'waste')`,
      ),
    );

  const countedByProduct = new Map(
    countedLines
      .filter((line) => line.countedQuantity !== null)
      .map((line) => [line.productId, line.countedQuantity as string]),
  );
  const rowsByProduct = new Map<
    string,
    Array<(typeof openingRows)[number]>
  >();
  for (const row of [...openingRows, ...periodRows]) {
    const list = rowsByProduct.get(row.productId) ?? [];
    list.push(row);
    rowsByProduct.set(row.productId, list);
  }

  let valuedProducts = 0;
  let unvaluedProducts = 0;
  let cogs = 0;
  let waste = 0;
  let endingInventory = 0;
  const canViewCost = hasCapability(session.role, "inventory:view-cost");

  for (const [productId, closingQuantity] of countedByProduct) {
    const rows = (rowsByProduct.get(productId) ?? []).map((row) => ({
      movementType: row.movementType,
      quantity: row.quantity,
      unitCostCents: row.unitCostCents,
      extendedCostCents: row.extendedCostCents,
      sourceEventId: row.id,
    }));
    let costing;
    try {
      costing = costingFromPersistedPeriod(rows, closingQuantity);
    } catch {
      unvaluedProducts += 1;
      continue;
    }
    if (!costing) {
      unvaluedProducts += 1;
      continue;
    }
    valuedProducts += 1;
    cogs += costing.postingValueCents.cogs;
    waste += costing.postingValueCents.waste;
    endingInventory += costing.postingValueCents.endingInventory;
  }

  return {
    snapshot,
    status:
      valuedProducts > 0
        ? ("ready_to_value" as const)
        : ("awaiting_costs" as const),
    valuedProducts,
    unvaluedProducts,
    postingValueCents: canViewCost
      ? { cogs, waste, endingInventory }
      : null,
  };
}

export function countPath() {
  return COUNT_SECTION_DEFINITIONS.map((section) => ({
    code: section.code,
    name: section.name,
    detail: section.detail,
    cadence: section.cadence,
  }));
}

export function wasteReasonLabel(sourceSystem: string | null) {
  return parseWasteReason(sourceSystem);
}
