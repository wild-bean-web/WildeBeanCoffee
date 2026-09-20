export interface ProposedDocumentLine {
  description: string | null;
  quantity: string | null;
  unit: string | null;
  unitPrice: string | null;
  amount: string | null;
  productCode: string | null;
}

export interface ProposedDocumentFields {
  vendorName: string | null;
  invoiceId: string | null;
  invoiceDate: string | null;
  orderNumber: string | null;
  purchaseOrder: string | null;
  subtotal: string | null;
  tax: string | null;
  total: string | null;
  lines: ProposedDocumentLine[];
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim().replace(/\s+/g, " ");
    }
  }
  return null;
}

function fieldContent(field: unknown): string | null {
  if (!isRecord(field)) return null;

  const currency = isRecord(field.valueCurrency) ? field.valueCurrency : null;
  const amount =
    currency && typeof currency.amount === "number"
      ? typeof currency.currencySymbol === "string"
        ? `${currency.currencySymbol}${currency.amount}`
        : typeof currency.currencyCode === "string"
          ? `${currency.amount} ${currency.currencyCode}`
          : String(currency.amount)
      : null;

  return firstString(
    field.content,
    field.valueString,
    field.valueDate,
    field.valuePhoneNumber,
    typeof field.valueNumber === "number" ? String(field.valueNumber) : null,
    amount,
  );
}

function azureDocuments(analyzeResult: unknown): JsonRecord[] {
  if (!isRecord(analyzeResult)) return [];
  if (Array.isArray(analyzeResult.documents)) {
    return analyzeResult.documents.filter(isRecord);
  }
  if (isRecord(analyzeResult.fields)) return [analyzeResult];
  return [];
}

function readFields(documentOrResult: unknown): JsonRecord {
  if (!isRecord(documentOrResult)) return {};
  if (isRecord(documentOrResult.fields)) return documentOrResult.fields;
  const documents = azureDocuments(documentOrResult);
  if (documents[0] && isRecord(documents[0].fields)) {
    return documents[0].fields;
  }
  return {};
}

export function pagesFromAzureDocument(document: unknown): number[] {
  if (!isRecord(document) || !Array.isArray(document.boundingRegions)) {
    return [];
  }
  const pages = document.boundingRegions
    .map((region) =>
      isRecord(region) && typeof region.pageNumber === "number"
        ? region.pageNumber
        : null,
    )
    .filter((page): page is number => page !== null && page > 0);
  return [...new Set(pages)].sort((left, right) => left - right);
}

export function proposedFieldsFromAzureDocument(
  document: unknown,
): ProposedDocumentFields {
  const fields = readFields(document);
  const itemsField = fields.Items;
  const itemArray =
    isRecord(itemsField) && Array.isArray(itemsField.valueArray)
      ? itemsField.valueArray
      : [];

  return {
    vendorName: namedField(fields, "VendorName", "MerchantName", "SupplierName"),
    invoiceId: namedField(fields, "InvoiceId", "InvoiceNumber"),
    invoiceDate: namedField(
      fields,
      "InvoiceDate",
      "TransactionDate",
      "BillingDate",
    ),
    orderNumber: namedField(fields, "OrderNumber"),
    purchaseOrder: namedField(fields, "PurchaseOrder"),
    subtotal: namedField(fields, "SubTotal", "Subtotal"),
    tax: namedField(fields, "TotalTax", "Tax"),
    total: namedField(
      fields,
      "InvoiceTotal",
      "TotalRefunded",
      "Total",
      "AmountDue",
    ),
    lines: itemArray.map(lineFromObject),
  };
}

export function proposeInvoicesFromAnalyzeResult(
  analyzeResult: unknown,
): ProposedDocumentFields[] {
  const documents = azureDocuments(analyzeResult);
  if (documents.length === 0) {
    const fallback = proposedFieldsFromAzureDocument(analyzeResult);
    const empty =
      !fallback.invoiceId &&
      !fallback.total &&
      fallback.lines.length === 0;
    return empty ? [] : [fallback];
  }
  return documents.map(proposedFieldsFromAzureDocument);
}

function namedField(fields: JsonRecord, ...names: string[]): string | null {
  for (const name of names) {
    const content = fieldContent(fields[name]);
    if (content) return content;
  }
  return null;
}

function lineFromObject(value: unknown): ProposedDocumentLine {
  const fields = isRecord(value) && isRecord(value.valueObject)
    ? value.valueObject
    : isRecord(value)
      ? value
      : {};
  return {
    description: namedField(fields, "Description", "Name", "ItemName"),
    quantity: namedField(fields, "Quantity"),
    unit: namedField(fields, "Unit", "QuantityUnit"),
    unitPrice: namedField(fields, "UnitPrice", "Price"),
    amount: namedField(fields, "Amount", "TotalPrice", "LineTotal"),
    productCode: namedField(fields, "ProductCode", "SKU"),
  };
}

export function proposeFieldsFromAnalyzeResult(
  analyzeResult: unknown,
): ProposedDocumentFields {
  return (
    proposeInvoicesFromAnalyzeResult(analyzeResult)[0] ?? {
      vendorName: null,
      invoiceId: null,
      invoiceDate: null,
      orderNumber: null,
      purchaseOrder: null,
      subtotal: null,
      tax: null,
      total: null,
      lines: [],
    }
  );
}

export function azurePageCount(analyzeResult: unknown): number | null {
  if (!isRecord(analyzeResult) || !Array.isArray(analyzeResult.pages)) {
    return null;
  }
  return analyzeResult.pages.length;
}
