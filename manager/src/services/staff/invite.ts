import "server-only";

import { createClient } from "@supabase/supabase-js";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { staffMembers, staffRoleAssignments, staffRoles } from "@/db/schema";
import { capabilitiesFor } from "@/lib/auth/capabilities";
import type { StaffInvite } from "@/domain/companies";
import { getServerEnv } from "@/lib/env";

function adminAuth() {
  const env = getServerEnv();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function listCompanyPeople(organizationId: string) {
  const rows = await getDb()
    .select({
      id: staffMembers.id,
      email: staffMembers.email,
      displayName: staffMembers.displayName,
      status: staffMembers.status,
      role: staffRoles.key,
    })
    .from(staffMembers)
    .innerJoin(
      staffRoleAssignments,
      eq(staffRoleAssignments.staffMemberId, staffMembers.id),
    )
    .innerJoin(staffRoles, eq(staffRoles.id, staffRoleAssignments.staffRoleId))
    .where(eq(staffMembers.organizationId, organizationId));
  const people = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (!people.has(row.id)) people.set(row.id, row);
  }
  return [...people.values()];
}

export async function inviteStaffMember(input: {
  organizationId: string;
  invitedByStaffMemberId: string | null;
  invite: StaffInvite;
}): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const env = getServerEnv();
  const admin = adminAuth();
  if (!admin) return { ok: false, message: "Invites are not configured yet." };

  const db = getDb();
  const email = input.invite.email.toLowerCase();
  const [existing] = await db
    .select({ id: staffMembers.id })
    .from(staffMembers)
    .where(
      and(
        eq(staffMembers.organizationId, input.organizationId),
        sql`lower(${staffMembers.email}) = ${email}`,
      ),
    )
    .limit(1);
  if (existing) {
    return { ok: false, message: "That person is already on this company." };
  }

  const [role] = await db
    .select({ id: staffRoles.id })
    .from(staffRoles)
    .where(
      and(
        eq(staffRoles.organizationId, input.organizationId),
        eq(staffRoles.key, input.invite.role),
      ),
    )
    .limit(1);

  let roleId = role?.id;
  if (!roleId) {
    const [created] = await db
      .insert(staffRoles)
      .values({
        organizationId: input.organizationId,
        key: input.invite.role,
        name: input.invite.role,
        scope: "organization",
        permissions: [...capabilitiesFor(input.invite.role)],
        isSystem: true,
      })
      .returning({ id: staffRoles.id });
    roleId = created.id;
  }

  const invited = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${env.MANAGER_APP_URL}/login`,
  });
  const inviteError = invited.error?.message.toLowerCase() ?? "";
  const alreadyRegistered =
    inviteError.includes("already") || inviteError.includes("registered");
  if (invited.error && !alreadyRegistered) {
    return { ok: false, message: "The invite email could not be sent." };
  }

  const [staff] = await db
    .insert(staffMembers)
    .values({
      organizationId: input.organizationId,
      email,
      displayName: input.invite.displayName,
      status: "invited",
    })
    .returning({ id: staffMembers.id });
  await db.insert(staffRoleAssignments).values({
    organizationId: input.organizationId,
    staffMemberId: staff.id,
    staffRoleId: roleId,
    assignedByStaffMemberId: input.invitedByStaffMemberId,
  });

  return {
    ok: true,
    message: alreadyRegistered
      ? "They already have a login. Ask them to sign in to open this company."
      : "Invite sent. They choose a password from the email, then sign in.",
  };
}
