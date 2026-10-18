import { requireCapability } from "@/lib/auth/session";
import { dataResponse, errorResponse, routeErrorResponse } from "@/lib/http";
import { createRecipeDraft } from "@/services/recipes/drafts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await requireCapability("inventory:adjust");
    if (!session.organizationId) {
      return errorResponse(403, "NO_ORGANIZATION", "This account is not tied to a company.");
    }
    const body = (await request.json()) as {
      name?: string;
      outputProductId?: string;
      yieldQuantity?: number;
      yieldUomId?: string;
      ingredients?: Array<{
        productId?: string;
        quantity?: number;
        uomId?: string;
        wasteFactor?: number;
      }>;
    };
    const result = await createRecipeDraft({
      organizationId: session.organizationId,
      staffMemberId: session.staffMemberId,
      name: body.name ?? "",
      outputProductId: body.outputProductId ?? "",
      yieldQuantity: Number(body.yieldQuantity),
      yieldUomId: body.yieldUomId ?? "",
      ingredients: (body.ingredients ?? []).map((line) => ({
        productId: line.productId ?? "",
        quantity: Number(line.quantity),
        uomId: line.uomId ?? "",
        wasteFactor: Number(line.wasteFactor ?? 0),
      })),
    });
    if (!result.ok) return errorResponse(422, "RECIPE_INVALID", result.message);
    return dataResponse({ message: `${result.name} is saved as a draft.` });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
