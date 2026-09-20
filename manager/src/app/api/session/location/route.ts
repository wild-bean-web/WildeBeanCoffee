import { z } from "zod";
import { cookies } from "next/headers";
import { requireManagerSession } from "@/lib/auth/session";
import { ACTIVE_LOCATION_COOKIE } from "@/lib/location";
import { dataResponse, errorResponse, routeErrorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  locationId: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    const session = await requireManagerSession();
    const body = bodySchema.parse(await request.json());
    if (!session.locationIds.includes(body.locationId)) {
      return errorResponse(
        403,
        "LOCATION_FORBIDDEN",
        "That location is not available on this account.",
      );
    }

    const jar = await cookies();
    jar.set(ACTIVE_LOCATION_COOKIE, body.locationId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      secure: process.env.NODE_ENV === "production",
    });

    return dataResponse({ locationId: body.locationId });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
