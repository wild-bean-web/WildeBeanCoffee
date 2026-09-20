import { parse } from "csv-parse/sync";

export interface HistoricalPurchaseCandidate {
  sourceRow: number;
  purchaseDate: string;
  category: string;
  description: string;
  vendor: string | null;
  orderNumber: string | null;
  invoiceNumber: string | null;
  quantity: string | null;
  unitCostCents: number | null;
  taxCents: number;
  shippingCents: number;
  allInTotalCents: number | null;
  issues: string[];
  provenance: "imported";
}

function moneyToCents(value: string): number | null {
  const normalized = value.replace(/[$,\s]/g, "");
  if (!normalized) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
}

function decimal(value: string): string | null {
  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) return null;
  return Number.isFinite(Number(normalized)) ? normalized : null;
}

function normalizeDate(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, month, day, year] = match;
  const date = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day)),
  );
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    return null;
  }
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function parseOneTimePurchasesCsv(
  csv: string,
): HistoricalPurchaseCandidate[] {
  const rows = parse(csv, {
    bom: true,
    relax_column_count: true,
    skip_empty_lines: false,
  }) as string[][];
  const headerIndex = rows.findIndex(
    (row) =>
      row[0]?.trim() === "Purchase Date" &&
      row[2]?.trim() === "Item / Description",
  );

  if (headerIndex < 0) {
    throw new Error("One-time purchase header row was not found.");
  }

  const candidates: HistoricalPurchaseCandidate[] = [];
  let currentSection = "Uncategorized";

  for (let index = headerIndex + 1; index < rows.length; index += 1) {
    const row = rows[index].map((cell) => String(cell ?? "").trim());
    const purchaseDate = normalizeDate(row[0] ?? "");

    if (!purchaseDate) {
      if (
        row[0] &&
        !row[0].toLowerCase().startsWith("total") &&
        row.slice(1).every((value) => !value)
      ) {
        currentSection = row[0];
      }
      continue;
    }

    const quantity = decimal(row[6] ?? "");
    const unitCostCents = moneyToCents(row[7] ?? "");
    const taxCents = moneyToCents(row[8] ?? "") ?? 0;
    const shippingCents = moneyToCents(row[9] ?? "") ?? 0;
    const allInTotalCents = moneyToCents(row[10] ?? "");
    const issues: string[] = [];

    if (!row[2]) issues.push("missing_description");
    if (!row[3]) issues.push("missing_vendor");
    if (!quantity) issues.push("missing_or_invalid_quantity");
    if (unitCostCents === null) issues.push("missing_or_invalid_unit_cost");
    if (allInTotalCents === null) issues.push("missing_or_invalid_total");

    if (
      quantity &&
      unitCostCents !== null &&
      allInTotalCents !== null
    ) {
      const expected =
        Math.round(Number(quantity) * unitCostCents) +
        taxCents +
        shippingCents;
      if (Math.abs(expected - allInTotalCents) > 2) {
        issues.push("line_total_does_not_reconcile");
      }
    }

    const quantityNumber = quantity ? Number(quantity) : null;
    if (
      quantityNumber === 0 &&
      allInTotalCents !== null &&
      allInTotalCents !== 0
    ) {
      issues.push("zero_quantity_with_nonzero_total");
    }

    candidates.push({
      sourceRow: index + 1,
      purchaseDate,
      category: row[1] || currentSection,
      description: row[2],
      vendor: row[3] || null,
      orderNumber: row[4] && row[4] !== "NA" ? row[4] : null,
      invoiceNumber: row[5] && row[5] !== "NA" ? row[5] : null,
      quantity,
      unitCostCents,
      taxCents,
      shippingCents,
      allInTotalCents,
      issues,
      provenance: "imported",
    });
  }

  return candidates;
}

export function summarizeHistoricalPurchases(
  candidates: readonly HistoricalPurchaseCandidate[],
) {
  const issueCounts = new Map<string, number>();
  let totalCents = 0;
  for (const candidate of candidates) {
    totalCents += candidate.allInTotalCents ?? 0;
    for (const issue of candidate.issues) {
      issueCounts.set(issue, (issueCounts.get(issue) ?? 0) + 1);
    }
  }

  return {
    purchaseLines: candidates.length,
    importedTotalCents: totalCents,
    vendors: [...new Set(candidates.flatMap((item) => item.vendor ?? []))].sort(),
    issueCounts: Object.fromEntries([...issueCounts.entries()].sort()),
  };
}
