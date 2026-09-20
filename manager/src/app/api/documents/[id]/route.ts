import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/auth/session";
import { errorResponse, dataResponse, routeErrorResponse } from "@/lib/http";
import { getSourceDocumentFile } from "@/services/documents/queries";
import { deleteUploadedDocument } from "@/services/documents/remove";
import { getDocumentStore } from "@/services/storage/document-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireCapability("documents:view-normal");
    const { id } = await context.params;
    if (!id) {
      return errorResponse(
        400,
        "DOCUMENT_REQUIRED",
        "A document id is required.",
      );
    }

    const document = await getSourceDocumentFile(session, id);
    if (!document) {
      return errorResponse(404, "DOCUMENT_NOT_FOUND", "That document was not found.");
    }

    const bytes = await getDocumentStore().readOriginal(document.storageKey);
    const filename = document.filename.replace(/"/g, "");
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": document.mimeType,
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Frame-Options": "SAMEORIGIN",
        "Content-Security-Policy": "frame-ancestors 'self'; base-uri 'self'",
      },
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireCapability("documents:delete");
    const { id } = await context.params;
    if (!id) {
      return errorResponse(
        400,
        "DOCUMENT_REQUIRED",
        "A document id is required.",
      );
    }

    const result = await deleteUploadedDocument(session, id);
    return dataResponse(result);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
