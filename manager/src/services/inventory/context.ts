import "server-only";

import { getDb, type ManagerDatabase } from "@/db/client";
import type { ManagerSession } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/env";
import { requireLocationScope } from "@/services/locations/scope";
import { InventoryServiceError } from "./errors";

const DEMO_ORGANIZATION_ID = "00000000-0000-4000-8000-000000000010";

export interface InventoryLedgerContext {
  organizationId: string;
  staffMemberId: string;
  locationId: string;
  locationCode: string;
  timezone: string;
  db: ManagerDatabase;
}

export function requireOrganizationId(session: ManagerSession): string {
  const organizationId =
    session.organizationId ??
    (session.isDemo ? DEMO_ORGANIZATION_ID : null);
  if (!organizationId) {
    throw new InventoryServiceError(
      "The manager account is not assigned to an organization.",
      400,
      "ORGANIZATION_REQUIRED",
    );
  }
  return organizationId;
}

export async function requireInventoryLedger(
  session: ManagerSession,
): Promise<InventoryLedgerContext> {
  const env = getServerEnv();
  const { organizationId, locationId } = requireLocationScope(session);

  if (!env.DATABASE_URL) {
    throw new InventoryServiceError(
      "The inventory ledger is not configured.",
      503,
      "INVENTORY_LEDGER_NOT_CONFIGURED",
    );
  }
  if (!session.staffMemberId) {
    throw new InventoryServiceError(
      "The manager account is not linked to an active staff record.",
      400,
      "STAFF_REQUIRED",
    );
  }

  const location = session.locations.find((item) => item.id === locationId);
  if (!location) {
    throw new InventoryServiceError(
      "Create an active location before recording inventory.",
      400,
      "LOCATION_REQUIRED",
    );
  }

  return {
    organizationId,
    staffMemberId: session.staffMemberId,
    locationId,
    locationCode: location.code,
    timezone: location.timezone,
    db: getDb(),
  };
}
