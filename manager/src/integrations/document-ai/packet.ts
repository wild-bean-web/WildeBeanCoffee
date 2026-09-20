import {
  azurePageCount,
  pagesFromAzureDocument,
  proposeInvoicesFromAnalyzeResult,
  type ProposedDocumentFields,
  type ProposedDocumentLine,
} from "./normalize";
import { parseMoneyToCents } from "@/lib/format";

export type ProposedInvoiceKind = "invoice" | "credit";
export type ProposedInvoiceSource = "azure" | "original" | "merged";

export interface ProposedInvoice extends ProposedDocumentFields {
  kind: ProposedInvoiceKind;
  pages: number[];
  source: ProposedInvoiceSource;
}

export interface ProposedInvoicePacket {
  invoices: ProposedInvoice[];
  pageCount: number;
  analyzedPageCount: number | null;
  truncatedExtraction: boolean;
}

const PAGE_MARK = /<<<PAGE:(\d+)>>>/g;
const MONEY = /\$?-?[\d,]+\.\d{2}/;
const LINE_PATTERN =
  /\b(?!Quantity\b|Item\b|Price\b|Subtotal\b|Details\b)([A-Z0-9][A-Z0-9-]{2,})\s+(.+?)\s+(-?\d+(?:\.\d+)?)\s+(\$-?[\d,]+\.\d{2})\s+(\$-?[\d,]+\.\d{2})/gi;

function invoiceKey(invoiceId: string | null): string | null {
  if (!invoiceId) return null;
  return invoiceId.replace(/^#+/, "").trim().toLowerCase();
}

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function lastLabeled(text: string, label: string): string | null {
  const pattern = new RegExp(
    `${label}\\s+(${MONEY.source})`,
    "gi",
  );
  const matches = [...text.matchAll(pattern)];
  return matches.at(-1)?.[1] ?? null;
}

function firstLabeled(text: string, label: string): string | null {
  const match = text.match(
    new RegExp(`${label}\\s*[:#]?\\s*([^\\n]+)`, "i"),
  );
  const value = match?.[1]?.trim();
  return value ? value.replace(/\s+/g, " ") : null;
}

function parseKindAndTotal(text: string): {
  kind: ProposedInvoiceKind;
  total: string | null;
} {
  const refunded = lastLabeled(text, "Total Refunded");
  if (refunded) {
    return { kind: "credit", total: refunded };
  }
  const total = lastLabeled(text, "Total");
  if (total?.includes("-")) {
    return { kind: "credit", total };
  }
  return { kind: "invoice", total };
}

function looksLikeSku(value: string): boolean {
  if (
    /^(quantity|item|price|subtotal|details|case|pack|our|address|billed)$/i.test(
      value,
    )
  ) {
    return false;
  }
  if (/^\d{1,3}$/.test(value)) return false;
  return /^[A-Z0-9][A-Z0-9-]{3,}$/i.test(value);
}

function parseLines(text: string): ProposedDocumentLine[] {
  const afterItems = text.split(/Item Details/i)[1];
  const itemBlock = afterItems?.split(/Subtotal\s+\$?-?[\d,]+\.\d{2}/i)[0];
  if (!itemBlock) return [];
  const flattened = collapse(itemBlock);
  return [...flattened.matchAll(LINE_PATTERN)]
    .filter((match) => looksLikeSku(match[1] ?? ""))
    .map((match) => ({
      productCode: match[1] ?? null,
      description: match[2]?.trim() ?? null,
      quantity: match[3] ?? null,
      unit: null,
      unitPrice: match[4] ?? null,
      amount: match[5] ?? null,
    }));
}

function pagesInChunk(text: string): number[] {
  const pages = [...text.matchAll(PAGE_MARK)]
    .map((match) => Number(match[1]))
    .filter((page) => page > 0);
  return [...new Set(pages)].sort((left, right) => left - right);
}

function vendorFromText(text: string): string | null {
  if (/The Restaurant Store/i.test(text)) return "The Restaurant Store";
  if (/Restaurant\s+The\s+Store/i.test(text)) return "Restaurant The Store";
  return null;
}

export function proposeInvoicesFromPageText(
  pageTexts: readonly string[],
): ProposedInvoice[] {
  if (pageTexts.length === 0) return [];

  const concatenated = pageTexts
    .map((text, index) => `<<<PAGE:${index + 1}>>>\n${text}`)
    .join("\n");
  const headers = [...concatenated.matchAll(/Invoice\s*#\s*(#?[A-Za-z0-9-]+)/gi)];

  return headers.map((header, index) => {
    const start = header.index ?? 0;
    const end = headers[index + 1]?.index ?? concatenated.length;
    const chunk = concatenated.slice(start, end);
    const pageBefore = [...concatenated.slice(0, start).matchAll(PAGE_MARK)].at(-1);
    const pages = [
      pageBefore ? Number(pageBefore[1]) : 1,
      ...pagesInChunk(chunk),
    ].filter((page) => page > 0);
    const { kind, total } = parseKindAndTotal(chunk);
    return {
      vendorName: vendorFromText(chunk),
      invoiceId: header[1] ?? null,
      invoiceDate: firstLabeled(chunk, "Invoice Date"),
      orderNumber: firstLabeled(chunk, "Order Number"),
      purchaseOrder: firstLabeled(chunk, "Purchase Order"),
      subtotal: lastLabeled(chunk, "Subtotal"),
      tax: lastLabeled(chunk, "Tax"),
      total,
      lines: parseLines(chunk),
      kind,
      pages: [...new Set(pages)].sort((left, right) => left - right),
      source: "original" as const,
    };
  });
}

function fromAzureFields(
  fields: ProposedDocumentFields,
  pages: number[],
): ProposedInvoice {
  const total = fields.total;
  const kind: ProposedInvoiceKind =
    total?.includes("-") || /refund/i.test(total ?? "")
      ? "credit"
      : "invoice";
  return {
    ...fields,
    kind,
    pages,
    source: "azure",
  };
}

function prefer(primary: string | null, fallback: string | null): string | null {
  return primary?.trim() ? primary : fallback;
}

function lineSumCents(lines: readonly ProposedDocumentLine[]): number | null {
  let sum = 0;
  let parsed = 0;
  for (const line of lines) {
    const amount = parseMoneyToCents(line.amount ?? line.unitPrice);
    if (amount === null) continue;
    sum += amount;
    parsed += 1;
  }
  return parsed > 0 ? sum : null;
}

function skuCount(lines: readonly ProposedDocumentLine[]): number {
  return lines.filter((line) => Boolean(line.productCode)).length;
}

function preferLines(
  original: ProposedInvoice,
  azure: ProposedInvoice,
): ProposedDocumentLine[] {
  if (original.lines.length === 0) return azure.lines;
  if (azure.lines.length === 0) return original.lines;

  const target =
    parseMoneyToCents(original.subtotal ?? azure.subtotal) ??
    parseMoneyToCents(original.total ?? azure.total);
  if (target !== null) {
    const originalSum = lineSumCents(original.lines);
    const azureSum = lineSumCents(azure.lines);
    if (originalSum !== null && azureSum !== null) {
      const originalDiff = Math.abs(originalSum - target);
      const azureDiff = Math.abs(azureSum - target);
      if (originalDiff !== azureDiff) {
        return originalDiff < azureDiff ? original.lines : azure.lines;
      }
    }
  }

  if (skuCount(original.lines) !== skuCount(azure.lines)) {
    return skuCount(original.lines) > skuCount(azure.lines)
      ? original.lines
      : azure.lines;
  }

  return azure.lines.length > original.lines.length ? azure.lines : original.lines;
}

function mergeInvoice(
  original: ProposedInvoice | undefined,
  azure: ProposedInvoice,
): ProposedInvoice {
  if (!original) return azure;
  return {
    vendorName: prefer(azure.vendorName, original.vendorName),
    invoiceId: prefer(azure.invoiceId, original.invoiceId),
    invoiceDate: prefer(azure.invoiceDate, original.invoiceDate),
    orderNumber: prefer(azure.orderNumber, original.orderNumber),
    purchaseOrder: prefer(azure.purchaseOrder, original.purchaseOrder),
    subtotal: prefer(azure.subtotal, original.subtotal),
    tax: prefer(azure.tax, original.tax),
    total: prefer(azure.total, original.total),
    lines: preferLines(original, azure),
    kind: original.kind === "credit" || azure.kind === "credit" ? "credit" : "invoice",
    pages: [...new Set([...original.pages, ...azure.pages])].sort(
      (left, right) => left - right,
    ),
    source: "merged",
  };
}

export function proposeInvoicePacket(input: {
  analyzeResult?: unknown;
  pageTexts?: readonly string[];
}): ProposedInvoicePacket {
  const pageTexts = input.pageTexts ?? [];
  const fromOriginal = proposeInvoicesFromPageText(pageTexts);
  const azureDocuments = Array.isArray(
    input.analyzeResult &&
      typeof input.analyzeResult === "object" &&
      input.analyzeResult !== null &&
      "documents" in input.analyzeResult
      ? (input.analyzeResult as { documents: unknown }).documents
      : null,
  )
    ? ((input.analyzeResult as { documents: unknown[] }).documents ?? [])
    : [];
  const fromAzure = proposeInvoicesFromAnalyzeResult(input.analyzeResult).map(
    (fields, index) =>
      fromAzureFields(fields, pagesFromAzureDocument(azureDocuments[index])),
  );

  const merged = new Map<string, ProposedInvoice>();

  for (const invoice of fromOriginal) {
    const key = invoiceKey(invoice.invoiceId);
    if (key) merged.set(key, invoice);
  }

  for (const invoice of fromAzure) {
    const key = invoiceKey(invoice.invoiceId);
    if (!key) continue;
    merged.set(key, mergeInvoice(merged.get(key), invoice));
  }

  const invoices =
    fromOriginal.length > 0
      ? [
          ...fromOriginal.map((invoice) => {
            const key = invoiceKey(invoice.invoiceId);
            return key ? (merged.get(key) ?? invoice) : invoice;
          }),
          ...fromAzure.filter((invoice) => {
            const key = invoiceKey(invoice.invoiceId);
            return !key || !fromOriginal.some(
              (original) => invoiceKey(original.invoiceId) === key,
            );
          }),
        ]
      : fromAzure;

  const pageCount = pageTexts.length;
  const analyzedPageCount = azurePageCount(input.analyzeResult ?? null);

  return {
    invoices,
    pageCount,
    analyzedPageCount,
    truncatedExtraction:
      pageCount > 0 &&
      analyzedPageCount !== null &&
      analyzedPageCount < pageCount,
  };
}

export interface ProposedMoneyTotals {
  invoiceTotalCents: number;
  invoiceTotalsParsed: number;
  invoiceTotalsMissing: number;
  lineItemsCents: number;
  lineItemsParsed: number;
  lineItemsMissing: number;
  lineCount: number;
}

export function sumProposedMoney(
  invoices: readonly ProposedInvoice[],
): ProposedMoneyTotals {
  let invoiceTotalCents = 0;
  let invoiceTotalsParsed = 0;
  let invoiceTotalsMissing = 0;
  let lineItemsCents = 0;
  let lineItemsParsed = 0;
  let lineItemsMissing = 0;
  let lineCount = 0;

  for (const invoice of invoices) {
    const total = parseMoneyToCents(invoice.total);
    if (total === null) {
      invoiceTotalsMissing += 1;
    } else {
      invoiceTotalCents += total;
      invoiceTotalsParsed += 1;
    }

    for (const line of invoice.lines) {
      lineCount += 1;
      const amount = parseMoneyToCents(line.amount ?? line.unitPrice);
      if (amount === null) {
        lineItemsMissing += 1;
      } else {
        lineItemsCents += amount;
        lineItemsParsed += 1;
      }
    }
  }

  return {
    invoiceTotalCents,
    invoiceTotalsParsed,
    invoiceTotalsMissing,
    lineItemsCents,
    lineItemsParsed,
    lineItemsMissing,
    lineCount,
  };
}
