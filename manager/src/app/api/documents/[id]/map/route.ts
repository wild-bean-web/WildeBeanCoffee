import { z } from "zod";
import { requireCapability } from "@/lib/auth/session";
import { dataResponse, routeErrorResponse } from "@/lib/http";
import { mapDocumentLine } from "@/services/documents/matching";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  documentLineId: z.string().uuid(),
  productId: z.string().uuid(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireCapability("purchase:review");
    const { id } = await context.params;
    const body = bodySchema.parse(await request.json());
    return dataResponse(
      await mapDocumentLine(session, {
        documentId: id,
        documentLineId: body.documentLineId,
        productId: body.productId,
      }),
    );
  } catch (error) {
    return routeErrorResponse(error);
  }
}
