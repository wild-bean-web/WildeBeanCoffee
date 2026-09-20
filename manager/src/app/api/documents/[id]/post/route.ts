import { requireCapability } from "@/lib/auth/session";
import { dataResponse, routeErrorResponse } from "@/lib/http";
import { postMappedDocument } from "@/services/documents/posting";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireCapability("purchase:approve");
    const { id } = await context.params;
    return dataResponse(await postMappedDocument(session, id));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
