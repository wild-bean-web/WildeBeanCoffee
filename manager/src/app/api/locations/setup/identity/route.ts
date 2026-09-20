import { requireCapability } from "@/lib/auth/session";
import { dataResponse, routeErrorResponse } from "@/lib/http";
import {
  locationIdentitySchema,
  saveLocationIdentity,
} from "@/services/locations/setup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await requireCapability("users:manage");
    const body = locationIdentitySchema.parse(await request.json());
    const location = await saveLocationIdentity(session, body);
    return dataResponse(location);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
