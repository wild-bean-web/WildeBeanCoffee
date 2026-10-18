import { requireCapability } from "@/lib/auth/session";
import { dataResponse, errorResponse, routeErrorResponse } from "@/lib/http";
import { savePayrollCalendar } from "@/services/payroll/calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await requireCapability("users:manage");
    if (!session.organizationId) {
      return errorResponse(403, "NO_ORGANIZATION", "This account is not tied to a company.");
    }
    const body = (await request.json()) as { anchor?: string; periodDays?: number };
    const result = await savePayrollCalendar({
      organizationId: session.organizationId,
      anchor: body.anchor ?? "",
      periodDays: body.periodDays ?? 0,
    });
    if (!result.ok) return errorResponse(422, "PAYROLL_CALENDAR_INVALID", result.message);
    return dataResponse({ message: "Pay calendar saved." });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
