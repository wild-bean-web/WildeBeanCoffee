import { z } from "zod";
import { suggestCountSheetName } from "./aka";

export const LEGACY_INVENTORY_IMPORT_KIND = "legacy_inventory";

export const InventoryNormalizedRowSchema = z.object({
  category: z.string().trim().min(1),
  productName: z.string().trim().min(1),
  alias: z.string().nullable().optional(),
  vendorName: z.string().nullable().optional(),
  purchasePackLabel: z.string().nullable().optional(),
  purchasePackQuantity: z.string().nullable().optional(),
  vendorPriceCents: z.number().int().nullable().optional(),
  vendorUnitPriceCents: z.number().int().nullable().optional(),
  provenance: z.string().optional(),
});

export type InventoryNormalizedRow = z.infer<typeof InventoryNormalizedRowSchema>;

export interface InventoryCatalogDraft {
  sku: string;
  countSheetName: string;
  vendorDescription: string;
  category: string;
  vendorName: string | null;
  vendorSku: string;
  packCode: string | null;
  packQuantity: string | null;
  unitCostCents: string | null;
}

export function slugCode(value: string, fallback: string, max: number): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, max);
  return slug || fallback;
}

export function inventoryImportSku(
  sourceSha256: string,
  sourceRow: number,
): string {
  return `INV-${sourceSha256.slice(0, 10)}-${String(sourceRow).padStart(4, "0")}`;
}

export function countSheetNameFromImport(
  productName: string,
  alias: string | null | undefined,
): string {
  const aka = alias?.trim();
  if (aka) return aka;
  return suggestCountSheetName(productName);
}

export function purchasePackCode(
  label: string | null | undefined,
  quantity: string | null | undefined,
): string | null {
  const packQuantity = quantity?.trim() || null;
  if (!packQuantity) return null;
  return slugCode(label ?? "", `pack-${packQuantity}`, 64);
}

export function unitCostCentsFromImport(
  vendorUnitPriceCents: number | null | undefined,
  vendorPriceCents: number | null | undefined,
  packQuantity: string | null | undefined,
): string | null {
  if (
    vendorUnitPriceCents !== null &&
    vendorUnitPriceCents !== undefined &&
    vendorUnitPriceCents >= 0
  ) {
    return String(vendorUnitPriceCents);
  }
  if (
    packQuantity === "1" &&
    vendorPriceCents !== null &&
    vendorPriceCents !== undefined &&
    vendorPriceCents >= 0
  ) {
    return String(vendorPriceCents);
  }
  return null;
}

export function catalogDraftFromInventoryRow(input: {
  sourceSha256: string;
  sourceRow: number;
  row: InventoryNormalizedRow;
}): InventoryCatalogDraft {
  const sku = inventoryImportSku(input.sourceSha256, input.sourceRow);
  const packQuantity = input.row.purchasePackQuantity?.trim() || null;
  const vendorName = input.row.vendorName?.trim() || null;

  return {
    sku,
    countSheetName: countSheetNameFromImport(
      input.row.productName,
      input.row.alias,
    ),
    vendorDescription: input.row.productName,
    category: input.row.category,
    vendorName,
    vendorSku: sku,
    packCode: purchasePackCode(input.row.purchasePackLabel, packQuantity),
    packQuantity,
    unitCostCents: unitCostCentsFromImport(
      input.row.vendorUnitPriceCents,
      input.row.vendorPriceCents,
      packQuantity,
    ),
  };
}
