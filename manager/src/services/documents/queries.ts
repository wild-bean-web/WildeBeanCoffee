import "server-only";

import { and, desc, eq, notInArray, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { extractionRuns, sourceDocuments, vendors } from "@/db/schema";
import { proposeFieldsFromAnalyzeResult } from "@/integrations/document-ai/normalize";
import {
  proposeInvoicePacket,
  type ProposedInvoicePacket,
} from "@/integrations/document-ai/packet";
import { hasCapability } from "@/lib/auth/capabilities";
import type { ManagerSession } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/env";
import { locationScope } from "@/services/locations/scope";
import { extractPdfPageTexts } from "@/services/documents/pdf-text";
import { getDocumentStore } from "@/services/storage/document-store";

export interface DocumentInboxItem {
  id: string;
  filename: string;
  documentType: string;
  status: string;
  vendorName: string | null;
  receivedAt: Date;
  totalCents: number | null;
  duplicateOfDocumentId: string | null;
  invoiceCount: number | null;
}

function invoiceCountFromMetadata(metadata: Record<string, unknown>): number | null {
  return typeof metadata.invoiceCount === "number" && metadata.invoiceCount > 0
    ? metadata.invoiceCount
    : null;
}

function companyNameFromMetadata(metadata: Record<string, unknown>): string | null {
  return typeof metadata.companyName === "string" && metadata.companyName.trim()
    ? metadata.companyName
    : null;
}

function isConfidentialDocument(
  documentType: string,
  metadata: Record<string, unknown>,
): boolean {
  return (
    documentType === "payroll" ||
    metadata.documentKind === "payroll" ||
    metadata.sensitivity === "confidential"
  );
}

function canViewConfidential(session: ManagerSession): boolean {
  return (
    hasCapability(session.role, "payroll:view") ||
    hasCapability(session.role, "documents:view-confidential")
  );
}

export async function listDocumentInbox(
  session: ManagerSession,
  options: { limit?: number; startsOn?: string; endsOn?: string } = {},
): Promise<DocumentInboxItem[]> {
  const env = getServerEnv();
  const scope = locationScope(session);
  if (!env.DATABASE_URL || !scope) return [];
  const limit = options.limit ?? 50;
  const filters = [
    eq(sourceDocuments.organizationId, scope.organizationId),
    eq(sourceDocuments.locationId, scope.locationId),
    notInArray(sourceDocuments.status, ["voided", "duplicate"]),
  ];
  if (options.startsOn) {
    filters.push(
      sql`((${sourceDocuments.receivedAt} at time zone 'America/New_York')::date) >= ${options.startsOn}`,
    );
  }
  if (options.endsOn) {
    filters.push(
      sql`((${sourceDocuments.receivedAt} at time zone 'America/New_York')::date) <= ${options.endsOn}`,
    );
  }

  const rows = await getDb()
    .select({
      id: sourceDocuments.id,
      filename: sourceDocuments.originalFileName,
      documentType: sourceDocuments.documentType,
      status: sourceDocuments.status,
      vendorName: vendors.name,
      receivedAt: sourceDocuments.receivedAt,
      totalCents: sourceDocuments.totalCents,
      duplicateOfDocumentId: sourceDocuments.duplicateOfDocumentId,
      metadata: sourceDocuments.metadata,
    })
    .from(sourceDocuments)
    .leftJoin(vendors, eq(sourceDocuments.vendorId, vendors.id))
    .where(and(...filters))
    .orderBy(desc(sourceDocuments.receivedAt))
    .limit(Math.min(Math.max(limit, 1), 100));

  const allowConfidential = canViewConfidential(session);

  return rows
    .filter(
      (row) =>
        allowConfidential || !isConfidentialDocument(row.documentType, row.metadata),
    )
    .map((row) => ({
      id: row.id,
      filename: row.filename,
      documentType: row.documentType,
      status: row.status,
      vendorName:
        row.vendorName ??
        companyNameFromMetadata(row.metadata) ??
        (row.documentType === "payroll" ? "Payroll" : null),
      receivedAt: row.receivedAt,
      totalCents: row.totalCents,
      duplicateOfDocumentId: row.duplicateOfDocumentId,
      invoiceCount: invoiceCountFromMetadata(row.metadata),
    }));
}

export interface DocumentReview {
  id: string;
  filename: string;
  mimeType: string;
  documentType: string;
  status: string;
  receivedAt: Date;
  vendorName: string | null;
  totalCents: number | null;
  reviewReason: string | null;
  extractionStatus: string | null;
  extractionModel: string | null;
  proposed: ReturnType<typeof proposeFieldsFromAnalyzeResult>;
  packet: ProposedInvoicePacket;
}

export async function getDocumentReview(
  session: ManagerSession,
  documentId: string,
): Promise<DocumentReview | null> {
  const env = getServerEnv();
  const scope = locationScope(session);
  if (!env.DATABASE_URL || !scope) return null;

  const [document] = await getDb()
    .select({
      id: sourceDocuments.id,
      filename: sourceDocuments.originalFileName,
      mimeType: sourceDocuments.mimeType,
      documentType: sourceDocuments.documentType,
      status: sourceDocuments.status,
      receivedAt: sourceDocuments.receivedAt,
      vendorName: vendors.name,
      totalCents: sourceDocuments.totalCents,
      metadata: sourceDocuments.metadata,
      storageKey: sourceDocuments.storageKey,
    })
    .from(sourceDocuments)
    .leftJoin(vendors, eq(sourceDocuments.vendorId, vendors.id))
    .where(
      and(
        eq(sourceDocuments.id, documentId),
        eq(sourceDocuments.organizationId, scope.organizationId),
        eq(sourceDocuments.locationId, scope.locationId),
        notInArray(sourceDocuments.status, ["voided"]),
      ),
    )
    .limit(1);

  if (!document) return null;
  if (
    isConfidentialDocument(document.documentType, document.metadata) &&
    !canViewConfidential(session)
  ) {
    return null;
  }

  if (document.documentType === "payroll") {
    const reviewReason =
      typeof document.metadata.reviewReason === "string"
        ? document.metadata.reviewReason
        : null;
    const [extraction] = await getDb()
      .select({
        status: extractionRuns.status,
        model: extractionRuns.model,
      })
      .from(extractionRuns)
      .where(eq(extractionRuns.sourceDocumentId, document.id))
      .orderBy(desc(extractionRuns.runNumber))
      .limit(1);
    const packet: ProposedInvoicePacket = {
      invoices: [],
      pageCount: 0,
      analyzedPageCount: null,
      truncatedExtraction: false,
    };
    return {
      id: document.id,
      filename: document.filename,
      mimeType: document.mimeType,
      documentType: document.documentType,
      status: document.status,
      receivedAt: document.receivedAt,
      vendorName: companyNameFromMetadata(document.metadata),
      totalCents: document.totalCents,
      reviewReason,
      extractionStatus: extraction?.status ?? null,
      extractionModel: extraction?.model ?? null,
      proposed: proposeFieldsFromAnalyzeResult(undefined),
      packet,
    };
  }

  const [extraction] = await getDb()
    .select({
      status: extractionRuns.status,
      model: extractionRuns.model,
      rawOutput: extractionRuns.rawOutput,
    })
    .from(extractionRuns)
    .where(eq(extractionRuns.sourceDocumentId, document.id))
    .orderBy(desc(extractionRuns.runNumber))
    .limit(1);

  const reviewReason =
    typeof document.metadata.reviewReason === "string"
      ? document.metadata.reviewReason
      : null;

  let pageTexts: string[] = [];
  if (document.mimeType === "application/pdf") {
    try {
      const bytes = await getDocumentStore().readOriginal(document.storageKey);
      pageTexts = await extractPdfPageTexts(bytes);
    } catch (error) {
      console.error("Original PDF text could not be read for invoice splitting", {
        documentId: document.id,
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage: error instanceof Error ? error.message : "Unknown failure",
      });
    }
  }

  const packet = proposeInvoicePacket({
    analyzeResult: extraction?.rawOutput,
    pageTexts,
  });
  const storedCount = invoiceCountFromMetadata(document.metadata);
  if (packet.invoices.length > 0 && storedCount !== packet.invoices.length) {
    await getDb()
      .update(sourceDocuments)
      .set({
        metadata: {
          ...document.metadata,
          invoiceCount: packet.invoices.length,
          originalPageCount: packet.pageCount,
          extractionPageCount: packet.analyzedPageCount,
        },
        updatedAt: new Date(),
      })
      .where(eq(sourceDocuments.id, document.id));
  }

  return {
    id: document.id,
    filename: document.filename,
    mimeType: document.mimeType,
    documentType: document.documentType,
    status: document.status,
    receivedAt: document.receivedAt,
    vendorName: document.vendorName,
    totalCents: document.totalCents,
    reviewReason,
    extractionStatus: extraction?.status ?? null,
    extractionModel: extraction?.model ?? null,
    proposed: packet.invoices[0] ?? proposeFieldsFromAnalyzeResult(extraction?.rawOutput),
    packet,
  };
}

export async function getSourceDocumentFile(
  session: ManagerSession,
  documentId: string,
): Promise<{
  filename: string;
  mimeType: string;
  storageKey: string;
} | null> {
  const env = getServerEnv();
  const scope = locationScope(session);
  if (!env.DATABASE_URL || !scope) return null;

  const [document] = await getDb()
    .select({
      filename: sourceDocuments.originalFileName,
      mimeType: sourceDocuments.mimeType,
      storageKey: sourceDocuments.storageKey,
      documentType: sourceDocuments.documentType,
      metadata: sourceDocuments.metadata,
    })
    .from(sourceDocuments)
    .where(
      and(
        eq(sourceDocuments.id, documentId),
        eq(sourceDocuments.organizationId, scope.organizationId),
        eq(sourceDocuments.locationId, scope.locationId),
        notInArray(sourceDocuments.status, ["voided"]),
      ),
    )
    .limit(1);

  if (!document) return null;
  if (
    isConfidentialDocument(document.documentType, document.metadata) &&
    !canViewConfidential(session)
  ) {
    return null;
  }

  return {
    filename: document.filename,
    mimeType: document.mimeType,
    storageKey: document.storageKey,
  };
}
