import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import {
  organizationStatusEnum,
  roleScopeEnum,
  staffStatusEnum,
} from "./enums";
import { type JsonObject, lifecycleTimestamps } from "./shared";

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: varchar("slug", { length: 64 }).notNull(),
    legalName: text("legal_name").notNull(),
    displayName: text("display_name").notNull(),
    baseCurrency: varchar("base_currency", { length: 3 })
      .default("USD")
      .notNull(),
    timezone: varchar("timezone", { length: 64 }).default("UTC").notNull(),
    status: organizationStatusEnum("status").default("active").notNull(),
    taxIdentifier: text("tax_identifier"),
    externalId: text("external_id"),
    settings: jsonb("settings").$type<JsonObject>().default({}).notNull(),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex("org_slug_uidx").on(sql`lower(${table.slug})`),
    uniqueIndex("org_external_id_uidx")
      .on(table.externalId)
      .where(sql`${table.externalId} is not null`),
    check("org_slug_not_blank", sql`btrim(${table.slug}) <> ''`),
    check(
      "org_currency_iso_code",
      sql`${table.baseCurrency} ~ '^[A-Z]{3}$'`,
    ),
    check("org_timezone_not_blank", sql`btrim(${table.timezone}) <> ''`),
  ],
);

export const locations = pgTable(
  "locations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 64 }).notNull(),
    name: text("name").notNull(),
    externalId: text("external_id"),
    timezone: varchar("timezone", { length: 64 }).notNull(),
    address: jsonb("address").$type<JsonObject>(),
    isActive: boolean("is_active").default(true).notNull(),
    openedOn: date("opened_on", { mode: "string" }),
    closedOn: date("closed_on", { mode: "string" }),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex("location_id_org_uidx").on(table.id, table.organizationId),
    uniqueIndex("location_org_code_uidx").on(
      table.organizationId,
      table.code,
    ),
    uniqueIndex("location_org_external_uidx")
      .on(table.organizationId, table.externalId)
      .where(sql`${table.externalId} is not null`),
    index("location_org_active_idx").on(
      table.organizationId,
      table.isActive,
    ),
    check("location_code_not_blank", sql`btrim(${table.code}) <> ''`),
    check("location_name_not_blank", sql`btrim(${table.name}) <> ''`),
    check(
      "location_dates_ordered",
      sql`${table.closedOn} is null or ${table.openedOn} is null or ${table.closedOn} >= ${table.openedOn}`,
    ),
  ],
);

export const staffMembers = pgTable(
  "staff_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    authUserId: uuid("auth_user_id"),
    employeeNumber: varchar("employee_number", { length: 64 }),
    externalId: text("external_id"),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    legalName: text("legal_name"),
    status: staffStatusEnum("status").default("invited").notNull(),
    hiredOn: date("hired_on", { mode: "string" }),
    terminatedOn: date("terminated_on", { mode: "string" }),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex("staff_auth_user_uidx")
      .on(table.authUserId)
      .where(sql`${table.authUserId} is not null`),
    uniqueIndex("staff_org_email_uidx").on(
      table.organizationId,
      sql`lower(${table.email})`,
    ),
    uniqueIndex("staff_org_employee_uidx")
      .on(table.organizationId, table.employeeNumber)
      .where(sql`${table.employeeNumber} is not null`),
    uniqueIndex("staff_org_external_uidx")
      .on(table.organizationId, table.externalId)
      .where(sql`${table.externalId} is not null`),
    index("staff_org_status_idx").on(table.organizationId, table.status),
    check("staff_email_not_blank", sql`btrim(${table.email}) <> ''`),
    check("staff_name_not_blank", sql`btrim(${table.displayName}) <> ''`),
    check(
      "staff_dates_ordered",
      sql`${table.terminatedOn} is null or ${table.hiredOn} is null or ${table.terminatedOn} >= ${table.hiredOn}`,
    ),
  ],
);

export const staffRoles = pgTable(
  "staff_roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    key: varchar("key", { length: 64 }).notNull(),
    name: text("name").notNull(),
    description: text("description"),
    scope: roleScopeEnum("scope").notNull(),
    permissions: jsonb("permissions")
      .$type<readonly string[]>()
      .default([])
      .notNull(),
    isSystem: boolean("is_system").default(false).notNull(),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex("staff_role_org_key_uidx").on(
      table.organizationId,
      table.key,
    ),
    check("staff_role_key_not_blank", sql`btrim(${table.key}) <> ''`),
    check("staff_role_name_not_blank", sql`btrim(${table.name}) <> ''`),
  ],
);

export const staffRoleAssignments = pgTable(
  "staff_role_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    staffMemberId: uuid("staff_member_id")
      .notNull()
      .references(() => staffMembers.id, { onDelete: "restrict" }),
    staffRoleId: uuid("staff_role_id")
      .notNull()
      .references(() => staffRoles.id, { onDelete: "restrict" }),
    locationId: uuid("location_id").references(() => locations.id, {
      onDelete: "restrict",
    }),
    effectiveFrom: date("effective_from", { mode: "string" })
      .default(sql`current_date`)
      .notNull(),
    effectiveTo: date("effective_to", { mode: "string" }),
    assignedByStaffMemberId: uuid(
      "assigned_by_staff_member_id",
    ).references(() => staffMembers.id, { onDelete: "set null" }),
    revokedAt: timestamp("revoked_at", {
      withTimezone: true,
      precision: 3,
    }),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex("role_assign_org_wide_uidx")
      .on(table.staffMemberId, table.staffRoleId, table.effectiveFrom)
      .where(sql`${table.locationId} is null`),
    uniqueIndex("role_assign_location_uidx")
      .on(
        table.staffMemberId,
        table.staffRoleId,
        table.locationId,
        table.effectiveFrom,
      )
      .where(sql`${table.locationId} is not null`),
    index("role_assign_org_active_idx").on(
      table.organizationId,
      table.staffMemberId,
      table.effectiveTo,
    ),
    index("role_assign_location_idx").on(table.locationId),
    check(
      "role_assign_dates_ordered",
      sql`${table.effectiveTo} is null or ${table.effectiveTo} >= ${table.effectiveFrom}`,
    ),
  ],
);

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type Location = typeof locations.$inferSelect;
export type NewLocation = typeof locations.$inferInsert;
export type StaffMember = typeof staffMembers.$inferSelect;
export type NewStaffMember = typeof staffMembers.$inferInsert;
export type StaffRole = typeof staffRoles.$inferSelect;
export type NewStaffRole = typeof staffRoles.$inferInsert;
export type StaffRoleAssignment = typeof staffRoleAssignments.$inferSelect;
export type NewStaffRoleAssignment = typeof staffRoleAssignments.$inferInsert;
