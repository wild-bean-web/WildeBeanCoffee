import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { documentLines, extractionRuns } from "@/db/schema";
import type { JsonObject } from "@/db/schema/shared";
import type { ManagerDatabase } from "@/db/client";
import {
  extractVendorSku,
  vendorDescriptionWithoutSku,
} from "@/domain/catalog";
import type { ProposedInvoicePacket } from "@/integrations/document-ai/packet";
import { parseMoneyToCents } from "@/lib/format";

function positiveQuantity(value: string | null | undefined): string {
  if (!value?.trim()) return "1";
  const amount = Number.parseFloat(value.replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount === 0) return "1";
  return String(Math.abs(amount));
}

export async function persistPacketLines(
  db: ManagerDatabase,
  input: {
    organizationId: string;
    sourceDocumentId: string;
    packet: ProposedInvoicePacket;
  },
): Promise<void> {
  const [run] = await db
    .select({ id: extractionRuns.id })
    .from(extractionRuns)
    .where(
      and(
        eq(extractionRuns.sourceDocumentId, input.sourceDocumentId),
        eq(extractionRuns.status, "succeeded"),
      ),
    )
    .orderBy(desc(extractionRuns.runNumber))
    .limit(1);
  if (!run) return;

  const existing = await db
    .select({ id: documentLines.id })
    .from(documentLines)
    .where(eq(documentLines.extractionRunId, run.id))
    .limit(1);
  if (existing.length > 0) return;

  const rows = input.packet.invoices.flatMap((invoice, invoiceIndex) =>
    invoice.lines.map((line, lineIndex) => {
      const vendorDescription = vendorDescriptionWithoutSku(
        line.description,
        line.productCode,
      );
      const vendorSku = extractVendorSku(line.description, line.productCode);
      const amountCents = parseMoneyToCents(line.amount);
      const unitCostCents = parseMoneyToCents(line.unitPrice);
      return {
        organizationId: input.organizationId,
        sourceDocumentId: input.sourceDocumentId,
        extractionRunId: run.id,
        lineNumber: invoiceIndex * 1_000 + lineIndex + 1,
        sourceLineId: `i${invoiceIndex}-l${lineIndex}`,
        description: vendorDescription.slice(0, 500),
        vendorSku,
        quantity: positiveQuantity(line.quantity),
        uomText: line.unit,
        unitCostCents:
          unitCostCents === null ? null : String(Math.abs(unitCostCents)),
        totalCents: amountCents,
        rawData: {
          invoiceIndex,
          invoiceId: invoice.invoiceId,
          kind: invoice.kind,
          productCode: line.productCode,
          unitPrice: line.unitPrice,
          amount: line.amount,
        } satisfies JsonObject,
      };
    }),
  );

  if (rows.length === 0) return;
  await db.insert(documentLines).values(rows);
}
