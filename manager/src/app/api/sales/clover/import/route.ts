import { z } from "zod";
import { isIsoDate } from "@/lib/date-range";
import { requireCapability } from "@/lib/auth/session";
import { dataResponse, routeErrorResponse } from "@/lib/http";
import { importCloverSalesRange } from "@/services/clover/reconcile-day";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const importSchema = z
  .object({
    from: z.string().refine(isIsoDate, "Choose a valid start date."),
    to: z.string().refine(isIsoDate, "Choose a valid end date."),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const session = await requireCapability("dashboard:view");
    const input = importSchema.parse(await request.json());
    return dataResponse(await importCloverSalesRange(session, input.from, input.to));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
