import { requireCapability } from "@/lib/auth/session";
import { dataResponse, routeErrorResponse } from "@/lib/http";
import {
  locationMailboxSchema,
  saveLocationMailbox,
} from "@/services/locations/setup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await requireCapability("users:manage");
    const body = locationMailboxSchema.parse(await request.json());
    return dataResponse(await saveLocationMailbox(session, body));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
