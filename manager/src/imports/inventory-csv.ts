import { parse } from "csv-parse/sync";
import { z } from "zod";

const sourceRowSchema = z.object({
  Category: z.string().trim(),
  "Product Name": z.string().trim().min(1),
  Units: z.string().trim(),
  "Units (NUM)": z.string().trim(),
  Vendor: z.string().trim(),
  "Vendor Price": z.string().trim(),
  "Vendor Price / Unit": z.string().trim(),
  AKA: z.string().trim(),
});

export interface InventoryImportCandidate {
  sourceRow: number;
  category: string;
  productName: string;
  alias: string | null;
  purchasePackLabel: string;
  purchasePackQuantity: string | null;
  vendorName: string | null;
  vendorPriceCents: number | null;
  vendorUnitPriceCents: number | null;
  issues: string[];
  provenance: "imported";
}

function currencyToCents(value: string): number | null {
  const normalized = value.replace(/[$,\s]/g, "");
  if (!normalized) return null;
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) return null;
  return Math.round(numeric * 100);
}

function positiveDecimal(value: string): string | null {
  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) return null;
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return normalized;
}

function locateHeader(rows: string[][]): number {
  const index = rows.findIndex(
    (row) =>
      row.some((cell) => cell.trim() === "Category") &&
      row.some((cell) => cell.trim() === "Product Name"),
  );
  if (index < 0) {
    throw new Error("Inventory header row was not found.");
  }
  return index;
}

export function parseInventoryCsv(csv: string): InventoryImportCandidate[] {
  const rows = parse(csv, {
    bom: true,
    relax_column_count: true,
    skip_empty_lines: false,
  }) as string[][];
  const headerIndex = locateHeader(rows);
  const headers = rows[headerIndex].map((value) => value.trim());
  const candidates: InventoryImportCandidate[] = [];

  for (let index = headerIndex + 1; index < rows.length; index += 1) {
    const row = rows[index];
    const rawRecord = Object.fromEntries(
      headers.map((header, columnIndex) => [
        header,
        String(row[columnIndex] ?? ""),
      ]),
    );
    const parsed = sourceRowSchema.safeParse(rawRecord);
    if (!parsed.success) continue;

    const source = parsed.data;
    const packQuantity = positiveDecimal(source["Units (NUM)"]);
    const vendorPriceCents = currencyToCents(source["Vendor Price"]);
    const vendorUnitPriceCents = currencyToCents(
      source["Vendor Price / Unit"],
    );
    const issues: string[] = [];

    if (!packQuantity) issues.push("missing_or_invalid_pack_quantity");
    if (!source.Units) issues.push("missing_purchase_pack_label");
    if (!source.Vendor) issues.push("missing_vendor");
    if (vendorPriceCents === null) issues.push("missing_or_invalid_vendor_price");

    if (
      packQuantity &&
      vendorPriceCents !== null &&
      vendorUnitPriceCents !== null
    ) {
      const expected = Math.round(
        vendorPriceCents / Number.parseFloat(packQuantity),
      );
      if (Math.abs(expected - vendorUnitPriceCents) > 1) {
        issues.push("unit_price_does_not_reconcile");
      }
    }

    const alias = source.AKA || null;
    if (
      alias &&
      alias.localeCompare(source["Product Name"], undefined, {
        sensitivity: "base",
      }) === 0
    ) {
      issues.push("alias_duplicates_product_name");
    }

    candidates.push({
      sourceRow: index + 1,
      category: source.Category || "Uncategorized",
      productName: source["Product Name"],
      alias,
      purchasePackLabel: source.Units,
      purchasePackQuantity: packQuantity,
      vendorName: source.Vendor || null,
      vendorPriceCents,
      vendorUnitPriceCents,
      issues,
      provenance: "imported",
    });
  }

  return candidates;
}

export function summarizeInventoryCandidates(
  candidates: readonly InventoryImportCandidate[],
) {
  const issueCounts = new Map<string, number>();
  for (const candidate of candidates) {
    for (const issue of candidate.issues) {
      issueCounts.set(issue, (issueCounts.get(issue) ?? 0) + 1);
    }
  }

  return {
    productCandidates: candidates.length,
    vendors: [...new Set(candidates.flatMap((item) => item.vendorName ?? []))]
      .sort()
      .map((name) => name),
    categories: [...new Set(candidates.map((item) => item.category))].sort(),
    issueCounts: Object.fromEntries(
      [...issueCounts.entries()].sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    ),
  };
}
