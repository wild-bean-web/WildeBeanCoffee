import { z } from "zod";
import { requireCapability } from "@/lib/auth/session";
import { dataResponse, routeErrorResponse } from "@/lib/http";
import { createCafeLocation } from "@/services/locations/commands";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  timezone: z.string().trim().min(1).max(64).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await requireCapability("users:manage");
    const body = bodySchema.parse(await request.json());
    const location = await createCafeLocation(session, body);
    return dataResponse(location, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
