import "server-only";

import { and, asc, eq, gte, isNull, lte, or } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";
import { z } from "zod";
import { getDb } from "@/db/client";
import {
  locations,
  staffMembers,
  staffRoleAssignments,
  staffRoles,
} from "@/db/schema";
import { getServerEnv } from "@/lib/env";
import {
  ACTIVE_LOCATION_COOKIE,
  asCafeAddress,
  pickActiveLocationId,
  type ManagerLocation,
} from "@/lib/location";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  hasCapability,
  managerRoles,
  type Capability,
  type ManagerRole,
} from "./capabilities";

const roleSchema = z.enum(managerRoles);

async function requestedLocationId(): Promise<string | undefined> {
  try {
    const jar = await cookies();
    return jar.get(ACTIVE_LOCATION_COOKIE)?.value;
  } catch {
    return undefined;
  }
}

async function loadActiveLocations(organizationId: string): Promise<ManagerLocation[]> {
  const rows = await getDb()
    .select({
      id: locations.id,
      code: locations.code,
      name: locations.name,
      timezone: locations.timezone,
      address: locations.address,
    })
    .from(locations)
    .where(
      and(
        eq(locations.organizationId, organizationId),
        eq(locations.isActive, true),
      ),
    )
    .orderBy(asc(locations.createdAt), asc(locations.name));

  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    timezone: row.timezone,
    address: asCafeAddress(row.address),
  }));
}

async function withActiveLocation(
  session: Omit<
    ManagerSession,
    "locationIds" | "locations" | "activeLocationId"
  >,
  allowed: ManagerLocation[],
): Promise<ManagerSession> {
  const locationIds = allowed.map((location) => location.id);
  return {
    ...session,
    locationIds,
    locations: allowed,
    activeLocationId: pickActiveLocationId(
      locationIds,
      await requestedLocationId(),
    ),
  };
}

export interface ManagerSession {
  userId: string;
  staffMemberId: string | null;
  email: string;
  displayName: string;
  role: ManagerRole;
  organizationId: string | null;
  locationIds: string[];
  locations: ManagerLocation[];
  activeLocationId: string | null;
  isDemo: boolean;
}

export class ManagerAuthError extends Error {
  constructor(
    message: string,
    public readonly status: 401 | 403,
  ) {
    super(message);
    this.name = "ManagerAuthError";
  }
}

export const getManagerSession = cache(
  async (): Promise<ManagerSession | null> => {
    const env = getServerEnv();

    if (env.MANAGER_DEMO_MODE && env.NODE_ENV !== "production") {
      if (env.DATABASE_URL) {
        const db = getDb();
        const [owner] = await db
          .select({
            id: staffMembers.id,
            organizationId: staffMembers.organizationId,
            email: staffMembers.email,
            displayName: staffMembers.displayName,
            authUserId: staffMembers.authUserId,
          })
          .from(staffMembers)
          .innerJoin(
            staffRoleAssignments,
            eq(staffRoleAssignments.staffMemberId, staffMembers.id),
          )
          .innerJoin(
            staffRoles,
            eq(staffRoleAssignments.staffRoleId, staffRoles.id),
          )
          .where(
            and(
              eq(staffMembers.status, "active"),
              eq(staffRoles.key, "owner"),
              isNull(staffRoleAssignments.revokedAt),
            ),
          )
          .limit(1);

        if (owner) {
          return withActiveLocation(
            {
              userId:
                owner.authUserId ?? "00000000-0000-4000-8000-000000000001",
              staffMemberId: owner.id,
              email: owner.email,
              displayName: owner.displayName,
              role: "owner",
              organizationId: owner.organizationId,
              isDemo: true,
            },
            await loadActiveLocations(owner.organizationId),
          );
        }
      }

      return {
        userId: "00000000-0000-4000-8000-000000000001",
        staffMemberId: null,
        email: "owner@demo.local",
        displayName: "Owner preview",
        role: "owner",
        organizationId: null,
        locationIds: [],
        locations: [],
        activeLocationId: null,
        isDemo: true,
      };
    }

    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return null;
    }

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user?.email) {
      return null;
    }

    const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (
      env.NODE_ENV === "production" &&
      assurance.data?.nextLevel === "aal2" &&
      assurance.data.currentLevel !== "aal2"
    ) {
      return null;
    }

    if (env.DATABASE_URL) {
      const db = getDb();
      const [staff] = await db
        .select({
          id: staffMembers.id,
          organizationId: staffMembers.organizationId,
          displayName: staffMembers.displayName,
        })
        .from(staffMembers)
        .where(
          and(
            eq(staffMembers.authUserId, user.id),
            eq(staffMembers.status, "active"),
          ),
        )
        .limit(1);

      if (!staff) return null;

      const today = new Date().toISOString().slice(0, 10);
      const assignments = await db
        .select({
          roleKey: staffRoles.key,
          roleScope: staffRoles.scope,
          locationId: staffRoleAssignments.locationId,
        })
        .from(staffRoleAssignments)
        .innerJoin(
          staffRoles,
          eq(staffRoleAssignments.staffRoleId, staffRoles.id),
        )
        .where(
          and(
            eq(staffRoleAssignments.staffMemberId, staff.id),
            eq(staffRoleAssignments.organizationId, staff.organizationId),
            isNull(staffRoleAssignments.revokedAt),
            lte(staffRoleAssignments.effectiveFrom, today),
            or(
              isNull(staffRoleAssignments.effectiveTo),
              gte(staffRoleAssignments.effectiveTo, today),
            ),
          ),
        );

      const rolePrecedence: ManagerRole[] = [
        "owner",
        "manager",
        "purchaser",
        "inventory_counter",
        "accountant",
      ];
      const role = rolePrecedence.find((candidate) =>
        assignments.some(
          (assignment) =>
            roleSchema.safeParse(assignment.roleKey).data === candidate,
        ),
      );
      if (!role) return null;

      const hasOrganizationScope = assignments.some(
        (assignment) =>
          assignment.roleKey === role &&
          assignment.roleScope === "organization",
      );
      const allowedLocations = hasOrganizationScope
        ? await loadActiveLocations(staff.organizationId)
        : (
            await loadActiveLocations(staff.organizationId)
          ).filter((location) =>
            assignments.some(
              (assignment) =>
                assignment.roleKey === role &&
                assignment.locationId === location.id,
            ),
          );

      return withActiveLocation(
        {
          userId: user.id,
          staffMemberId: staff.id,
          email: user.email,
          displayName: staff.displayName,
          role,
          organizationId: staff.organizationId,
          isDemo: false,
        },
        allowedLocations,
      );
    }

    if (env.NODE_ENV === "production") return null;

    const parsedRole = roleSchema.safeParse(user.app_metadata.manager_role);
    if (!parsedRole.success) return null;
    const locationIds = z.array(z.string().uuid()).catch([]).parse(
      user.app_metadata.location_ids,
    );

    return {
      userId: user.id,
      staffMemberId: null,
      email: user.email,
      displayName:
        user.user_metadata.full_name ??
        user.user_metadata.name ??
        user.email.split("@")[0],
      role: parsedRole.data,
      organizationId:
        z.string().uuid().safeParse(user.app_metadata.organization_id).data ??
        null,
      locationIds,
      locations: [],
      activeLocationId: pickActiveLocationId(
        locationIds,
        await requestedLocationId(),
      ),
      isDemo: false,
    };
  },
);

export async function requireManagerSession(): Promise<ManagerSession> {
  const session = await getManagerSession();
  if (!session) {
    throw new ManagerAuthError("Manager authentication is required.", 401);
  }

  return session;
}

export async function requireCapability(
  capability: Capability,
): Promise<ManagerSession> {
  const session = await requireManagerSession();

  if (!hasCapability(session.role, capability)) {
    throw new ManagerAuthError(
      `The ${session.role} role cannot perform ${capability}.`,
      403,
    );
  }

  return session;
}
