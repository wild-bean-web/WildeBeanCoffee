import { requireCapability } from "@/lib/auth/session";
import { dataResponse, routeErrorResponse } from "@/lib/http";
import { getLocationSetup } from "@/services/locations/setup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireCapability("dashboard:view");
    return dataResponse(await getLocationSetup(session));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
