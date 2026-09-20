import { requireCapability } from "@/lib/auth/session";
import { dataResponse, errorResponse, routeErrorResponse } from "@/lib/http";
import { submitCountSession } from "@/services/inventory/counts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireCapability("inventory:count");
    const { id } = await context.params;
    if (!id) {
      return errorResponse(400, "COUNT_SESSION_REQUIRED", "Count session is required.");
    }
    const result = await submitCountSession(session, id);
    return dataResponse(result);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
