import "server-only";

import { createClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  locationSubscriptions,
  locations,
  organizations,
  staffMembers,
  staffRoleAssignments,
  staffRoles,
} from "@/db/schema";
import { capabilitiesFor, managerRoles, type ManagerRole } from "@/lib/auth/capabilities";
import { companySlug, type CompanySignup } from "@/domain/companies";
import { getServerEnv } from "@/lib/env";

const roleNames: Record<ManagerRole, string> = {
  owner: "Owner",
  manager: "Manager",
  purchaser: "Purchaser",
  inventory_counter: "Inventory counter",
  accountant: "Accountant",
};

function adminAuth() {
  const env = getServerEnv();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function uniqueSlug(base: string): Promise<string> {
  const db = getDb();
  let slug = base;
  for (let attempt = 1; attempt < 20; attempt += 1) {
    const [existing] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);
    if (!existing) return slug;
    slug = `${base}-${attempt + 1}`.slice(0, 64);
  }
  return `${base}-${Date.now().toString(36)}`.slice(0, 64);
}

export async function createCompanyAccount(
  input: CompanySignup,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const env = getServerEnv();
  if (env.MANAGER_DEMO_MODE) {
    return { ok: false, message: "Company signup is closed in preview mode." };
  }
  const admin = adminAuth();
  if (!admin || !env.DATABASE_URL) {
    return { ok: false, message: "Company signup is not configured yet." };
  }

  const created = await admin.auth.admin.createUser({
    email: input.email.toLowerCase(),
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.ownerName },
  });
  if (created.error || !created.data.user) {
    const message = created.error?.message.toLowerCase() ?? "";
    if (message.includes("already") || message.includes("registered")) {
      return { ok: false, message: "That email already has an account. Sign in instead." };
    }
    return { ok: false, message: "The account could not be created." };
  }

  const userId = created.data.user.id;
  try {
    const slug = await uniqueSlug(companySlug(input.companyName));
    const trialEnds = new Date(Date.now() + 14 * 86_400_000);
    await getDb().transaction(async (tx) => {
      const [organization] = await tx
        .insert(organizations)
        .values({
          slug,
          legalName: input.companyName,
          displayName: input.companyName,
          timezone: input.timezone,
        })
        .returning({ id: organizations.id });
      const [location] = await tx
        .insert(locations)
        .values({
          organizationId: organization.id,
          code: slug.slice(0, 32),
          name: input.locationName,
          timezone: input.timezone,
          isActive: true,
        })
        .returning({ id: locations.id });
      const roleIds = new Map<ManagerRole, string>();
      for (const role of managerRoles) {
        const [row] = await tx
          .insert(staffRoles)
          .values({
            organizationId: organization.id,
            key: role,
            name: roleNames[role],
            scope: "organization",
            permissions: [...capabilitiesFor(role)],
            isSystem: true,
          })
          .returning({ id: staffRoles.id });
        roleIds.set(role, row.id);
      }
      const [staff] = await tx
        .insert(staffMembers)
        .values({
          organizationId: organization.id,
          authUserId: userId,
          email: input.email.toLowerCase(),
          displayName: input.ownerName,
          status: "active",
        })
        .returning({ id: staffMembers.id });
      await tx.insert(staffRoleAssignments).values({
        organizationId: organization.id,
        staffMemberId: staff.id,
        staffRoleId: roleIds.get("owner")!,
      });
      await tx.insert(locationSubscriptions).values({
        organizationId: organization.id,
        locationId: location.id,
        status: "trialing",
        currentPeriodEnd: trialEnds,
      });
    });
    return { ok: true };
  } catch {
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, message: "The company could not be saved. Try again." };
  }
}
