import { requireCapability } from "@/lib/auth/session";
import { dataResponse, routeErrorResponse } from "@/lib/http";
import { postStagedInventoryCatalog } from "@/services/imports/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireCapability("inventory:adjust");
    const { id } = await context.params;
    return dataResponse(await postStagedInventoryCatalog(session, id));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
