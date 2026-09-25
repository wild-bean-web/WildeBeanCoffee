import { requireCapability } from "@/lib/auth/session";
import { dataResponse, errorResponse, routeErrorResponse } from "@/lib/http";
import { saveOrganizationBrand } from "@/services/brand/organization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await requireCapability("users:manage");
    if (!session.organizationId) {
      return errorResponse(403, "NO_ORGANIZATION", "This account is not tied to a company.");
    }
    const form = await request.formData();
    const file = form.get("logo");
    const logo = file instanceof File && file.size > 0
      ? { filename: file.name, bytes: new Uint8Array(await file.arrayBuffer()) }
      : null;
    const result = await saveOrganizationBrand({
      organizationId: session.organizationId,
      primaryColor: String(form.get("primaryColor") ?? ""),
      accentColor: String(form.get("accentColor") ?? ""),
      logo,
    });
    if (!result.ok) return errorResponse(422, "BRAND_INVALID", result.message);
    return dataResponse({ message: "Brand saved for every location." });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
