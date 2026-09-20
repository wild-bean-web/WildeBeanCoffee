import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, notInArray } from "drizzle-orm";
import { buildDocumentJobKey } from "@/domain/documents";
import { getDb } from "@/db/client";
import { sourceDocuments } from "@/db/schema";
import type { ManagerSession } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/env";
import { enqueueJob, jobNames } from "@/worker/queue";
import { appendAuditEvent } from "@/services/audit/append";
import { DocumentServiceError } from "./errors";
import { requireLocationScope } from "@/services/locations/scope";
import {
  digestSourceBytes,
  getDocumentStore,
} from "../storage/document-store";

const DEMO_ORGANIZATION_ID = "00000000-0000-4000-8000-000000000010";

export interface CaptureSourceDocumentInput {
  session?: ManagerSession;
  integrationActor?: {
    organizationId: string;
    locationId: string;
    externalId: string;
    captureChannel: string;
  };
  originalFilename: string;
  mimeType: string;
  bytes: Uint8Array;
  paymentMethod?: string;
  documentKind?: "invoice" | "receipt" | "payroll";
  businessPurpose?: string;
  sourceSystem?: string;
  externalId?: string;
}

export interface CapturedSourceDocument {
  documentId: string;
  status: "received";
  duplicateOfDocumentId: string | null;
  sha256: string;
  processingQueued: boolean;
  persisted: boolean;
}

const demoDocuments = new Map<string, CapturedSourceDocument>();

function duplicateUploadError(existingId: string): DocumentServiceError {
  return new DocumentServiceError(
    "This file is already stored for this location. Delete or void the existing copy before uploading it again.",
    409,
    "DUPLICATE_DOCUMENT",
    { existingDocumentId: existingId },
  );
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

export async function captureSourceDocument(
  input: CaptureSourceDocumentInput,
): Promise<CapturedSourceDocument> {
  const env = getServerEnv();
  const organizationId =
    input.integrationActor?.organizationId ??
    input.session?.organizationId ??
    (input.session?.isDemo ? DEMO_ORGANIZATION_ID : null);
  if (!organizationId) {
    throw new Error("The manager account is not assigned to an organization.");
  }
  const locationId = input.integrationActor?.locationId
    ?? (env.DATABASE_URL && input.session
      ? requireLocationScope(input.session).locationId
      : null);
  if (env.DATABASE_URL && !locationId) {
    throw new DocumentServiceError(
      "Choose a location before uploading a document.",
      400,
      "LOCATION_REQUIRED",
    );
  }
  const operatingLocationId = locationId ?? "";
  if (
    env.DATABASE_URL &&
    !input.integrationActor &&
    !input.session?.staffMemberId
  ) {
    throw new Error("The manager account is not linked to an active staff record.");
  }
  if (!input.session && !input.integrationActor) {
    throw new Error("A document capture actor is required.");
  }

  const digest = digestSourceBytes(input.bytes);

  if (!env.DATABASE_URL) {
    if (env.NODE_ENV === "production") {
      throw new Error("The manager database is not configured.");
    }
    const existingDemo = [...demoDocuments.values()].find(
      (document) => document.sha256 === digest,
    );
    if (existingDemo) {
      throw duplicateUploadError(existingDemo.documentId);
    }
  }

  if (env.DATABASE_URL && input.externalId) {
    const [alreadyCaptured] = await getDb()
      .select({
        id: sourceDocuments.id,
        sha256: sourceDocuments.sha256,
        status: sourceDocuments.status,
      })
      .from(sourceDocuments)
      .where(
        and(
          eq(sourceDocuments.organizationId, organizationId),
          eq(sourceDocuments.locationId, operatingLocationId),
          eq(
            sourceDocuments.sourceSystem,
            input.sourceSystem ?? "manager_upload",
          ),
          eq(sourceDocuments.externalId, input.externalId),
          notInArray(sourceDocuments.status, ["voided", "duplicate"]),
        ),
      )
      .limit(1);
    if (alreadyCaptured) {
      throw duplicateUploadError(alreadyCaptured.id);
    }
  }

  if (env.DATABASE_URL) {
    const [existing] = await getDb()
      .select({ id: sourceDocuments.id })
      .from(sourceDocuments)
      .where(
        and(
          eq(sourceDocuments.organizationId, organizationId),
          eq(sourceDocuments.locationId, operatingLocationId),
          eq(sourceDocuments.sha256, digest),
          notInArray(sourceDocuments.status, ["voided", "duplicate"]),
        ),
      )
      .orderBy(sourceDocuments.receivedAt)
      .limit(1);
    if (existing) {
      throw duplicateUploadError(existing.id);
    }
  }

  const documentId = randomUUID();
  const stored = await getDocumentStore().storeOriginal({
    organizationId,
    documentId,
    originalFilename: input.originalFilename,
    mimeType: input.mimeType,
    bytes: input.bytes,
  });

  if (!env.DATABASE_URL) {
    const captured: CapturedSourceDocument = {
      documentId,
      status: "received",
      duplicateOfDocumentId: null,
      sha256: stored.sha256,
      processingQueued: false,
      persisted: false,
    };
    demoDocuments.set(documentId, captured);
    return captured;
  }

  const db = getDb();
  try {
    await db.insert(sourceDocuments).values({
      id: documentId,
      organizationId,
      locationId: operatingLocationId,
      documentType: input.documentKind === "payroll" ? "payroll" : "unknown",
      status: "received",
      sourceSystem: input.sourceSystem ?? "manager_upload",
      externalId: input.externalId,
      storageKey: stored.objectKey,
      originalFileName: input.originalFilename,
      mimeType: input.mimeType,
      byteSize: stored.byteSize,
      sha256: stored.sha256,
      metadata: {
        ...(input.paymentMethod ? { paymentMethod: input.paymentMethod } : {}),
        ...(input.documentKind ? { documentKind: input.documentKind } : {}),
        ...(input.documentKind === "payroll"
          ? { sensitivity: "confidential" }
          : {}),
        ...(input.businessPurpose
          ? { businessPurpose: input.businessPurpose }
          : {}),
        ...(input.session
          ? { capturedByAuthUserId: input.session.userId }
          : {
              capturedByIntegration: input.integrationActor?.externalId,
            }),
        captureChannel:
          input.integrationActor?.captureChannel ?? "manager_web",
      },
    });
  } catch (error) {
    try {
      await getDocumentStore().removeOriginal(stored.objectKey);
    } catch {
      // The duplicate row was not created. Storage cleanup can retry later.
    }
    if (isUniqueViolation(error)) {
      const [existing] = await db
        .select({ id: sourceDocuments.id })
        .from(sourceDocuments)
        .where(
          and(
            eq(sourceDocuments.organizationId, organizationId),
            eq(sourceDocuments.locationId, operatingLocationId),
            eq(sourceDocuments.sha256, stored.sha256),
            notInArray(sourceDocuments.status, ["voided", "duplicate"]),
          ),
        )
        .limit(1);
      throw duplicateUploadError(existing?.id ?? documentId);
    }
    throw error;
  }

  await appendAuditEvent({
    organizationId,
    actorType: input.integrationActor ? "integration" : "staff",
    actorStaffMemberId: input.session?.staffMemberId ?? undefined,
    actorExternalId:
      input.integrationActor?.externalId ?? input.session?.userId,
    sourceSystem: input.sourceSystem ?? "manager_upload",
    action: "document.captured",
    entityType: "source_document",
    entityId: documentId,
    eventData: {
      sha256: stored.sha256,
      byteSize: stored.byteSize,
      mimeType: input.mimeType,
      status: "received",
      locationId: operatingLocationId,
    },
  });

  let processingQueued = false;
  try {
    const key = buildDocumentJobKey({
      stage: "quarantine",
      documentId,
      revision: 0,
      contentDigest: stored.sha256,
    });
    await enqueueJob(
      jobNames.documentProcess,
      { documentId, stageVersion: 1 },
      key,
    );
    processingQueued = true;
  } catch {
    // The durable source remains in received state. A recovery sweep can
    // safely enqueue it later with the same idempotency key.
  }

  return {
    documentId,
    status: "received",
    duplicateOfDocumentId: null,
    sha256: stored.sha256,
    processingQueued,
    persisted: true,
  };
}
