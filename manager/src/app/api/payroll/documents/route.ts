import { requireCapability } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/env";
import { dataResponse, errorResponse, routeErrorResponse } from "@/lib/http";
import { captureSourceDocument } from "@/services/documents/capture";
import { validateSourceFile } from "@/services/documents/file-validation";
import { processSourceDocument } from "@/services/documents/process";
import { PayrollServiceError } from "@/services/payroll/errors";
import {
  getPayrollRunForDocument,
  voidPayrollDocument,
} from "@/services/payroll/runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeFilename(value: string): string {
  const normalized = value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/]/g, "_")
    .trim();
  return normalized.slice(0, 255) || "payroll-preview.pdf";
}

export async function POST(request: Request) {
  try {
    const session = await requireCapability("payroll:capture");
    const env = getServerEnv();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return errorResponse(
        400,
        "FILE_REQUIRED",
        "Choose a payroll preview PDF.",
      );
    }

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
        validation.reason ?? "Upload the payroll preview as a PDF.",
      );
    }
    if (validation.detectedMimeType !== "application/pdf") {
      return errorResponse(
        415,
        "UNSUPPORTED_DOCUMENT",
        "Payroll previews must be uploaded as a PDF.",
      );
    }

    const captured = await captureSourceDocument({
      session,
      originalFilename: safeFilename(file.name),
      mimeType: validation.detectedMimeType,
      bytes,
      documentKind: "payroll",
    });

    if (captured.persisted && captured.status === "received") {
      try {
        await processSourceDocument(captured.documentId);
      } catch (error) {
        if (
          error instanceof PayrollServiceError &&
          error.code === "PAYROLL_PERIOD_EXISTS"
        ) {
          await voidPayrollDocument(session, captured.documentId);
        }
        throw error;
      }
    }

    const workspace = await getPayrollRunForDocument(
      session,
      captured.documentId,
    );
    return dataResponse(
      {
        documentId: captured.documentId,
        status: workspace ? "needs_review" : captured.status,
        payrollRunId: workspace?.run.id ?? null,
        loadedLaborCents: workspace?.run.loadedLaborCents ?? null,
        employeeCount: workspace?.run.employeeCount ?? null,
        processingQueued: captured.processingQueued,
        persisted: captured.persisted,
      },
      { status: 202 },
    );
  } catch (error) {
    return routeErrorResponse(error);
  }
}
