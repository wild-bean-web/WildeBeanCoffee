import { requireCapability } from "@/lib/auth/session";
import { dataResponse, errorResponse, routeErrorResponse } from "@/lib/http";
import {
  importCloverSalesRange,
  importCloverSalesThroughToday,
  planCloverSalesCatchUp,
} from "@/services/clover/reconcile-day";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const businessDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: Request) {
  try {
    const session = await requireCapability("dashboard:view");
    const body = (await request.json().catch(() => ({}))) as {
      plan?: boolean;
      businessDate?: string;
    };
    if (body.plan) {
      return dataResponse(await planCloverSalesCatchUp(session));
    }
    if (body.businessDate !== undefined) {
      if (!businessDatePattern.test(body.businessDate)) {
        return errorResponse(
          400,
          "INVALID_BUSINESS_DATE",
          "Choose a valid business date.",
        );
      }
      return dataResponse(
        await importCloverSalesRange(
          session,
          body.businessDate,
          body.businessDate,
        ),
      );
    }
    return dataResponse(await importCloverSalesThroughToday(session));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
