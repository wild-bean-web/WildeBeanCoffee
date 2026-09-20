import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { closeDatabase, getDb } from "../src/db/client";
import {
  accountingPeriods,
  accounts,
  integrationConnections,
  locations,
  organizations,
  staffMembers,
  staffRoleAssignments,
  staffRoles,
  unitsOfMeasure,
} from "../src/db/schema";
import {
  capabilitiesFor,
  managerRoles,
  type ManagerRole,
} from "../src/lib/auth/capabilities";

function emptyToUndefined(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

const seedEnvSchema = z.object({
  MANAGER_BOOTSTRAP_OWNER_EMAIL: z.preprocess(
    emptyToUndefined,
    z.string().email().optional(),
  ),
  MANAGER_BOOTSTRAP_OWNER_NAME: z.preprocess(
    emptyToUndefined,
    z.string().min(1).default("Wild Bean Owner"),
  ),
  MANAGER_BOOTSTRAP_AUTH_USER_ID: z.preprocess(
    emptyToUndefined,
    z.string().uuid().optional(),
  ),
  CLOVER_MANAGER_MERCHANT_ID: z.preprocess(
    emptyToUndefined,
    z.string().min(1).optional(),
  ),
  MANAGER_INVOICE_EMAIL: z.preprocess(
    emptyToUndefined,
    z.string().email().optional(),
  ),
  MANAGER_INVOICE_MAILBOX_HASH: z.preprocess(
    emptyToUndefined,
    z.string().min(1).max(256).optional(),
  ),
});

const roleNames: Record<ManagerRole, string> = {
  owner: "Owner",
  manager: "Manager",
  inventory_counter: "Inventory Counter",
  purchaser: "Purchaser",
  accountant: "Accountant",
};

const unitSeeds = [
  ["each", "Each", "ea", "count", 0, true],
  ["gram", "Gram", "g", "mass", 3, true],
  ["kilogram", "Kilogram", "kg", "mass", 3, false],
  ["ounce_weight", "Ounce (weight)", "oz wt", "mass", 3, false],
  ["pound", "Pound", "lb", "mass", 3, false],
  ["milliliter", "Milliliter", "mL", "volume", 3, true],
  ["liter", "Liter", "L", "volume", 3, false],
  ["fluid_ounce", "Fluid ounce", "fl oz", "volume", 3, false],
  ["gallon", "Gallon", "gal", "volume", 3, false],
] as const;

const accountSeeds = [
  ["1000", "Operating bank", "asset", "debit"],
  ["1100", "Processor clearing", "asset", "debit"],
  ["1200", "Inventory", "asset", "debit"],
  ["1500", "Equipment and fixtures", "asset", "debit"],
  ["2000", "Accounts payable", "liability", "credit"],
  ["2100", "Company credit card", "liability", "credit"],
  ["2200", "Sales tax payable", "liability", "credit"],
  ["2210", "Tips payable", "liability", "credit"],
  ["2300", "Gift cards outstanding", "liability", "credit"],
  ["3000", "Owner equity", "equity", "credit"],
  ["4000", "Store sales", "revenue", "credit"],
  ["4100", "Delivery-platform sales", "revenue", "credit"],
  ["5000", "Cost of goods sold", "expense", "debit"],
  ["5100", "Recorded waste", "expense", "debit"],
  ["6000", "Labor", "expense", "debit"],
  ["6100", "Occupancy and utilities", "expense", "debit"],
  ["6200", "Processor and marketplace fees", "expense", "debit"],
  ["6300", "Operating supplies", "expense", "debit"],
  ["6900", "Other operating expense", "expense", "debit"],
] as const;

function isoDate(year: number, monthIndex: number, day: number): string {
  return new Date(Date.UTC(year, monthIndex, day))
    .toISOString()
    .slice(0, 10);
}

const rockvilleAddress = {
  line1: "1532 Rockville Pike",
  city: "Rockville",
  region: "MD",
  postalCode: "20852",
  phone: "+1 227-280-7062",
} as const;

async function main(): Promise<void> {
  const env = seedEnvSchema.parse(process.env);
  const db = getDb();

  const result = await db.transaction(async (transaction) => {
    let [organization] = await transaction
      .select()
      .from(organizations)
      .where(sql`lower(${organizations.slug}) = 'wild-bean-coffee'`)
      .limit(1);
    if (!organization) {
      [organization] = await transaction
        .insert(organizations)
        .values({
          slug: "wild-bean-coffee",
          legalName: "Wild Bean Coffee",
          displayName: "Wild Bean Coffee",
          baseCurrency: "USD",
          timezone: "America/New_York",
        })
        .returning();
    }

    await transaction
      .update(locations)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(locations.organizationId, organization.id),
          eq(locations.code, "second-cafe"),
        ),
      );

    const existingLocations = await transaction
      .select({ id: locations.id, code: locations.code })
      .from(locations)
      .where(eq(locations.organizationId, organization.id));
    const currentCafe =
      existingLocations.find((row) => row.code === "rockville") ??
      existingLocations.find((row) => row.code === "beltsville") ??
      existingLocations.find((row) => row.code === "cafe");

    const rockvilleValues = {
      code: "rockville" as const,
      name: "Rockville",
      timezone: "America/New_York",
      address: { ...rockvilleAddress },
      isActive: true,
      updatedAt: new Date(),
    };

    const [location] = currentCafe
      ? await transaction
          .update(locations)
          .set(rockvilleValues)
          .where(eq(locations.id, currentCafe.id))
          .returning()
      : await transaction
          .insert(locations)
          .values({
            organizationId: organization.id,
            ...rockvilleValues,
            openedOn: "2026-02-01",
          })
          .onConflictDoUpdate({
            target: [locations.organizationId, locations.code],
            set: rockvilleValues,
          })
          .returning();
    if (!location) {
      throw new Error("The Rockville location could not be saved.");
    }

    const roleIds = new Map<ManagerRole, string>();
    for (const role of managerRoles) {
      const [record] = await transaction
        .insert(staffRoles)
        .values({
          organizationId: organization.id,
          key: role,
          name: roleNames[role],
          scope: role === "owner" || role === "accountant"
            ? "organization"
            : "location",
          permissions: capabilitiesFor(role),
          isSystem: true,
        })
        .onConflictDoUpdate({
          target: [staffRoles.organizationId, staffRoles.key],
          set: {
            name: roleNames[role],
            permissions: capabilitiesFor(role),
            updatedAt: new Date(),
          },
        })
        .returning({ id: staffRoles.id });
      roleIds.set(role, record.id);
    }

    for (const [
      code,
      name,
      symbol,
      dimension,
      decimalPlaces,
      isDimensionBase,
    ] of unitSeeds) {
      await transaction
        .insert(unitsOfMeasure)
        .values({
          organizationId: organization.id,
          code,
          name,
          symbol,
          dimension,
          decimalPlaces,
          isDimensionBase,
        })
        .onConflictDoUpdate({
          target: [unitsOfMeasure.organizationId, unitsOfMeasure.code],
          set: { name, symbol, decimalPlaces, updatedAt: new Date() },
        });
    }

    for (const [code, name, accountType, normalBalance] of accountSeeds) {
      await transaction
        .insert(accounts)
        .values({
          organizationId: organization.id,
          code,
          name,
          accountType,
          normalBalance,
        })
        .onConflictDoUpdate({
          target: [accounts.organizationId, accounts.code],
          set: {
            name,
            accountType,
            normalBalance,
            isActive: true,
            updatedAt: new Date(),
          },
        });
    }

    for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
      const startsOn = isoDate(2026, monthIndex, 1);
      const endsOn = isoDate(2026, monthIndex + 1, 0);
      await transaction
        .insert(accountingPeriods)
        .values({
          organizationId: organization.id,
          fiscalYear: 2026,
          periodNumber: monthIndex + 1,
          name: new Intl.DateTimeFormat("en-US", {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          }).format(new Date(`${startsOn}T00:00:00.000Z`)),
          startsOn,
          endsOn,
        })
        .onConflictDoNothing({
          target: [
            accountingPeriods.organizationId,
            accountingPeriods.fiscalYear,
            accountingPeriods.periodNumber,
          ],
        });
    }

    async function bootstrapLocationConnection(input: {
      sourceSystem: "clover" | "postmark_inbound";
      externalAccountId: string;
      displayName: string;
      credentialReference: string;
      settings?: Record<string, unknown>;
    }) {
      const [existing] = await transaction
        .select({ id: integrationConnections.id })
        .from(integrationConnections)
        .where(
          and(
            eq(integrationConnections.organizationId, organization.id),
            eq(integrationConnections.locationId, location.id),
            eq(integrationConnections.sourceSystem, input.sourceSystem),
          ),
        )
        .limit(1);
      if (existing) {
        await transaction
          .update(integrationConnections)
          .set({
            displayName: input.displayName,
            status: "active",
            updatedAt: new Date(),
          })
          .where(eq(integrationConnections.id, existing.id));
        return;
      }

      await transaction.insert(integrationConnections).values({
        organizationId: organization.id,
        locationId: location.id,
        sourceSystem: input.sourceSystem,
        externalAccountId: input.externalAccountId,
        displayName: input.displayName,
        credentialReference: input.credentialReference,
        settings: input.settings ?? {},
      });
    }

    if (env.CLOVER_MANAGER_MERCHANT_ID) {
      await bootstrapLocationConnection({
        sourceSystem: "clover",
        externalAccountId: env.CLOVER_MANAGER_MERCHANT_ID,
        displayName: "Clover — Rockville",
        credentialReference: "env:CLOVER_MANAGER_API_TOKEN",
      });
    }

    const invoiceInboxId =
      env.MANAGER_INVOICE_MAILBOX_HASH ?? env.MANAGER_INVOICE_EMAIL;
    if (invoiceInboxId) {
      await bootstrapLocationConnection({
        sourceSystem: "postmark_inbound",
        externalAccountId: invoiceInboxId,
        displayName: "Invoice mailbox — Rockville",
        credentialReference: "env:POSTMARK_INBOUND_SECRET",
        settings: {
          invoiceEmail: env.MANAGER_INVOICE_EMAIL ?? "",
          mailboxHash: env.MANAGER_INVOICE_MAILBOX_HASH ?? "",
        },
      });
    }

    let ownerStaffId: string | null = null;
    if (env.MANAGER_BOOTSTRAP_OWNER_EMAIL) {
      const ownerEmail = env.MANAGER_BOOTSTRAP_OWNER_EMAIL.toLowerCase();
      let [staff] = await transaction
        .select()
        .from(staffMembers)
        .where(
          and(
            eq(staffMembers.organizationId, organization.id),
            sql`lower(${staffMembers.email}) = ${ownerEmail}`,
          ),
        )
        .limit(1);
      if (staff) {
        [staff] = await transaction
          .update(staffMembers)
          .set({
            authUserId: env.MANAGER_BOOTSTRAP_AUTH_USER_ID,
            displayName: env.MANAGER_BOOTSTRAP_OWNER_NAME,
            status: "active",
            updatedAt: new Date(),
          })
          .where(eq(staffMembers.id, staff.id))
          .returning();
      } else {
        [staff] = await transaction
          .insert(staffMembers)
          .values({
            organizationId: organization.id,
            authUserId: env.MANAGER_BOOTSTRAP_AUTH_USER_ID,
            email: ownerEmail,
            displayName: env.MANAGER_BOOTSTRAP_OWNER_NAME,
            status: "active",
          })
          .returning();
      }
      ownerStaffId = staff.id;

      const ownerRoleId = roleIds.get("owner");
      if (ownerRoleId) {
        const [assignment] = await transaction
          .select({ id: staffRoleAssignments.id })
          .from(staffRoleAssignments)
          .where(
            and(
              eq(staffRoleAssignments.staffMemberId, staff.id),
              eq(staffRoleAssignments.staffRoleId, ownerRoleId),
            ),
          )
          .limit(1);
        if (!assignment) {
          await transaction.insert(staffRoleAssignments).values({
            organizationId: organization.id,
            staffMemberId: staff.id,
            staffRoleId: ownerRoleId,
          });
        }
      }
    }

    return {
      organizationId: organization.id,
      locationId: location.id,
      ownerStaffId,
    };
  });

  console.info(JSON.stringify(result, null, 2));
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Seed failed.");
    process.exitCode = 1;
  })
  .finally(closeDatabase);
