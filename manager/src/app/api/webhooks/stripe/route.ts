import { stripeSignatureMatches } from "@/domain/stripe-signature";
import { getServerEnv } from "@/lib/env";
import { markLocationPaid } from "@/services/billing/locations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const env = getServerEnv();
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return new Response("Billing webhook is not configured.", { status: 503 });
  }
  const payload = await request.text();
  const valid = stripeSignatureMatches(
    payload,
    request.headers.get("stripe-signature"),
    env.STRIPE_WEBHOOK_SECRET,
  );
  if (!valid) return new Response("Invalid signature.", { status: 400 });

  const event = JSON.parse(payload) as {
    type?: string;
    data?: {
      object?: {
        metadata?: { locationId?: string };
        customer?: string | null;
        subscription?: string | null;
      };
    };
  };
  if (event.type === "checkout.session.completed") {
    const locationId = event.data?.object?.metadata?.locationId;
    if (locationId) {
      await markLocationPaid({
        locationId,
        stripeCustomerId: event.data?.object?.customer ?? null,
        stripeSubscriptionId: event.data?.object?.subscription ?? null,
      });
    }
  }
  return new Response("ok");
}
