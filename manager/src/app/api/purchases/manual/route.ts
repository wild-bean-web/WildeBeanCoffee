import { z } from "zod";
import { moneyDecimalToCents } from "@/domain/shared";
import { requireCapability } from "@/lib/auth/session";
import { dataResponse, routeErrorResponse } from "@/lib/http";
import { createManualPurchaseDraft } from "@/services/purchases/manual";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const manualPurchaseSchema = z
  .object({
    vendorName: z.string().trim().min(1).max(200),
    purchaseDate: z.iso.date(),
    total: z.string().regex(/^\d{1,10}(?:\.\d{1,2})?$/),
    paymentMethod: z.enum([
      "company_card",
      "cash",
      "owner_paid",
      "invoice_due",
    ]),
    businessPurpose: z.string().trim().min(2).max(500),
    itemDetails: z.string().trim().max(2_000).optional(),
    missingEvidence: z.literal(true),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const session = await requireCapability("purchase:capture");
    const input = manualPurchaseSchema.parse(await request.json());
    const result = await createManualPurchaseDraft({
      session,
      vendorName: input.vendorName,
      purchaseDate: input.purchaseDate,
      totalCents: moneyDecimalToCents(input.total),
      paymentMethod: input.paymentMethod,
      businessPurpose: input.businessPurpose,
      itemDetails: input.itemDetails,
    });

    return dataResponse(result, { status: 202 });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
