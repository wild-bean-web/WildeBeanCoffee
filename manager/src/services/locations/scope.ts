import "server-only";

import type { ManagerSession } from "@/lib/auth/session";
import { LocationScopeError } from "./errors";

export function locationScope(
  session: ManagerSession,
): { organizationId: string; locationId: string } | null {
  if (!session.organizationId || !session.activeLocationId) return null;
  if (!session.locationIds.includes(session.activeLocationId)) return null;
  return {
    organizationId: session.organizationId,
    locationId: session.activeLocationId,
  };
}

export function requireLocationScope(session: ManagerSession): {
  organizationId: string;
  locationId: string;
} {
  const scope = locationScope(session);
  if (!scope) {
    throw new LocationScopeError(
      "Choose a location before recording or reviewing operations.",
    );
  }
  return scope;
}

export function activeLocationName(session: ManagerSession): string | null {
  return (
    session.locations.find((location) => location.id === session.activeLocationId)
      ?.name ?? null
  );
}
