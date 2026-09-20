import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { purchases, vendors } from "@/db/schema";
import type { ManagerSession } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/env";
import { requireLocationScope } from "@/services/locations/scope";
import { appendAuditEvent } from "@/services/audit/append";

export interface CreateManualPurchaseInput {
  session: ManagerSession;
  vendorName: string;
  purchaseDate: string;
  totalCents: number;
  paymentMethod: string;
  businessPurpose: string;
  itemDetails?: string;
}

export interface ManualPurchaseDraftResult {
  purchaseDraftId: string;
  persisted: boolean;
  missingEvidence: true;
}

const demoDrafts = new Map<string, CreateManualPurchaseInput>();

function vendorCode(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  const suffix = createHash("sha256").update(name).digest("hex").slice(0, 8);
  return `${slug || "vendor"}-${suffix}`;
}

export async function createManualPurchaseDraft(
  input: CreateManualPurchaseInput,
): Promise<ManualPurchaseDraftResult> {
  const env = getServerEnv();
  const purchaseDraftId = randomUUID();
  if (!env.DATABASE_URL) {
    if (env.NODE_ENV === "production") {
      throw new Error("The manager database is not configured.");
    }
    demoDrafts.set(purchaseDraftId, input);
    return {
      purchaseDraftId,
      persisted: false,
      missingEvidence: true,
    };
  }

  const { organizationId, locationId } = requireLocationScope(input.session);
  if (!input.session.staffMemberId) {
    throw new Error("The manager account is not linked to an active staff record.");
  }

  const db = getDb();
  await db.transaction(async (transaction) => {
    const normalizedVendor = input.vendorName.trim();
    const code = vendorCode(normalizedVendor);
    const [existingVendor] = await transaction
      .select({ id: vendors.id })
      .from(vendors)
      .where(
        and(
          eq(vendors.organizationId, organizationId),
          sql`lower(${vendors.name}) = lower(${normalizedVendor})`,
        ),
      )
      .limit(1);

    let vendorId = existingVendor?.id;
    if (!vendorId) {
      const [createdVendor] = await transaction
        .insert(vendors)
        .values({
          organizationId,
          code,
          name: normalizedVendor,
          defaultCurrency: "USD",
        })
        .onConflictDoUpdate({
          target: [vendors.organizationId, vendors.code],
          set: { name: normalizedVendor, updatedAt: new Date() },
        })
        .returning({ id: vendors.id });
      vendorId = createdVendor.id;
    }

    await transaction.insert(purchases).values({
      id: purchaseDraftId,
      organizationId,
      locationId,
      vendorId,
      purchaseType: "invoice",
      status: "draft",
      purchaseNumber: `MANUAL-${purchaseDraftId}`,
      sourceSystem: "manager_manual",
      externalId: purchaseDraftId,
      purchaseDate: input.purchaseDate,
      currency: "USD",
      subtotalCents: input.totalCents,
      totalCents: input.totalCents,
      createdByStaffMemberId: input.session.staffMemberId ?? undefined,
      notes: JSON.stringify({
        missingEvidence: true,
        paymentMethod: input.paymentMethod,
        businessPurpose: input.businessPurpose,
        ...(input.itemDetails ? { itemDetails: input.itemDetails } : {}),
        capturedByAuthUserId: input.session.userId,
      }),
    });
  });

  await appendAuditEvent({
    organizationId,
    actorType: "staff",
    actorStaffMemberId: input.session.staffMemberId ?? undefined,
    actorExternalId: input.session.userId,
    sourceSystem: "manager_manual",
    action: "purchase.missing_evidence_draft_created",
    entityType: "purchase",
    entityId: purchaseDraftId,
    eventData: {
      totalCents: input.totalCents,
      purchaseDate: input.purchaseDate,
      paymentMethod: input.paymentMethod,
      missingEvidence: true,
    },
  });

  return { purchaseDraftId, persisted: true, missingEvidence: true };
}
