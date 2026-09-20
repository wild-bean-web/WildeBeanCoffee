import { requireCapability } from "@/lib/auth/session";
import { dataResponse, routeErrorResponse } from "@/lib/http";
import { postPayrollDocument } from "@/services/payroll/runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireCapability("payroll:approve");
    const { id } = await context.params;
    return dataResponse(await postPayrollDocument(session, id));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
