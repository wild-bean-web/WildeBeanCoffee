import Decimal from "decimal.js";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { NonNegativeDecimalStringSchema } from "@/domain/inventory";
import { getDb } from "@/db/client";
import {
  inventoryCountLines,
  inventoryCountObservations,
  inventoryCountSections,
  inventoryCountSessions,
} from "@/db/schema";
import { requireCapability } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/env";
import { dataResponse, errorResponse, routeErrorResponse } from "@/lib/http";
import { appendAuditEvent } from "@/services/audit/append";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const observationSchema = z
  .object({
    clientObservationId: z.string().uuid(),
    deviceId: z.string().uuid(),
    sequenceNumber: z.number().int().positive(),
    countSessionId: z.string().uuid(),
    countSectionId: z.string().uuid(),
    countLineId: z.string().uuid(),
    countedQuantity: NonNegativeDecimalStringSchema,
    uomId: z.string().uuid(),
    observedAt: z.iso.datetime({ offset: true }),
    supersedesObservationId: z.string().uuid().optional(),
  })
  .strict();

const requestSchema = z.object({
  observations: z.array(observationSchema).min(1).max(100),
});

export async function POST(request: Request) {
  try {
    const session = await requireCapability("inventory:count");
    const env = getServerEnv();
    if (!env.DATABASE_URL || !session.organizationId || !session.staffMemberId) {
      return errorResponse(
        503,
        "COUNT_LEDGER_NOT_CONFIGURED",
        "The inventory count ledger is not configured.",
      );
    }

    const input = requestSchema.parse(await request.json());
    const db = getDb();
    const results = [];

    for (const observation of input.observations) {
      const [line] = await db
        .select({
          id: inventoryCountLines.id,
          organizationId: inventoryCountLines.organizationId,
          countSessionId: inventoryCountLines.countSessionId,
          countSectionId: inventoryCountLines.countSectionId,
          uomId: inventoryCountLines.uomId,
          expectedQuantity: inventoryCountLines.expectedQuantity,
          sessionStatus: inventoryCountSessions.status,
          assignedToStaffMemberId:
            inventoryCountSections.assignedToStaffMemberId,
          sectionStatus: inventoryCountSections.status,
        })
        .from(inventoryCountLines)
        .innerJoin(
          inventoryCountSessions,
          eq(
            inventoryCountLines.countSessionId,
            inventoryCountSessions.id,
          ),
        )
        .leftJoin(
          inventoryCountSections,
          eq(
            inventoryCountLines.countSectionId,
            inventoryCountSections.id,
          ),
        )
        .where(eq(inventoryCountLines.id, observation.countLineId))
        .limit(1);

      if (
        !line ||
        line.organizationId !== session.organizationId ||
        line.countSessionId !== observation.countSessionId ||
        line.countSectionId !== observation.countSectionId ||
        line.uomId !== observation.uomId
      ) {
        results.push({
          clientObservationId: observation.clientObservationId,
          status: "rejected",
          reason: "count_assignment_mismatch",
        });
        continue;
      }
      if (!["draft", "in_progress"].includes(line.sessionStatus)) {
        results.push({
          clientObservationId: observation.clientObservationId,
          status: "rejected",
          reason: "count_session_not_open",
        });
        continue;
      }
      if (
        line.assignedToStaffMemberId &&
        line.assignedToStaffMemberId !== session.staffMemberId &&
        session.role !== "owner" &&
        session.role !== "manager"
      ) {
        results.push({
          clientObservationId: observation.clientObservationId,
          status: "rejected",
          reason: "count_section_not_assigned",
        });
        continue;
      }

      const [existing] = await db
        .select()
        .from(inventoryCountObservations)
        .where(
          and(
            eq(
              inventoryCountObservations.organizationId,
              session.organizationId,
            ),
            eq(
              inventoryCountObservations.clientObservationId,
              observation.clientObservationId,
            ),
          ),
        )
        .limit(1);
      if (existing) {
        const same =
          existing.countLineId === observation.countLineId &&
          new Decimal(existing.countedQuantity).eq(
            observation.countedQuantity,
          ) &&
          existing.uomId === observation.uomId;
        results.push({
          clientObservationId: observation.clientObservationId,
          status: same ? "duplicate" : "conflict",
          reason: same ? null : "client_observation_id_reused",
        });
        continue;
      }

      const [latest] = await db
        .select({
          id: inventoryCountObservations.id,
          countedQuantity: inventoryCountObservations.countedQuantity,
        })
        .from(inventoryCountObservations)
        .where(
          and(
            eq(
              inventoryCountObservations.countLineId,
              observation.countLineId,
            ),
            eq(inventoryCountObservations.status, "accepted"),
          ),
        )
        .orderBy(desc(inventoryCountObservations.observedAt))
        .limit(1);
      const expectedSuperseded = observation.supersedesObservationId ?? null;
      const isConflict =
        Boolean(latest) &&
        latest?.id !== expectedSuperseded &&
        !new Decimal(latest!.countedQuantity).eq(
          observation.countedQuantity,
        );
      const status = isConflict ? "conflict" : "accepted";

      await db.transaction(async (transaction) => {
        await transaction.insert(inventoryCountObservations).values({
          organizationId: session.organizationId!,
          countSessionId: observation.countSessionId,
          countSectionId: observation.countSectionId,
          countLineId: observation.countLineId,
          clientObservationId: observation.clientObservationId,
          deviceId: observation.deviceId,
          sequenceNumber: observation.sequenceNumber,
          countedQuantity: observation.countedQuantity,
          uomId: observation.uomId,
          observedAt: new Date(observation.observedAt),
          observedByStaffMemberId: session.staffMemberId!,
          status,
          supersedesObservationId: observation.supersedesObservationId,
          conflictReason: isConflict
            ? "another_observation_exists_for_line"
            : null,
        });

        if (!isConflict) {
          const variance = line.expectedQuantity === null
            ? null
            : new Decimal(observation.countedQuantity)
                .minus(line.expectedQuantity)
                .toFixed(6);
          await transaction
            .update(inventoryCountLines)
            .set({
              countedQuantity: observation.countedQuantity,
              varianceQuantity: variance,
              countedByStaffMemberId: session.staffMemberId,
              countedAt: new Date(observation.observedAt),
              updatedAt: new Date(),
            })
            .where(eq(inventoryCountLines.id, observation.countLineId));
        }
      });

      results.push({
        clientObservationId: observation.clientObservationId,
        status,
        reason: isConflict ? "another_observation_exists_for_line" : null,
      });
    }

    await appendAuditEvent({
      organizationId: session.organizationId,
      actorType: "staff",
      actorStaffMemberId: session.staffMemberId,
      actorExternalId: session.userId,
      sourceSystem: "manager_offline_count",
      action: "inventory.count_observations_synced",
      entityType: "inventory_count_session",
      entityId: input.observations[0].countSessionId,
      eventData: {
        submitted: input.observations.length,
        accepted: results.filter((result) => result.status === "accepted")
          .length,
        conflicts: results.filter((result) => result.status === "conflict")
          .length,
        rejected: results.filter((result) => result.status === "rejected")
          .length,
      },
    });

    return dataResponse({ results });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
