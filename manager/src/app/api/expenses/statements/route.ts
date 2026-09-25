import { requireCapability } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/env";
import { dataResponse, errorResponse, routeErrorResponse } from "@/lib/http";
import { ingestBankStatement } from "@/services/expenses/statement-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await requireCapability("bank:view");
    const env = getServerEnv();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return errorResponse(400, "FILE_REQUIRED", "Choose a bank statement PDF.");
    }
    const isPdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      return errorResponse(
        400,
        "NOT_A_PDF",
        "Only a PDF bank statement can be added here.",
      );
    }
    if (file.size > env.DOCUMENT_MAX_BYTES) {
      return errorResponse(
        413,
        "FILE_TOO_LARGE",
        `The file exceeds the ${Math.floor(env.DOCUMENT_MAX_BYTES / 1024 / 1024)} MB limit.`,
      );
    }

    if (!session.organizationId) {
      return errorResponse(403, "NO_ORGANIZATION", "This account is not tied to a company.");
    }
    const decision = await ingestBankStatement({
      organizationId: session.organizationId,
      filename: file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
    const rejected = decision.status !== "accepted";
    return dataResponse(
      { status: decision.status, message: decision.message },
      { status: rejected ? 422 : 200 },
    );
  } catch (error) {
    return routeErrorResponse(error);
  }
}
