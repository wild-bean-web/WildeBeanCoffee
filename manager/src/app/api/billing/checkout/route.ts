import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { locations } from "@/db/schema";
import { requireCapability } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/env";
import { dataResponse, errorResponse, routeErrorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await requireCapability("users:manage");
    if (!session.organizationId) {
      return errorResponse(403, "NO_ORGANIZATION", "This account is not tied to a company.");
    }
    const env = getServerEnv();
    if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PRICE_ID) {
      return errorResponse(
        503,
        "BILLING_NOT_CONFIGURED",
        "Location billing is not connected yet.",
      );
    }
    const body = (await request.json().catch(() => null)) as { locationId?: string } | null;
    const locationId = body?.locationId ?? "";
    const [location] = await getDb()
      .select({ id: locations.id, name: locations.name })
      .from(locations)
      .where(
        and(
          eq(locations.id, locationId),
          eq(locations.organizationId, session.organizationId),
        ),
      )
      .limit(1);
    if (!location) {
      return errorResponse(404, "LOCATION_NOT_FOUND", "That location is not on this company.");
    }

    const form = new URLSearchParams();
    form.set("mode", "subscription");
    form.set("line_items[0][price]", env.STRIPE_PRICE_ID);
    form.set("line_items[0][quantity]", "1");
    form.set("success_url", `${env.MANAGER_APP_URL}/settings?billing=success`);
    form.set("cancel_url", `${env.MANAGER_APP_URL}/settings?billing=cancel`);
    form.set("client_reference_id", location.id);
    form.set("metadata[locationId]", location.id);
    form.set("metadata[organizationId]", session.organizationId);
    form.set("customer_email", session.email);
    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: form,
    });
    const payload = (await response.json()) as { url?: string; error?: { message?: string } };
    if (!response.ok || !payload.url) {
      return errorResponse(
        502,
        "CHECKOUT_FAILED",
        payload.error?.message ?? "Checkout could not be opened.",
      );
    }
    return dataResponse({ url: payload.url });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
