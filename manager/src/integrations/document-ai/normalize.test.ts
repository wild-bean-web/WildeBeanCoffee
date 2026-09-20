import { describe, expect, it } from "vitest";
import { proposeFieldsFromAnalyzeResult } from "./normalize";

describe("proposeFieldsFromAnalyzeResult", () => {
  it("reads invoice header and line items from Azure Document Intelligence output", () => {
    const proposed = proposeFieldsFromAnalyzeResult({
      documents: [
        {
          fields: {
            VendorName: { content: "Restaurant Store" },
            InvoiceId: { valueString: "1014473051" },
            InvoiceDate: { valueDate: "2026-09-01" },
            InvoiceTotal: {
              valueCurrency: { amount: 128.4, currencyCode: "USD" },
            },
            Items: {
              valueArray: [
                {
                  valueObject: {
                    Description: { content: "Oat milk" },
                    Quantity: { content: "2" },
                    Amount: {
                      valueCurrency: { amount: 24, currencySymbol: "$" },
                    },
                  },
                },
              ],
            },
          },
        },
      ],
    });

    expect(proposed.vendorName).toBe("Restaurant Store");
    expect(proposed.invoiceId).toBe("1014473051");
    expect(proposed.invoiceDate).toBe("2026-09-01");
    expect(proposed.total).toBe("128.4 USD");
    expect(proposed.lines).toEqual([
      {
        description: "Oat milk",
        quantity: "2",
        unit: null,
        unitPrice: null,
        amount: "$24",
        productCode: null,
      },
    ]);
  });

  it("returns empty proposals when Azure output is missing", () => {
    expect(proposeFieldsFromAnalyzeResult(null)).toEqual({
      vendorName: null,
      invoiceId: null,
      invoiceDate: null,
      orderNumber: null,
      purchaseOrder: null,
      subtotal: null,
      tax: null,
      total: null,
      lines: [],
    });
  });
});
