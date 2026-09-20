import { and, asc, eq, inArray, or } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  inventoryCountLines,
  inventoryCountSections,
  inventoryCountSessions,
  products,
  unitsOfMeasure,
} from "@/db/schema";
import { requireCapability } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/env";
import { dataResponse, errorResponse, routeErrorResponse } from "@/lib/http";
import { locationScope } from "@/services/locations/scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireCapability("inventory:count");
    const env = getServerEnv();
    const scope = locationScope(session);
    if (!env.DATABASE_URL || !scope || !session.staffMemberId) {
      return errorResponse(
        503,
        "COUNT_LEDGER_NOT_CONFIGURED",
        "The inventory count ledger is not configured.",
      );
    }

    const elevated = session.role === "owner" || session.role === "manager";
    const assignmentFilter = elevated
      ? eq(inventoryCountSections.organizationId, scope.organizationId)
      : and(
          eq(inventoryCountSections.organizationId, scope.organizationId),
          eq(
            inventoryCountSections.assignedToStaffMemberId,
            session.staffMemberId,
          ),
        );

    const sections = await getDb()
      .select({
        id: inventoryCountSections.id,
        sessionId: inventoryCountSections.countSessionId,
        name: inventoryCountSections.name,
        status: inventoryCountSections.status,
        sortOrder: inventoryCountSections.sortOrder,
        asOf: inventoryCountSessions.asOf,
        sessionStatus: inventoryCountSessions.status,
      })
      .from(inventoryCountSections)
      .innerJoin(
        inventoryCountSessions,
        eq(
          inventoryCountSections.countSessionId,
          inventoryCountSessions.id,
        ),
      )
      .where(
        and(
          assignmentFilter,
          eq(inventoryCountSessions.locationId, scope.locationId),
          inArray(inventoryCountSections.status, [
            "assigned",
            "in_progress",
          ]),
          or(
            eq(inventoryCountSessions.status, "draft"),
            eq(inventoryCountSessions.status, "in_progress"),
          ),
        ),
      )
      .orderBy(
        asc(inventoryCountSessions.asOf),
        asc(inventoryCountSections.sortOrder),
      );

    const assignments = await Promise.all(
      sections.map(async (section) => {
        const lines = await getDb()
          .select({
            id: inventoryCountLines.id,
            productId: inventoryCountLines.productId,
            productName: products.name,
            productSku: products.sku,
            uomId: inventoryCountLines.uomId,
            unitName: unitsOfMeasure.name,
            unitSymbol: unitsOfMeasure.symbol,
            lineNumber: inventoryCountLines.lineNumber,
          })
          .from(inventoryCountLines)
          .innerJoin(
            products,
            eq(inventoryCountLines.productId, products.id),
          )
          .innerJoin(
            unitsOfMeasure,
            eq(inventoryCountLines.uomId, unitsOfMeasure.id),
          )
          .where(eq(inventoryCountLines.countSectionId, section.id))
          .orderBy(asc(inventoryCountLines.lineNumber));

        return { ...section, lines };
      }),
    );

    return dataResponse({ assignments });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
