import "server-only";

import { and, eq, or } from "drizzle-orm";
import {
  assertDocumentTransition,
  type DocumentStatus,
} from "@/domain/documents";
import { getDb } from "@/db/client";
import { sourceDocuments } from "@/db/schema";
import type { ManagerSession } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/env";
import { appendAuditEvent } from "@/services/audit/append";
import { DocumentServiceError } from "./errors";
import { locationScope } from "@/services/locations/scope";
import { voidPayrollDocument } from "@/services/payroll/runs";
import { getDocumentStore } from "../storage/document-store";

export interface DeletedSourceDocument {
  documentId: string;
  status: "voided";
}

export async function deleteUploadedDocument(
  session: ManagerSession,
  documentId: string,
): Promise<DeletedSourceDocument> {
  const env = getServerEnv();
  const scope = locationScope(session);
  if (!env.DATABASE_URL || !scope || !session.staffMemberId) {
    throw new DocumentServiceError(
      "The manager account cannot delete documents in this environment.",
      400,
      "DOCUMENT_DELETE_UNAVAILABLE",
    );
  }

  const db = getDb();
  const [document] = await db
    .select()
    .from(sourceDocuments)
    .where(
      and(
        eq(sourceDocuments.id, documentId),
        eq(sourceDocuments.organizationId, scope.organizationId),
        eq(sourceDocuments.locationId, scope.locationId),
      ),
    )
    .limit(1);

  if (!document) {
    throw new DocumentServiceError(
      "That document was not found.",
      404,
      "DOCUMENT_NOT_FOUND",
    );
  }

  const from = document.status as DocumentStatus;
  if (document.documentType === "payroll") {
    return voidPayrollDocument(session, documentId);
  }
  if (from === "posted") {
    throw new DocumentServiceError(
      "Posted documents cannot be deleted. Reverse the purchase instead.",
      409,
      "DOCUMENT_POSTED_IMMUTABLE",
    );
  }
  if (from === "voided") {
    return { documentId: document.id, status: "voided" };
  }

  assertDocumentTransition(from, "voided");

  const [updated] = await db
    .update(sourceDocuments)
    .set({
      status: "voided",
      updatedAt: new Date(),
      metadata: {
        ...document.metadata,
        voidedByStaffMemberId: session.staffMemberId,
        voidedAt: new Date().toISOString(),
      },
    })
    .where(
      and(
        eq(sourceDocuments.id, document.id),
        eq(sourceDocuments.status, document.status),
      ),
    )
    .returning({ id: sourceDocuments.id });

  if (!updated) {
    throw new DocumentServiceError(
      "The document could not be deleted because its status changed.",
      409,
      "DOCUMENT_STATUS_CHANGED",
    );
  }

  await db
    .update(sourceDocuments)
    .set({
      status: "voided",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(sourceDocuments.organizationId, scope.organizationId),
        eq(sourceDocuments.locationId, scope.locationId),
        eq(sourceDocuments.status, "duplicate"),
        or(
          eq(sourceDocuments.duplicateOfDocumentId, document.id),
          eq(sourceDocuments.sha256, document.sha256),
        ),
      ),
    );

  await appendAuditEvent({
    organizationId: scope.organizationId,
    actorType: "staff",
    actorStaffMemberId: session.staffMemberId,
    actorExternalId: session.userId,
    sourceSystem: "manager_web",
    action: "document.voided",
    entityType: "source_document",
    entityId: document.id,
    eventData: {
      previousStatus: from,
      originalFileName: document.originalFileName,
      sha256: document.sha256,
    },
  });

  try {
    await getDocumentStore().removeOriginal(document.storageKey);
  } catch {
    // The inbox row is already voided. Storage cleanup can be retried later.
  }

  return { documentId: document.id, status: "voided" };
}
