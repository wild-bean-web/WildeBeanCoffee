import { requireCapability } from "@/lib/auth/session";
import { dataResponse, routeErrorResponse } from "@/lib/http";
import { startOpeningCount } from "@/services/inventory/counts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const session = await requireCapability("inventory:adjust");
    const result = await startOpeningCount(session);
    return dataResponse(result, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
