import { describe, expect, it } from "vitest";
import { proposeInvoicePacket, proposeInvoicesFromPageText, sumProposedMoney } from "./packet";

const restaurantStorePacket = `
Invoice #7-122942301
Order Number: 1014473051
Invoice Date: 12/11/2025
Our Address:
The Restaurant Store
Item Details Quantity Item Price Subtotal
1503598
Choice Kraft Grease-Resistant Window Cookie / Bakery Bag - 500/Case
5 $39.99 $199.95
130TASTERNEO
Choice 3" Neon Plastic Taster Spoon with Assorted Colors - 3,000/Case
1 $24.97 $24.97
Subtotal $1,520.03
Tax $91.21
Total $1,611.24
Invoice #7-122911590
Order Number: 1014473051
Invoice Date: 12/11/2025
Our Address:
The Restaurant Store
Item Details Quantity Item Price Subtotal
485WB7TN
Choice 7 1/2" Translucent Pointed Wrapped Smoothie Straw - 4,500/Case
2 $82.49 $164.98
Subtotal $164.98
Tax $9.90
Total $174.88
Invoice #7-123543408
Order Number: 1014473051
Invoice Date: 12/22/2025
Our Address:
The Restaurant Store
Item Details Quantity Item Price Subtotal
303CPOWDA
Acopa Wood 4-Section Slanted Cup and Lid Organizer
-1 $79.99 $-79.99
500COLLAR
Choice 10-24 oz. Printed Coffee Cup Sleeve / Jacket / Clutch - 1,200/Case
-5 $37.06 $-185.30
Subtotal $-849.63
Tax $-50.98
Total Refunded $-900.61
`;

describe("proposeInvoicesFromPageText", () => {
  it("splits a Restaurant Store order PDF into invoices and credits", () => {
    const invoices = proposeInvoicesFromPageText([
      restaurantStorePacket,
      "continued page with no new invoice header",
    ]);

    expect(invoices.map((invoice) => invoice.invoiceId)).toEqual([
      "7-122942301",
      "7-122911590",
      "7-123543408",
    ]);
    expect(invoices[0]?.total).toBe("$1,611.24");
    expect(invoices[0]?.kind).toBe("invoice");
    expect(invoices[0]?.lines).toHaveLength(2);
    expect(invoices[0]?.lines[0]).toMatchObject({
      productCode: "1503598",
      quantity: "5",
      amount: "$199.95",
    });
    expect(invoices[1]?.total).toBe("$174.88");
    expect(invoices[2]?.kind).toBe("credit");
    expect(invoices[2]?.total).toBe("$-900.61");
    expect(invoices[2]?.lines[0]?.quantity).toBe("-1");
    expect(invoices[0]?.pages).toEqual([1]);
    expect(invoices[2]?.pages).toEqual([1, 2]);

    const totals = sumProposedMoney(invoices);
    expect(totals.invoiceTotalCents).toBe(161_124 + 17_488 - 90_061);
    expect(totals.lineItemsCents).toBe(19_995 + 2_497 + 16_498 - 7_999 - 18_530);
    expect(totals.lineCount).toBe(5);
  });
});

describe("proposeInvoicePacket", () => {
  it("keeps every Azure invoice when the model returns more than one document", () => {
    const packet = proposeInvoicePacket({
      analyzeResult: {
        pages: [{}, {}],
        documents: [
          {
            boundingRegions: [{ pageNumber: 1 }],
            fields: {
              InvoiceId: { content: "#7-122942301" },
              InvoiceTotal: { content: "$1,611.24" },
            },
          },
          {
            boundingRegions: [{ pageNumber: 2 }],
            fields: {
              InvoiceId: { content: "#7-122911590" },
              InvoiceTotal: { content: "$174.88" },
            },
          },
        ],
      },
    });

    expect(packet.invoices).toHaveLength(2);
    expect(packet.invoices[1]?.invoiceId).toBe("#7-122911590");
    expect(packet.invoices[1]?.pages).toEqual([2]);
  });

  it("overlays Azure fields onto invoices split from the original PDF", () => {
    const packet = proposeInvoicePacket({
      pageTexts: [restaurantStorePacket, "", "", "", "", "", "", ""],
      analyzeResult: {
        pages: [{}, {}],
        documents: [
          {
            boundingRegions: [{ pageNumber: 1 }, { pageNumber: 2 }],
            fields: {
              VendorName: { content: "Restaurant The Store®" },
              InvoiceId: { content: "#7-122942301" },
              InvoiceTotal: { content: "$1,611.24" },
              Items: {
                valueArray: [
                  {
                    valueObject: {
                      Description: { content: "Cookie bag" },
                      Quantity: { content: "5" },
                    },
                  },
                ],
              },
            },
          },
        ],
      },
    });

    expect(packet.invoices).toHaveLength(3);
    expect(packet.pageCount).toBe(8);
    expect(packet.analyzedPageCount).toBe(2);
    expect(packet.invoices[0]?.source).toBe("merged");
    expect(packet.invoices[0]?.vendorName).toBe("Restaurant The Store®");
    expect(packet.invoices[0]?.lines[0]?.description).toBe(
      "Choice Kraft Grease-Resistant Window Cookie / Bakery Bag - 500/Case",
    );
    expect(packet.invoices[1]?.source).toBe("original");
  });

  it("keeps original line items when Azure OCR is further from the subtotal", () => {
    const packet = proposeInvoicePacket({
      pageTexts: [restaurantStorePacket],
      analyzeResult: {
        pages: [{}],
        documents: [
          {
            boundingRegions: [{ pageNumber: 1 }],
            fields: {
              InvoiceId: { content: "#7-122942301" },
              SubTotal: { content: "$1,520.03" },
              Items: {
                valueArray: [
                  {
                    valueObject: {
                      Description: { content: "1503598 Cookie bag" },
                      Amount: { content: "$102.45" },
                    },
                  },
                  {
                    valueObject: {
                      Description: { content: "130TASTERNEO Spoon" },
                      Amount: { content: "$24.97" },
                    },
                  },
                ],
              },
            },
          },
        ],
      },
    });

    expect(packet.invoices[0]?.lines[0]).toMatchObject({
      productCode: "1503598",
      amount: "$199.95",
    });
    expect(packet.invoices[0]?.lines[1]?.productCode).toBe("130TASTERNEO");
  });
});
