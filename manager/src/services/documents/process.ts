import "server-only";

import { and, eq, max } from "drizzle-orm";
import {
  assertDocumentTransition,
  type DocumentStatus,
} from "@/domain/documents";
import { getDb } from "@/db/client";
import {
  extractionRuns,
  sourceDocuments,
  type SourceDocument,
} from "@/db/schema";
import { createDocumentExtractionProvider } from "@/integrations/document-ai";
import { proposeInvoicePacket } from "@/integrations/document-ai/packet";
import { getServerEnv } from "@/lib/env";
import { looksLikePayrollPreview, parsePayrollPreview } from "@/domain/payroll";
import { extractPdfPageTexts } from "@/services/documents/pdf-text";
import { persistPacketLines } from "@/services/documents/extracted-lines";
import { persistPayrollPreview } from "@/services/payroll/runs";
import { getDocumentStore } from "@/services/storage/document-store";
import { isPayrollCapture } from "@/services/payroll/extract";

export interface ProcessDocumentResult {
  documentId: string;
  status: DocumentStatus;
  extractionRunId?: string;
}

function classifyDocument(
  document: SourceDocument,
): "invoice" | "receipt" | "payroll" | null {
  if (isPayrollCapture(document)) return "payroll";
  const captureChannel =
    typeof document.metadata.captureChannel === "string"
      ? document.metadata.captureChannel
      : null;
  if (captureChannel === "manager_web" && document.mimeType.startsWith("image/")) {
    return "receipt";
  }
  if (document.mimeType === "application/pdf") return "invoice";
  return null;
}

function looksLikePayrollFromText(pageTexts: string[]): boolean {
  return looksLikePayrollPreview(pageTexts.join("\n"));
}

async function processPayrollDocument(
  document: SourceDocument,
  pageTexts: string[],
): Promise<ProcessDocumentResult> {
  const db = getDb();
  const [runSequence] = await db
    .select({ maximum: max(extractionRuns.runNumber) })
    .from(extractionRuns)
    .where(eq(extractionRuns.sourceDocumentId, document.id));
  const [run] = await db
    .insert(extractionRuns)
    .values({
      organizationId: document.organizationId,
      sourceDocumentId: document.id,
      runNumber: (runSequence?.maximum ?? 0) + 1,
      provider: "none",
      model: "payroll-preview-v1",
      parserVersion: "payroll-preview-v1",
      status: "running",
      startedAt: new Date(),
    })
    .returning();

  try {
    const parsed = parsePayrollPreview(pageTexts);
    const payrollRunId = await persistPayrollPreview({
      organizationId: document.organizationId,
      locationId: document.locationId,
      sourceDocumentId: document.id,
      parsed,
    });
    await db
      .update(extractionRuns)
      .set({
        status: "succeeded",
        finishedAt: new Date(),
        rawOutput: {
          payrollRunId,
          employeeCount: parsed.employees.length,
          pageCount: pageTexts.length,
          loadedLaborCents: parsed.loadedLaborCents,
        },
        updatedAt: new Date(),
      })
      .where(eq(extractionRuns.id, run.id));

    document = await transition(document, "extracted", {
      documentType: "payroll",
      documentDate: parsed.checkDate ?? parsed.periodEndsOn,
      totalCents: parsed.loadedLaborCents,
      metadata: {
        ...document.metadata,
        documentKind: "payroll",
        sensitivity: "confidential",
        companyName: parsed.companyName,
        extractionRunId: run.id,
        extractionProvider: "none",
        extractionModel: "payroll-preview-v1",
        payrollRunId,
        reviewReason: "payroll_preview_review_required",
        payPeriod: {
          startsOn: parsed.periodStartsOn,
          endsOn: parsed.periodEndsOn,
          checkDate: parsed.checkDate,
        },
        labor: {
          employeeCount: parsed.employees.length,
          totalHours: parsed.totalHours,
          wageCents: parsed.wagesCents,
          tipCents: parsed.tipsCents,
          employerTaxCents: parsed.employerTaxCents,
          loadedLaborCents: parsed.loadedLaborCents,
        },
      },
    });
    document = await transition(document, "needs_review", {
      metadata: {
        ...document.metadata,
        reviewReason: "payroll_preview_review_required",
      },
    });
    return {
      documentId: document.id,
      status: "needs_review",
      extractionRunId: run.id,
    };
  } catch (error) {
    await db
      .update(extractionRuns)
      .set({
        status: "failed",
        finishedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : "PayrollParseError",
        updatedAt: new Date(),
      })
      .where(eq(extractionRuns.id, run.id));
    throw error;
  }
}

async function transition(
  document: SourceDocument,
  to: DocumentStatus,
  extra: Partial<typeof sourceDocuments.$inferInsert> = {},
): Promise<SourceDocument> {
  const from = document.status as DocumentStatus;
  assertDocumentTransition(from, to);

  const [updated] = await getDb()
    .update(sourceDocuments)
    .set({
      ...extra,
      status: to,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(sourceDocuments.id, document.id),
        eq(sourceDocuments.status, document.status),
      ),
    )
    .returning();

  return updated ?? document;
}

export async function processSourceDocument(
  documentId: string,
): Promise<ProcessDocumentResult> {
  const env = getServerEnv();
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to process documents.");
  }

  const db = getDb();
  let [document] = await db
    .select()
    .from(sourceDocuments)
    .where(eq(sourceDocuments.id, documentId))
    .limit(1);
  if (!document) throw new Error("Source document was not found.");

  if (
    ["duplicate", "failure", "voided", "posted"].includes(document.status)
  ) {
    return {
      documentId,
      status: document.status as DocumentStatus,
    };
  }

  if (document.status === "received") {
    // Files remain non-renderable and private while quarantined. A production
    // deployment plugs a malware scanner into this boundary before extraction.
    document = await transition(document, "quarantined");
  }

  if (document.status === "quarantined") {
    const documentType = classifyDocument(document);
    if (!documentType) {
      document = await transition(document, "classified", {
        documentType: "unknown",
      });
      document = await transition(document, "needs_review", {
        metadata: {
          ...document.metadata,
          reviewReason: "structured_parser_or_document_type_required",
        },
      });
      return { documentId, status: "needs_review" };
    }
    document = await transition(document, "classified", { documentType });
  }

  if (document.status === "classified") {
    const bytes = await getDocumentStore().readOriginal(document.storageKey);
    let pageTexts: string[] = [];
    if (document.mimeType === "application/pdf") {
      try {
        pageTexts = await extractPdfPageTexts(bytes);
      } catch (error) {
        console.error("Original PDF text could not be read", {
          documentId: document.id,
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
      }
    }

    const payrollByContent =
      document.documentType === "payroll" ||
      looksLikePayrollFromText(pageTexts);
    if (payrollByContent) {
      return processPayrollDocument(document, pageTexts);
    }

    if (env.DOCUMENT_AI_PROVIDER === "disabled") {
      document = await transition(document, "needs_review", {
        metadata: {
          ...document.metadata,
          reviewReason: "document_extraction_provider_not_configured",
        },
      });
      return { documentId, status: "needs_review" };
    }

    const [runSequence] = await db
      .select({ maximum: max(extractionRuns.runNumber) })
      .from(extractionRuns)
      .where(eq(extractionRuns.sourceDocumentId, document.id));
    const [run] = await db
      .insert(extractionRuns)
      .values({
        organizationId: document.organizationId,
        sourceDocumentId: document.id,
        runNumber: (runSequence?.maximum ?? 0) + 1,
        provider: env.DOCUMENT_AI_PROVIDER,
        model:
          document.documentType === "receipt"
            ? "prebuilt-receipt"
            : "prebuilt-invoice",
        parserVersion: "manager-v1",
        status: "running",
        startedAt: new Date(),
      })
      .returning();

    try {
      const extraction = await createDocumentExtractionProvider().analyze({
        bytes,
        mimeType: document.mimeType,
        model: document.documentType === "receipt" ? "receipt" : "invoice",
      });
      const packet = proposeInvoicePacket({
        analyzeResult: extraction.result,
        pageTexts,
      });
      await db
        .update(extractionRuns)
        .set({
          status: "succeeded",
          finishedAt: new Date(),
          rawOutput: JSON.parse(JSON.stringify(extraction.result ?? {})),
          updatedAt: new Date(),
        })
        .where(eq(extractionRuns.id, run.id));
      const packetMetadata = {
        invoiceCount: packet.invoices.length,
        originalPageCount: packet.pageCount,
        extractionPageCount: packet.analyzedPageCount,
      };
      await persistPacketLines(db, {
        organizationId: document.organizationId,
        sourceDocumentId: document.id,
        packet,
      });
      document = await transition(document, "extracted", {
        metadata: {
          ...document.metadata,
          extractionRunId: run.id,
          extractionProvider: extraction.provider,
          extractionModel: extraction.providerModelId,
          extractionApiVersion: extraction.providerApiVersion,
          ...packetMetadata,
        },
      });
      document = await transition(document, "needs_review", {
        metadata: {
          ...document.metadata,
          reviewReason: "line_normalization_and_mapping_required",
          ...packetMetadata,
        },
      });
      return {
        documentId,
        status: "needs_review",
        extractionRunId: run.id,
      };
    } catch (error) {
      await db
        .update(extractionRuns)
        .set({
          status: "failed",
          finishedAt: new Date(),
          errorMessage:
            error instanceof Error ? error.name : "ExtractionProviderError",
          updatedAt: new Date(),
        })
        .where(eq(extractionRuns.id, run.id));
      throw error;
    }
  }

  return {
    documentId,
    status: document.status as DocumentStatus,
  };
}
