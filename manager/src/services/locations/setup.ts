import "server-only";

import { and, eq, isNull, ne, or } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import {
  integrationConnections,
  type IntegrationConnection,
} from "@/db/schema";
import type { JsonObject } from "@/db/schema/shared";
import { hasCapability } from "@/lib/auth/capabilities";
import type { ManagerSession } from "@/lib/auth/session";
import { encryptSecret, secretLast4 } from "@/lib/credentials";
import { getServerEnv } from "@/lib/env";
import type { ManagerLocation } from "@/lib/location";
import { appendAuditEvent } from "@/services/audit/append";
import {
  CLOVER_ENV_TOKEN_REFERENCE,
  CLOVER_STORED_TOKEN_REFERENCE,
  cloverConnectionConfigured,
  cloverTokenLast4,
  cloverTokenSource,
} from "@/services/clover/connection-config";
import {
  mailboxConnectionConfigured,
  mailboxFromConnection,
  POSTMARK_ENV_SECRET_REFERENCE,
} from "@/services/mail/inbound-mailbox";
import { updateCafeLocation } from "./commands";
import { LocationScopeError } from "./errors";
import { requireLocationScope } from "./scope";
import type { LocationSetupSnapshot } from "./setup-types";

export type { LocationSetupSnapshot } from "./setup-types";

function emptyToUndefined(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

export const locationIdentitySchema = z.object({
  name: z.string().trim().min(1).max(120),
  timezone: z.string().trim().min(1).max(64),
  line1: z.preprocess(emptyToUndefined, z.string().trim().max(120).optional()),
  city: z.preprocess(emptyToUndefined, z.string().trim().max(80).optional()),
  region: z.preprocess(emptyToUndefined, z.string().trim().max(40).optional()),
  postalCode: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(20).optional(),
  ),
  phone: z.preprocess(emptyToUndefined, z.string().trim().max(32).optional()),
});

export const locationCloverSchema = z.object({
  merchantId: z
    .string()
    .trim()
    .min(3)
    .max(128)
    .regex(
      /^[A-Za-z0-9_-]+$/,
      "Clover merchant ID contains unsupported characters.",
    ),
  apiToken: z.preprocess((value) => {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    if (!trimmed || /^[•*\u2022]+$/.test(trimmed)) return undefined;
    return trimmed;
  }, z.string().min(16).optional()),
});

export const locationMailboxSchema = z
  .object({
    invoiceEmail: z.preprocess(
      emptyToUndefined,
      z.string().trim().email().optional(),
    ),
    mailboxHash: z.preprocess(
      emptyToUndefined,
      z.string().trim().min(1).max(256).optional(),
    ),
  })
  .superRefine((value, context) => {
    if (!value.invoiceEmail && !value.mailboxHash) {
      context.addIssue({
        code: "custom",
        message: "Enter the store invoice email or Postmark mailbox hash.",
      });
    }
  });

export type LocationIdentityInput = z.infer<typeof locationIdentitySchema>;
export type LocationCloverInput = z.infer<typeof locationCloverSchema>;
export type LocationMailboxInput = z.infer<typeof locationMailboxSchema>;

function requireOwner(session: ManagerSession, action: string): void {
  if (!hasCapability(session.role, "users:manage")) {
    throw new LocationScopeError(
      `Only an owner can ${action}.`,
      403,
      "OWNER_REQUIRED",
    );
  }
}

function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5; depth += 1) {
    if (
      current &&
      typeof current === "object" &&
      "code" in current &&
      (current as { code?: unknown }).code === "23505"
    ) {
      return true;
    }
    current =
      current && typeof current === "object" && "cause" in current
        ? (current as { cause: unknown }).cause
        : undefined;
  }
  return false;
}

async function findLocationConnection(
  organizationId: string,
  locationId: string,
  sourceSystem: string,
): Promise<IntegrationConnection | undefined> {
  const [connection] = await getDb()
    .select()
    .from(integrationConnections)
    .where(
      and(
        eq(integrationConnections.organizationId, organizationId),
        eq(integrationConnections.locationId, locationId),
        eq(integrationConnections.sourceSystem, sourceSystem),
      ),
    )
    .limit(1);
  return connection;
}

async function assertExternalAccountAvailable(input: {
  organizationId: string;
  locationId: string;
  sourceSystem: string;
  externalAccountId: string;
  conflictMessage: string;
  conflictCode: string;
}): Promise<void> {
  const [taken] = await getDb()
    .select({
      id: integrationConnections.id,
      locationId: integrationConnections.locationId,
    })
    .from(integrationConnections)
    .where(
      and(
        eq(integrationConnections.organizationId, input.organizationId),
        eq(integrationConnections.sourceSystem, input.sourceSystem),
        eq(integrationConnections.externalAccountId, input.externalAccountId),
        or(
          isNull(integrationConnections.locationId),
          ne(integrationConnections.locationId, input.locationId),
        ),
      ),
    )
    .limit(1);
  if (taken) {
    throw new LocationScopeError(input.conflictMessage, 409, input.conflictCode);
  }
}

async function upsertLocationConnection(input: {
  organizationId: string;
  locationId: string;
  sourceSystem: string;
  externalAccountId: string;
  displayName: string;
  credentialReference: string | null;
  settings: JsonObject;
}): Promise<IntegrationConnection> {
  const db = getDb();
  const existing = await findLocationConnection(
    input.organizationId,
    input.locationId,
    input.sourceSystem,
  );

  try {
    if (existing) {
      const [updated] = await db
        .update(integrationConnections)
        .set({
          externalAccountId: input.externalAccountId,
          displayName: input.displayName,
          status: "active",
          credentialReference: input.credentialReference,
          settings: input.settings,
          updatedAt: new Date(),
        })
        .where(eq(integrationConnections.id, existing.id))
        .returning();
      if (!updated) {
        throw new LocationScopeError(
          "The store connection could not be saved.",
          500,
          "CONNECTION_SAVE_FAILED",
        );
      }
      return updated;
    }

    const [created] = await db
      .insert(integrationConnections)
      .values({
        organizationId: input.organizationId,
        locationId: input.locationId,
        sourceSystem: input.sourceSystem,
        externalAccountId: input.externalAccountId,
        displayName: input.displayName,
        status: "active",
        credentialReference: input.credentialReference,
        settings: input.settings,
      })
      .returning();
    if (!created) {
      throw new LocationScopeError(
        "The store connection could not be saved.",
        500,
        "CONNECTION_SAVE_FAILED",
      );
    }
    return created;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new LocationScopeError(
        "That integration is already assigned to another location.",
        409,
        "CONNECTION_IN_USE",
      );
    }
    throw error;
  }
}

function brandReadiness() {
  const env = getServerEnv();
  return {
    databaseConfigured: Boolean(env.DATABASE_URL),
    documentsConfigured: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
    cloverWebhookConfigured: Boolean(
      env.CLOVER_MANAGER_WEBHOOK_SECRET ||
        env.CLOVER_MANAGER_PLATFORM_WEBHOOK_AUTH_CODE,
    ),
    postmarkConfigured: Boolean(env.POSTMARK_INBOUND_SECRET),
    documentAiConfigured:
      env.DOCUMENT_AI_PROVIDER !== "disabled" &&
      Boolean(
        env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT &&
          env.AZURE_DOCUMENT_INTELLIGENCE_KEY,
      ),
  };
}

export async function getLocationSetup(
  session: ManagerSession,
): Promise<LocationSetupSnapshot> {
  const env = getServerEnv();
  const canManage = hasCapability(session.role, "users:manage");
  const location =
    session.locations.find(
      (item) => item.id === session.activeLocationId,
    ) ?? null;

  const emptyClover = {
    configured: false,
    merchantId: "",
    tokenConfigured: false,
    tokenSource: "missing" as const,
    tokenLast4: null,
  };
  const emptyMailbox = {
    configured: false,
    invoiceEmail: "",
    mailboxHash: "",
  };

  if (!session.organizationId || !location) {
    return {
      location,
      identity: location
        ? {
            name: location.name,
            timezone: location.timezone,
            address: location.address ?? {},
          }
        : null,
      clover: emptyClover,
      mailbox: emptyMailbox,
      brand: brandReadiness(),
      canManage,
    };
  }

  const [clover, mailbox] = await Promise.all([
    findLocationConnection(session.organizationId, location.id, "clover"),
    findLocationConnection(
      session.organizationId,
      location.id,
      "postmark_inbound",
    ),
  ]);

  const tokenSource = clover
    ? cloverTokenSource(clover, env.CLOVER_MANAGER_API_TOKEN)
    : "missing";
  const mailboxEndpoints = mailbox ? mailboxFromConnection(mailbox) : emptyMailbox;

  return {
    location,
    identity: {
      name: location.name,
      timezone: location.timezone,
      address: location.address ?? {},
    },
    clover: {
      configured: cloverConnectionConfigured(clover, env.CLOVER_MANAGER_API_TOKEN),
      merchantId: clover?.externalAccountId ?? "",
      tokenConfigured: tokenSource !== "missing",
      tokenSource,
      tokenLast4: clover ? cloverTokenLast4(clover.settings) : null,
    },
    mailbox: {
      configured: mailboxConnectionConfigured(mailbox),
      invoiceEmail: mailboxEndpoints.invoiceEmail,
      mailboxHash: mailboxEndpoints.mailboxHash,
    },
    brand: brandReadiness(),
    canManage,
  };
}

export async function saveLocationIdentity(
  session: ManagerSession,
  input: LocationIdentityInput,
): Promise<ManagerLocation> {
  requireOwner(session, "update store identity");
  const { locationId } = requireLocationScope(session);
  return updateCafeLocation(session, locationId, {
    name: input.name,
    timezone: input.timezone,
    address: {
      line1: input.line1,
      city: input.city,
      region: input.region,
      postalCode: input.postalCode,
      phone: input.phone,
    },
  });
}

export async function saveLocationClover(
  session: ManagerSession,
  input: LocationCloverInput,
) {
  requireOwner(session, "connect Clover for a store");
  const { organizationId, locationId } = requireLocationScope(session);
  const env = getServerEnv();
  const location = session.locations.find((item) => item.id === locationId);
  if (!location) {
    throw new LocationScopeError("Choose a location before connecting Clover.");
  }

  await assertExternalAccountAvailable({
    organizationId,
    locationId,
    sourceSystem: "clover",
    externalAccountId: input.merchantId,
    conflictMessage: "That Clover merchant is already assigned to another location.",
    conflictCode: "CLOVER_MERCHANT_IN_USE",
  });

  const existing = await findLocationConnection(
    organizationId,
    locationId,
    "clover",
  );
  const nextSettings: JsonObject = { ...(existing?.settings ?? {}) };
  let credentialReference = existing?.credentialReference ?? null;

  if (input.apiToken) {
    nextSettings.apiTokenEnc = encryptSecret(input.apiToken);
    nextSettings.tokenLast4 = secretLast4(input.apiToken);
    credentialReference = CLOVER_STORED_TOKEN_REFERENCE;
  } else if (
    !cloverConnectionConfigured(
      existing
        ? { ...existing, externalAccountId: input.merchantId }
        : undefined,
      env.CLOVER_MANAGER_API_TOKEN,
    )
  ) {
    if (env.CLOVER_MANAGER_API_TOKEN) {
      credentialReference = CLOVER_ENV_TOKEN_REFERENCE;
    } else {
      throw new LocationScopeError(
        "Paste this store's Clover API token to finish the connection.",
        400,
        "CLOVER_TOKEN_REQUIRED",
      );
    }
  }

  const connection = await upsertLocationConnection({
    organizationId,
    locationId,
    sourceSystem: "clover",
    externalAccountId: input.merchantId,
    displayName: `Clover — ${location.name}`,
    credentialReference,
    settings: nextSettings,
  });

  await appendAuditEvent({
    organizationId,
    actorType: "staff",
    actorStaffMemberId: session.staffMemberId ?? undefined,
    actorExternalId: session.userId,
    sourceSystem: "manager_web",
    action: "location.clover.updated",
    entityType: "integration_connection",
    entityId: connection.id,
    eventData: {
      locationId,
      merchantId: input.merchantId,
      tokenSource: cloverTokenSource(connection, env.CLOVER_MANAGER_API_TOKEN),
    },
  });

  return {
    merchantId: connection.externalAccountId,
    tokenConfigured: cloverTokenSource(connection, env.CLOVER_MANAGER_API_TOKEN) !== "missing",
    tokenSource: cloverTokenSource(connection, env.CLOVER_MANAGER_API_TOKEN),
    tokenLast4: cloverTokenLast4(connection.settings),
  };
}

export async function saveLocationMailbox(
  session: ManagerSession,
  input: LocationMailboxInput,
) {
  requireOwner(session, "connect an invoice mailbox for a store");
  const { organizationId, locationId } = requireLocationScope(session);
  const location = session.locations.find((item) => item.id === locationId);
  if (!location) {
    throw new LocationScopeError(
      "Choose a location before connecting an invoice mailbox.",
    );
  }

  const invoiceEmail = input.invoiceEmail?.trim() ?? "";
  const mailboxHash = input.mailboxHash?.trim() ?? "";
  const externalAccountId = mailboxHash || invoiceEmail;

  await assertExternalAccountAvailable({
    organizationId,
    locationId,
    sourceSystem: "postmark_inbound",
    externalAccountId,
    conflictMessage:
      "That invoice mailbox is already assigned to another location.",
    conflictCode: "MAILBOX_IN_USE",
  });

  const existing = await findLocationConnection(
    organizationId,
    locationId,
    "postmark_inbound",
  );
  const connection = await upsertLocationConnection({
    organizationId,
    locationId,
    sourceSystem: "postmark_inbound",
    externalAccountId,
    displayName: `Invoice mailbox — ${location.name}`,
    credentialReference:
      existing?.credentialReference ?? POSTMARK_ENV_SECRET_REFERENCE,
    settings: {
      ...(existing?.settings ?? {}),
      invoiceEmail,
      mailboxHash,
    },
  });

  await appendAuditEvent({
    organizationId,
    actorType: "staff",
    actorStaffMemberId: session.staffMemberId ?? undefined,
    actorExternalId: session.userId,
    sourceSystem: "manager_web",
    action: "location.mailbox.updated",
    entityType: "integration_connection",
    entityId: connection.id,
    eventData: {
      locationId,
      invoiceEmail,
      mailboxHash,
    },
  });

  return mailboxFromConnection(connection);
}
