import "server-only";

import { and, asc, desc, eq, inArray, max, sql } from "drizzle-orm";
import {
  COUNT_SECTION_DEFINITIONS,
  businessDateInTimezone,
  countSectionCodeForCategory,
  planCountLineMovement,
} from "@/domain/inventory";
import { getDb } from "@/db/client";
import {
  inventoryCountLines,
  inventoryCountObservations,
  inventoryCountSections,
  inventoryCountSessions,
  inventoryMovements,
  products,
  unitsOfMeasure,
} from "@/db/schema";
import type { ManagerSession } from "@/lib/auth/session";
import { appendAuditEvent } from "@/services/audit/append";
import { requireInventoryLedger, type InventoryLedgerContext } from "./context";
import { InventoryServiceError } from "./errors";
import { hasOpeningBalance, onHandQuantity } from "./on-hand";

async function nextCountNumber(
  context: InventoryLedgerContext,
  asOf: Date,
): Promise<string> {
  const locationTag = context.locationCode
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12) || "STORE";
  const stamp = asOf.toISOString().slice(0, 10).replaceAll("-", "");
  const prefix = `COUNT-${locationTag}-${stamp}-`;
  const [latest] = await context.db
    .select({ countNumber: inventoryCountSessions.countNumber })
    .from(inventoryCountSessions)
    .where(
      and(
        eq(inventoryCountSessions.organizationId, context.organizationId),
        eq(inventoryCountSessions.locationId, context.locationId),
      ),
    )
    .orderBy(desc(inventoryCountSessions.createdAt))
    .limit(20);

  const used = latest?.countNumber.startsWith(prefix)
    ? Number.parseInt(latest.countNumber.slice(-2), 10)
    : 0;
  return `${prefix}${String(Number.isFinite(used) ? used + 1 : 1).padStart(2, "0")}`;
}

export async function startOpeningCount(session: ManagerSession) {
  const context = await requireInventoryLedger(session);

  const [openSession] = await context.db
    .select({ id: inventoryCountSessions.id })
    .from(inventoryCountSessions)
    .where(
      and(
        eq(inventoryCountSessions.organizationId, context.organizationId),
        eq(inventoryCountSessions.locationId, context.locationId),
        inArray(inventoryCountSessions.status, [
          "draft",
          "in_progress",
          "submitted",
        ]),
      ),
    )
    .limit(1);
  if (openSession) {
    throw new InventoryServiceError(
      "Finish or void the open count before starting another.",
      409,
      "COUNT_ALREADY_OPEN",
    );
  }

  const catalog = await context.db
    .select({
      id: products.id,
      name: products.name,
      category: products.category,
      inventoryUomId: products.inventoryUomId,
      defaultUnitCostCents: products.defaultUnitCostCents,
      unitCode: unitsOfMeasure.code,
    })
    .from(products)
    .innerJoin(
      unitsOfMeasure,
      eq(products.inventoryUomId, unitsOfMeasure.id),
    )
    .where(
      and(
        eq(products.organizationId, context.organizationId),
        eq(products.isActive, true),
        eq(products.trackInventory, true),
      ),
    )
    .orderBy(asc(products.category), asc(products.name));

  if (catalog.length === 0) {
    throw new InventoryServiceError(
      "Review staged products into the catalog before opening a count.",
      409,
      "NO_CATALOG_PRODUCTS",
    );
  }

  const baselineExists = await hasOpeningBalance(context);
  const grouped = new Map<
    string,
    Array<(typeof catalog)[number]>
  >();
  for (const product of catalog) {
    const code = countSectionCodeForCategory(product.category);
    const section = grouped.get(code) ?? [];
    section.push(product);
    grouped.set(code, section);
  }

  const asOf = new Date();
  const sessionId = await context.db.transaction(async (transaction) => {
    const [created] = await transaction
      .insert(inventoryCountSessions)
      .values({
        organizationId: context.organizationId,
        locationId: context.locationId,
        countNumber: await nextCountNumber(context, asOf),
        sourceSystem: "manager_count",
        status: "in_progress",
        asOf,
        startedAt: asOf,
        createdByStaffMemberId: context.staffMemberId,
        notes: baselineExists ? "cycle_count" : "opening_baseline",
      })
      .returning({ id: inventoryCountSessions.id });

    let sortOrder = 1;
    let lineNumber = 1;
    for (const definition of COUNT_SECTION_DEFINITIONS) {
      const sectionProducts = grouped.get(definition.code) ?? [];
      if (sectionProducts.length === 0) continue;

      const [createdSection] = await transaction
        .insert(inventoryCountSections)
        .values({
          organizationId: context.organizationId,
          countSessionId: created.id,
          locationId: context.locationId,
          code: definition.code,
          name: definition.name,
          sortOrder,
          assignedToStaffMemberId: context.staffMemberId,
          status: "assigned",
        })
        .returning({ id: inventoryCountSections.id });

      await transaction.insert(inventoryCountLines).values(
        await Promise.all(
          sectionProducts.map(async (product) => {
            const expected = baselineExists
              ? await onHandQuantity(context, { productId: product.id })
              : "0";
            return {
              organizationId: context.organizationId,
              countSessionId: created.id,
              countSectionId: createdSection.id,
              lineNumber: lineNumber++,
              productId: product.id,
              uomId: product.inventoryUomId,
              expectedQuantity: expected,
              unitCostCents: product.defaultUnitCostCents,
            };
          }),
        ),
      );
      sortOrder += 1;
    }

    return created.id;
  });

  await appendAuditEvent({
    organizationId: context.organizationId,
    actorType: "staff",
    actorStaffMemberId: context.staffMemberId,
    actorExternalId: session.userId,
    sourceSystem: "manager_count",
    action: "inventory.count_session_started",
    entityType: "inventory_count_session",
    entityId: sessionId,
    eventData: {
      productCount: catalog.length,
      openingBaseline: !baselineExists,
    },
  });

  return { countSessionId: sessionId, productCount: catalog.length };
}

export async function submitCountSession(
  session: ManagerSession,
  countSessionId: string,
) {
  const context = await requireInventoryLedger(session);
  const [countSession] = await context.db
    .select()
    .from(inventoryCountSessions)
    .where(
      and(
        eq(inventoryCountSessions.id, countSessionId),
        eq(inventoryCountSessions.organizationId, context.organizationId),
        eq(inventoryCountSessions.locationId, context.locationId),
      ),
    )
    .limit(1);

  if (!countSession || !["draft", "in_progress"].includes(countSession.status)) {
    throw new InventoryServiceError(
      "Only an open count can be submitted.",
      409,
      "COUNT_NOT_OPEN",
    );
  }

  const [uncounted] = await context.db
    .select({ id: inventoryCountLines.id })
    .from(inventoryCountLines)
    .where(
      and(
        eq(inventoryCountLines.countSessionId, countSessionId),
        sql`${inventoryCountLines.countedQuantity} is null`,
      ),
    )
    .limit(1);
  if (uncounted) {
    throw new InventoryServiceError(
      "Every count line needs an observation before submission.",
      409,
      "COUNT_INCOMPLETE",
    );
  }

  const submittedAt = new Date();
  await context.db
    .update(inventoryCountSessions)
    .set({
      status: "submitted",
      submittedAt,
      updatedAt: submittedAt,
    })
    .where(eq(inventoryCountSessions.id, countSessionId));

  await context.db
    .update(inventoryCountSections)
    .set({
      status: "submitted",
      submittedAt,
      updatedAt: submittedAt,
    })
    .where(eq(inventoryCountSections.countSessionId, countSessionId));

  await appendAuditEvent({
    organizationId: context.organizationId,
    actorType: "staff",
    actorStaffMemberId: context.staffMemberId,
    actorExternalId: session.userId,
    sourceSystem: "manager_count",
    action: "inventory.count_session_submitted",
    entityType: "inventory_count_session",
    entityId: countSessionId,
    eventData: { submittedAt: submittedAt.toISOString() },
  });

  return { countSessionId, status: "submitted" as const };
}

export async function approveCountSession(
  session: ManagerSession,
  countSessionId: string,
) {
  const context = await requireInventoryLedger(session);
  const [countSession] = await context.db
    .select()
    .from(inventoryCountSessions)
    .where(
      and(
        eq(inventoryCountSessions.id, countSessionId),
        eq(inventoryCountSessions.organizationId, context.organizationId),
        eq(inventoryCountSessions.locationId, context.locationId),
      ),
    )
    .limit(1);

  if (!countSession || countSession.status !== "submitted") {
    throw new InventoryServiceError(
      "Approve a submitted count after every section is complete.",
      409,
      "COUNT_NOT_SUBMITTED",
    );
  }

  const unresolved = await context.db
    .select({ id: inventoryCountObservations.id })
    .from(inventoryCountObservations)
    .where(
      and(
        eq(inventoryCountObservations.countSessionId, countSessionId),
        eq(inventoryCountObservations.status, "conflict"),
      ),
    )
    .limit(1);
  if (unresolved.length > 0) {
    throw new InventoryServiceError(
      "Resolve observation conflicts before posting the count.",
      409,
      "COUNT_HAS_CONFLICTS",
    );
  }

  const lines = await context.db
    .select({
      id: inventoryCountLines.id,
      productId: inventoryCountLines.productId,
      uomId: inventoryCountLines.uomId,
      countedQuantity: inventoryCountLines.countedQuantity,
      expectedQuantity: inventoryCountLines.expectedQuantity,
      unitCostCents: inventoryCountLines.unitCostCents,
    })
    .from(inventoryCountLines)
    .where(eq(inventoryCountLines.countSessionId, countSessionId))
    .orderBy(asc(inventoryCountLines.lineNumber));

  const postedAt = new Date();
  const movementIds: string[] = [];

  await context.db.transaction(async (transaction) => {
    for (const line of lines) {
      if (line.countedQuantity === null) {
        throw new InventoryServiceError(
          "Every count line needs an observation before posting.",
          409,
          "COUNT_INCOMPLETE",
        );
      }

      const productHasBaseline = await hasOpeningBalance(
        context,
        line.productId,
      );
      const plan = planCountLineMovement({
        countLineId: line.id,
        productId: line.productId,
        uomId: line.uomId,
        countedQuantity: line.countedQuantity,
        expectedQuantity: line.expectedQuantity ?? "0",
        hasOpeningBalance: productHasBaseline,
      });
      if (plan.skip) continue;

      const [movement] = await transaction
        .insert(inventoryMovements)
        .values({
          organizationId: context.organizationId,
          locationId: context.locationId,
          productId: line.productId,
          uomId: line.uomId,
          movementType: plan.movementType,
          quantity: plan.quantity,
          unitCostCents: line.unitCostCents,
          occurredAt: countSession.asOf,
          businessDate: businessDateInTimezone(
            countSession.asOf,
            context.timezone,
          ),
          sourceSystem: "manager_count",
          externalId: `${line.id}:${plan.movementType}`,
          inventoryCountLineId:
            plan.movementType === "count_adjustment" ? line.id : null,
          createdByStaffMemberId: context.staffMemberId,
        })
        .returning({ id: inventoryMovements.id });
      movementIds.push(movement.id);
    }

    await transaction
      .update(inventoryCountSessions)
      .set({
        status: "posted",
        postedAt,
        approvedByStaffMemberId: context.staffMemberId,
        updatedAt: postedAt,
      })
      .where(eq(inventoryCountSessions.id, countSessionId));
  });

  await appendAuditEvent({
    organizationId: context.organizationId,
    actorType: "staff",
    actorStaffMemberId: context.staffMemberId,
    actorExternalId: session.userId,
    sourceSystem: "manager_count",
    action: "inventory.count_session_posted",
    entityType: "inventory_count_session",
    entityId: countSessionId,
    eventData: {
      movementCount: movementIds.length,
      lineCount: lines.length,
    },
  });

  return {
    countSessionId,
    status: "posted" as const,
    movementCount: movementIds.length,
  };
}

export async function addProductToOpenCountSheets(input: {
  organizationId: string;
  productId: string;
  inventoryUomId: string;
  category: string | null;
  staffMemberId: string | null;
  defaultUnitCostCents: string | null;
}): Promise<number> {
  const db = getDb();
  const openSessions = await db
    .select({
      id: inventoryCountSessions.id,
      locationId: inventoryCountSessions.locationId,
    })
    .from(inventoryCountSessions)
    .where(
      and(
        eq(inventoryCountSessions.organizationId, input.organizationId),
        inArray(inventoryCountSessions.status, ["draft", "in_progress"]),
      ),
    );

  let updated = 0;
  const sectionCode = countSectionCodeForCategory(input.category);
  const sectionDefinition =
    COUNT_SECTION_DEFINITIONS.find((section) => section.code === sectionCode) ??
    COUNT_SECTION_DEFINITIONS.find((section) => section.code === "dry") ??
    COUNT_SECTION_DEFINITIONS[0];

  for (const session of openSessions) {
    const [existing] = await db
      .select({ id: inventoryCountLines.id })
      .from(inventoryCountLines)
      .where(
        and(
          eq(inventoryCountLines.countSessionId, session.id),
          eq(inventoryCountLines.productId, input.productId),
          eq(inventoryCountLines.uomId, input.inventoryUomId),
        ),
      )
      .limit(1);
    if (existing) continue;

    let [section] = await db
      .select({
        id: inventoryCountSections.id,
        sortOrder: inventoryCountSections.sortOrder,
      })
      .from(inventoryCountSections)
      .where(
        and(
          eq(inventoryCountSections.countSessionId, session.id),
          eq(inventoryCountSections.code, sectionDefinition.code),
        ),
      )
      .limit(1);

    if (!section) {
      const [maxOrder] = await db
        .select({ value: max(inventoryCountSections.sortOrder) })
        .from(inventoryCountSections)
        .where(eq(inventoryCountSections.countSessionId, session.id));
      const [createdSection] = await db
        .insert(inventoryCountSections)
        .values({
          organizationId: input.organizationId,
          countSessionId: session.id,
          locationId: session.locationId,
          code: sectionDefinition.code,
          name: sectionDefinition.name,
          sortOrder: (maxOrder?.value ?? 0) + 1,
          assignedToStaffMemberId: input.staffMemberId,
          status: "assigned",
        })
        .returning({
          id: inventoryCountSections.id,
          sortOrder: inventoryCountSections.sortOrder,
        });
      section = createdSection;
    }

    const [opening] = await db
      .select({ id: inventoryMovements.id })
      .from(inventoryMovements)
      .where(
        and(
          eq(inventoryMovements.organizationId, input.organizationId),
          eq(inventoryMovements.locationId, session.locationId),
          eq(inventoryMovements.productId, input.productId),
          eq(inventoryMovements.movementType, "opening_balance"),
        ),
      )
      .limit(1);

    const [onHand] = opening
      ? await db
          .select({
            quantity: sql<string>`coalesce(sum(${inventoryMovements.quantity}), 0)`,
          })
          .from(inventoryMovements)
          .where(
            and(
              eq(inventoryMovements.organizationId, input.organizationId),
              eq(inventoryMovements.locationId, session.locationId),
              eq(inventoryMovements.productId, input.productId),
            ),
          )
      : [{ quantity: "0" }];

    const [maxLine] = await db
      .select({ value: max(inventoryCountLines.lineNumber) })
      .from(inventoryCountLines)
      .where(eq(inventoryCountLines.countSessionId, session.id));

    await db.insert(inventoryCountLines).values({
      organizationId: input.organizationId,
      countSessionId: session.id,
      countSectionId: section.id,
      lineNumber: (maxLine?.value ?? 0) + 1,
      productId: input.productId,
      uomId: input.inventoryUomId,
      expectedQuantity: onHand?.quantity ?? "0",
      unitCostCents: input.defaultUnitCostCents,
    });
    updated += 1;
  }

  return updated;
}
