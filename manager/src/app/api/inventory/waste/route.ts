import { z } from "zod";
import { WasteReasonSchema } from "@/domain/inventory";
import { requireCapability } from "@/lib/auth/session";
import { dataResponse, routeErrorResponse } from "@/lib/http";
import { recordWaste } from "@/services/inventory/waste";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const wasteSchema = z
  .object({
    productId: z.string().uuid(),
    quantity: z.string().trim().min(1).max(32),
    reason: WasteReasonSchema,
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const session = await requireCapability("waste:record");
    const input = wasteSchema.parse(await request.json());
    const result = await recordWaste({
      session,
      productId: input.productId,
      quantity: input.quantity,
      reason: input.reason,
      note: input.note,
    });
    return dataResponse(result, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
