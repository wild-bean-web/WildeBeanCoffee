import { z } from "zod";
import { requireCapability } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/env";
import { dataResponse, errorResponse, routeErrorResponse } from "@/lib/http";
import { captureSourceDocument } from "@/services/documents/capture";
import { validateSourceFile } from "@/services/documents/file-validation";
import { processSourceDocument } from "@/services/documents/process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const metadataSchema = z.object({
  paymentMethod: z.enum([
    "company_card",
    "cash",
    "owner_paid",
    "invoice_due",
  ]),
  businessPurpose: z.string().trim().max(500).optional(),
});

function safeFilename(value: string): string {
  const normalized = value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/]/g, "_")
    .trim();
  return normalized.slice(0, 255) || "document";
}

export async function POST(request: Request) {
  try {
    const session = await requireCapability("purchase:capture");
    const env = getServerEnv();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return errorResponse(
        400,
        "FILE_REQUIRED",
        "Choose a receipt, invoice, or supported data file.",
      );
    }

    const metadata = metadataSchema.parse({
      paymentMethod: form.get("paymentMethod"),
      businessPurpose: form.get("businessPurpose") || undefined,
    });
    if (file.size > env.DOCUMENT_MAX_BYTES) {
      return errorResponse(
        413,
        "FILE_TOO_LARGE",
        `The file exceeds the ${Math.floor(env.DOCUMENT_MAX_BYTES / 1024 / 1024)} MB limit.`,
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const validation = validateSourceFile(
      bytes,
      file.type,
      env.DOCUMENT_MAX_BYTES,
    );
    if (!validation.valid || !validation.detectedMimeType) {
      return errorResponse(
        415,
        "UNSUPPORTED_DOCUMENT",
        validation.reason ?? "The document type is not supported.",
      );
    }

    const captured = await captureSourceDocument({
      session,
      originalFilename: safeFilename(file.name),
      mimeType: validation.detectedMimeType,
      bytes,
      paymentMethod: metadata.paymentMethod,
      businessPurpose: metadata.businessPurpose,
    });

    if (captured.persisted && captured.status === "received") {
      try {
        await processSourceDocument(captured.documentId);
      } catch {
        // Original remains stored. A later worker pass can retry extraction.
      }
    }

    return dataResponse(
      {
        documentId: captured.documentId,
        status: captured.status,
        duplicateOfDocumentId: captured.duplicateOfDocumentId,
        processingQueued: captured.processingQueued,
        persisted: captured.persisted,
      },
      { status: 202 },
    );
  } catch (error) {
    return routeErrorResponse(error);
  }
}
