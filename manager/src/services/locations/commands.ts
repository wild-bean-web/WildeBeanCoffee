import "server-only";

import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { locations } from "@/db/schema";
import type { JsonObject } from "@/db/schema/shared";
import type { ManagerSession } from "@/lib/auth/session";
import {
  asCafeAddress,
  locationCodeFromName,
  type CafeAddress,
  type ManagerLocation,
} from "@/lib/location";
import { appendAuditEvent } from "@/services/audit/append";
import { LocationScopeError } from "./errors";

function requireOwner(session: ManagerSession, action: string): void {
  if (session.role !== "owner") {
    throw new LocationScopeError(
      `Only an owner can ${action}.`,
      403,
      "OWNER_REQUIRED",
    );
  }
}

function addressJson(address: CafeAddress | null): JsonObject | null {
  if (!address) return null;
  return Object.fromEntries(
    Object.entries(address).filter(
      ([, value]) => typeof value === "string" && value.trim().length > 0,
    ),
  );
}

export async function createCafeLocation(
  session: ManagerSession,
  input: { name: string; timezone?: string },
): Promise<ManagerLocation> {
  requireOwner(session, "add a location");

  const organizationId = session.organizationId;
  if (!organizationId) {
    throw new LocationScopeError(
      "The manager account is not assigned to an organization.",
    );
  }

  const name = input.name.trim();
  if (!name) {
    throw new LocationScopeError("A location name is required.");
  }

  const timezone = input.timezone?.trim() || "America/New_York";
  let code = locationCodeFromName(name);
  const db = getDb();

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = attempt === 0 ? code : `${code}-${attempt + 1}`;
    const [existing] = await db
      .select({ id: locations.id })
      .from(locations)
      .where(
        and(
          eq(locations.organizationId, organizationId),
          eq(locations.code, candidate),
        ),
      )
      .limit(1);
    if (!existing) {
      code = candidate;
      break;
    }
  }

  const [created] = await db
    .insert(locations)
    .values({
      organizationId,
      code,
      name,
      timezone,
      isActive: true,
    })
    .returning({
      id: locations.id,
      code: locations.code,
      name: locations.name,
      timezone: locations.timezone,
    });

  const createdLocation: ManagerLocation = {
    ...created,
    address: null,
  };

  await appendAuditEvent({
    organizationId,
    actorType: "staff",
    actorStaffMemberId: session.staffMemberId ?? undefined,
    actorExternalId: session.userId,
    sourceSystem: "manager_web",
    action: "location.created",
    entityType: "location",
    entityId: created.id,
    eventData: { code: createdLocation.code, name: createdLocation.name },
  });

  return createdLocation;
}

export async function updateCafeLocation(
  session: ManagerSession,
  locationId: string,
  input: {
    name: string;
    timezone?: string;
    address?: CafeAddress | null;
  },
): Promise<ManagerLocation> {
  requireOwner(session, "update a location");

  const organizationId = session.organizationId;
  if (!organizationId) {
    throw new LocationScopeError(
      "The manager account is not assigned to an organization.",
    );
  }
  if (!session.locationIds.includes(locationId)) {
    throw new LocationScopeError(
      "That location is not available on this account.",
      403,
      "LOCATION_FORBIDDEN",
    );
  }

  const name = input.name.trim();
  if (!name) {
    throw new LocationScopeError("A location name is required.");
  }

  const timezone = input.timezone?.trim() || undefined;
  const address = input.address === undefined ? undefined : addressJson(
    asCafeAddress(input.address),
  );
  const db = getDb();
  const [updated] = await db
    .update(locations)
    .set({
      name,
      ...(timezone ? { timezone } : {}),
      ...(address !== undefined ? { address } : {}),
      updatedAt: new Date(),
    })
    .where(
      and(eq(locations.id, locationId), eq(locations.organizationId, organizationId)),
    )
    .returning({
      id: locations.id,
      code: locations.code,
      name: locations.name,
      timezone: locations.timezone,
      address: locations.address,
    });

  if (!updated) {
    throw new LocationScopeError("The location could not be updated.", 404, "LOCATION_NOT_FOUND");
  }

  const updatedLocation: ManagerLocation = {
    id: updated.id,
    code: updated.code,
    name: updated.name,
    timezone: updated.timezone,
    address: asCafeAddress(updated.address),
  };

  await appendAuditEvent({
    organizationId,
    actorType: "staff",
    actorStaffMemberId: session.staffMemberId ?? undefined,
    actorExternalId: session.userId,
    sourceSystem: "manager_web",
    action: "location.updated",
    entityType: "location",
    entityId: updated.id,
    eventData: {
      code: updatedLocation.code,
      name: updatedLocation.name,
      timezone: updatedLocation.timezone,
    },
  });

  return updatedLocation;
}
