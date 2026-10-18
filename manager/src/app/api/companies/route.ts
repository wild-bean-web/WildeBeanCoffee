import { parseCompanySignup } from "@/domain/companies";
import { dataResponse, errorResponse, routeErrorResponse } from "@/lib/http";
import { createCompanyAccount } from "@/services/companies/provision";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const parsed = parseCompanySignup(await request.json().catch(() => null));
    if (!parsed.ok) return errorResponse(422, "COMPANY_INVALID", parsed.message);
    const result = await createCompanyAccount(parsed.value);
    if (!result.ok) return errorResponse(422, "COMPANY_NOT_CREATED", result.message);
    return dataResponse({ message: "Company created. Sign in with that email." });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
