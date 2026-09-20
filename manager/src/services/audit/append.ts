import "server-only";

import { desc, eq, sql } from "drizzle-orm";
import { sha256Hex } from "@/domain/shared";
import { getDb } from "@/db/client";
import { auditEvents } from "@/db/schema";
import type { JsonObject } from "@/db/schema/shared";

export interface AppendAuditEventInput {
  organizationId: string;
  actorType: "staff" | "system" | "integration";
  actorStaffMemberId?: string;
  actorExternalId?: string;
  sourceSystem: string;
  action: string;
  entityType: string;
  entityId?: string;
  entityExternalId?: string;
  requestId?: string;
  correlationId?: string;
  eventData: JsonObject;
  occurredAt?: Date;
}

function canonicalJson(value: unknown): string {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Audit event data cannot contain non-finite numbers.");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (typeof value !== "object" || value === undefined) {
    throw new Error("Audit event data must be JSON serializable.");
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(value)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${canonicalJson(record[key])}`,
    )
    .join(",")}}`;
}

export async function appendAuditEvent(input: AppendAuditEventInput) {
  if (input.actorType === "staff" && !input.actorStaffMemberId) {
    throw new Error("Staff audit events require a staff member ID.");
  }
  if (!input.entityId && !input.entityExternalId) {
    throw new Error("Audit events require an entity identity.");
  }

  return getDb().transaction(async (transaction) => {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${input.organizationId}, 0))`,
    );
    const [previous] = await transaction
      .select({
        id: auditEvents.id,
        eventHash: auditEvents.eventHash,
      })
      .from(auditEvents)
      .where(eq(auditEvents.organizationId, input.organizationId))
      .orderBy(desc(auditEvents.sequence))
      .limit(1);

    const occurredAt = input.occurredAt ?? new Date();
    const eventHash = sha256Hex(
      canonicalJson({
        organizationId: input.organizationId,
        previousEventHash: previous?.eventHash ?? null,
        occurredAt: occurredAt.toISOString(),
        actorType: input.actorType,
        actorStaffMemberId: input.actorStaffMemberId ?? null,
        actorExternalId: input.actorExternalId ?? null,
        sourceSystem: input.sourceSystem,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        entityExternalId: input.entityExternalId ?? null,
        requestId: input.requestId ?? null,
        correlationId: input.correlationId ?? null,
        eventData: input.eventData,
      }),
    );

    const [created] = await transaction
      .insert(auditEvents)
      .values({
        organizationId: input.organizationId,
        occurredAt,
        recordedAt: occurredAt,
        actorType: input.actorType,
        actorStaffMemberId:
          input.actorType === "staff" ? input.actorStaffMemberId : undefined,
        actorExternalId: input.actorExternalId,
        sourceSystem: input.sourceSystem,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        entityExternalId: input.entityExternalId,
        requestId: input.requestId,
        correlationId: input.correlationId,
        previousAuditEventId: previous?.id,
        previousEventHash: previous?.eventHash,
        eventHash,
        eventData: input.eventData,
      })
      .returning();
    return created;
  });
}
