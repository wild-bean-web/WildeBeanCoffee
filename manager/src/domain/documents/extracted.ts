import { z } from "zod";

import {
  CurrencyCodeSchema,
  IsoDateSchema,
  NonBlankStringSchema,
  NonNegativeCentsSchema,
  PositiveFixedDecimalStringSchema,
} from "../shared";

const ShortTextSchema = z.string().trim().min(1).max(128);

export const PackSchema = z
  .object({
    quantity: PositiveFixedDecimalStringSchema,
    unit: z
      .string()
      .trim()
      .min(1)
      .max(24)
      .regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/),
  })
  .strict();

export type Pack = z.infer<typeof PackSchema>;

export const ExtractedPartySchema = z
  .object({
    name: NonBlankStringSchema,
    taxId: ShortTextSchema.optional(),
    accountNumber: ShortTextSchema.optional(),
  })
  .strict();

export const ExtractedInvoiceLineSchema = z
  .object({
    sourceLineId: ShortTextSchema,
    description: NonBlankStringSchema,
    vendorSku: ShortTextSchema.optional(),
    quantity: PositiveFixedDecimalStringSchema,
    pack: PackSchema.optional(),
    unitPriceCents: NonNegativeCentsSchema,
    lineSubtotalCents: NonNegativeCentsSchema,
  })
  .strict();

export type ExtractedInvoiceLine = z.infer<
  typeof ExtractedInvoiceLineSchema
>;

export const ExtractedReceiptLineSchema = z
  .object({
    sourceLineId: ShortTextSchema,
    description: NonBlankStringSchema,
    vendorSku: ShortTextSchema.optional(),
    quantity: PositiveFixedDecimalStringSchema,
    pack: PackSchema.optional(),
    unitPriceCents: NonNegativeCentsSchema,
    lineSubtotalCents: NonNegativeCentsSchema,
  })
  .strict();

export type ExtractedReceiptLine = z.infer<
  typeof ExtractedReceiptLineSchema
>;

const ExtractedInvoiceLinesSchema = z
  .array(ExtractedInvoiceLineSchema)
  .min(1)
  .max(1_000)
  .refine(hasUniqueSourceLineIds, "Invoice source line IDs must be unique");

const ExtractedReceiptLinesSchema = z
  .array(ExtractedReceiptLineSchema)
  .max(1_000)
  .refine(hasUniqueSourceLineIds, "Receipt source line IDs must be unique");

export const ExtractedInvoiceSchema = z
  .object({
    schemaVersion: z.literal(1),
    documentType: z.literal("invoice"),
    vendor: ExtractedPartySchema,
    invoiceNumber: ShortTextSchema,
    purchaseOrderNumber: ShortTextSchema.optional(),
    issuedDate: IsoDateSchema,
    dueDate: IsoDateSchema.optional(),
    currency: CurrencyCodeSchema,
    lines: ExtractedInvoiceLinesSchema,
    subtotalCents: NonNegativeCentsSchema,
    discountCents: NonNegativeCentsSchema.default(0),
    shippingCents: NonNegativeCentsSchema.default(0),
    taxCents: NonNegativeCentsSchema.default(0),
    totalCents: NonNegativeCentsSchema,
  })
  .strict();

export type ExtractedInvoice = z.infer<typeof ExtractedInvoiceSchema>;

export const ExtractedReceiptSchema = z
  .object({
    schemaVersion: z.literal(1),
    documentType: z.literal("receipt"),
    merchant: ExtractedPartySchema,
    receiptNumber: ShortTextSchema.optional(),
    transactionDate: IsoDateSchema,
    currency: CurrencyCodeSchema,
    lines: ExtractedReceiptLinesSchema.default([]),
    subtotalCents: NonNegativeCentsSchema,
    discountCents: NonNegativeCentsSchema.default(0),
    taxCents: NonNegativeCentsSchema.default(0),
    tipCents: NonNegativeCentsSchema.default(0),
    totalCents: NonNegativeCentsSchema,
  })
  .strict();

export type ExtractedReceipt = z.infer<typeof ExtractedReceiptSchema>;

export const ExtractedDocumentSchema = z.discriminatedUnion("documentType", [
  ExtractedInvoiceSchema,
  ExtractedReceiptSchema,
]);

export type ExtractedDocument = z.infer<typeof ExtractedDocumentSchema>;

function hasUniqueSourceLineIds(
  lines: readonly { readonly sourceLineId: string }[],
): boolean {
  return new Set(lines.map((line) => line.sourceLineId)).size === lines.length;
}
