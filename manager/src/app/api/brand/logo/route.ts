import { getManagerSession } from "@/lib/auth/session";
import { readOrganizationLogo } from "@/services/brand/organization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getManagerSession();
  if (!session?.organizationId) {
    return new Response(null, { status: 404 });
  }
  const logo = await readOrganizationLogo(session.organizationId).catch(() => null);
  if (!logo) return new Response(null, { status: 404 });
  const copy = new ArrayBuffer(logo.bytes.byteLength);
  new Uint8Array(copy).set(logo.bytes);
  return new Response(copy, {
    headers: {
      "Content-Type": logo.contentType,
      "Cache-Control": "private, max-age=300",
    },
  });
}
