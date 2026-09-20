import { z } from "zod";

import {
  isWithinCentsTolerance,
  multiplyCentsByQuantity,
  NonNegativeCentsSchema,
  sumCents,
} from "../shared";
import {
  ExtractedDocument,
  ExtractedDocumentSchema,
  ExtractedInvoice,
  ExtractedReceipt,
} from "./extracted";

export const ArithmeticIssueCodeSchema = z.enum([
  "line_subtotal_mismatch",
  "document_subtotal_mismatch",
  "document_total_mismatch",
  "amount_out_of_range",
]);

export type ArithmeticIssueCode = z.infer<
  typeof ArithmeticIssueCodeSchema
>;

export interface ArithmeticIssue {
  readonly code: ArithmeticIssueCode;
  readonly path: string;
  readonly expectedCents?: number;
  readonly actualCents: number;
  readonly deltaCents?: number;
}

export interface ArithmeticValidationResult {
  readonly valid: boolean;
  readonly roundingPolicy: "half_up_to_cent";
  readonly computedLineSubtotalsCents: Readonly<Record<string, number>>;
  readonly computedSubtotalCents?: number;
  readonly computedTotalCents?: number;
  readonly issues: readonly ArithmeticIssue[];
}

export function validateDocumentArithmetic(
  document: ExtractedDocument,
  toleranceCents = 0,
): ArithmeticValidationResult {
  const parsed = ExtractedDocumentSchema.parse(document);
  const tolerance = NonNegativeCentsSchema.parse(toleranceCents);

  return parsed.documentType === "invoice"
    ? validateInvoiceArithmetic(parsed, tolerance)
    : validateReceiptArithmetic(parsed, tolerance);
}

export function validateInvoiceArithmetic(
  invoice: ExtractedInvoice,
  toleranceCents = 0,
): ArithmeticValidationResult {
  const parsed = ExtractedDocumentSchema.parse(invoice);
  if (parsed.documentType !== "invoice") {
    throw new TypeError("Expected an extracted invoice");
  }
  return validateParsedDocument(parsed, NonNegativeCentsSchema.parse(toleranceCents));
}

export function validateReceiptArithmetic(
  receipt: ExtractedReceipt,
  toleranceCents = 0,
): ArithmeticValidationResult {
  const parsed = ExtractedDocumentSchema.parse(receipt);
  if (parsed.documentType !== "receipt") {
    throw new TypeError("Expected an extracted receipt");
  }
  return validateParsedDocument(parsed, NonNegativeCentsSchema.parse(toleranceCents));
}

function validateParsedDocument(
  document: ExtractedDocument,
  toleranceCents: number,
): ArithmeticValidationResult {
  const issues: ArithmeticIssue[] = [];
  const computedLineSubtotalsCents: Record<string, number> = {};

  for (let index = 0; index < document.lines.length; index += 1) {
    const line = document.lines[index];
    try {
      const expected = multiplyCentsByQuantity(
        line.unitPriceCents,
        line.quantity,
      );
      computedLineSubtotalsCents[line.sourceLineId] = expected;

      if (
        !isWithinCentsTolerance(
          expected,
          line.lineSubtotalCents,
          toleranceCents,
        )
      ) {
        issues.push({
          code: "line_subtotal_mismatch",
          path: `lines.${index}.lineSubtotalCents`,
          expectedCents: expected,
          actualCents: line.lineSubtotalCents,
          deltaCents: line.lineSubtotalCents - expected,
        });
      }
    } catch (error) {
      if (!(error instanceof RangeError)) {
        throw error;
      }
      issues.push({
        code: "amount_out_of_range",
        path: `lines.${index}.lineSubtotalCents`,
        actualCents: line.lineSubtotalCents,
      });
    }
  }

  let computedSubtotalCents: number | undefined;
  if (document.lines.length > 0) {
    try {
      computedSubtotalCents = sumCents(
        document.lines.map((line) => line.lineSubtotalCents),
      );
      if (
        !isWithinCentsTolerance(
          computedSubtotalCents,
          document.subtotalCents,
          toleranceCents,
        )
      ) {
        issues.push({
          code: "document_subtotal_mismatch",
          path: "subtotalCents",
          expectedCents: computedSubtotalCents,
          actualCents: document.subtotalCents,
          deltaCents: document.subtotalCents - computedSubtotalCents,
        });
      }
    } catch (error) {
      if (!(error instanceof RangeError)) {
        throw error;
      }
      issues.push({
        code: "amount_out_of_range",
        path: "subtotalCents",
        actualCents: document.subtotalCents,
      });
    }
  }

  let computedTotalCents: number | undefined;
  try {
    const additions =
      document.documentType === "invoice"
        ? [document.shippingCents, document.taxCents]
        : [document.taxCents, document.tipCents];

    computedTotalCents = sumCents([
      document.subtotalCents,
      -document.discountCents,
      ...additions,
    ]);

    if (
      !isWithinCentsTolerance(
        computedTotalCents,
        document.totalCents,
        toleranceCents,
      )
    ) {
      issues.push({
        code: "document_total_mismatch",
        path: "totalCents",
        expectedCents: computedTotalCents,
        actualCents: document.totalCents,
        deltaCents: document.totalCents - computedTotalCents,
      });
    }
  } catch (error) {
    if (!(error instanceof RangeError)) {
      throw error;
    }
    issues.push({
      code: "amount_out_of_range",
      path: "totalCents",
      actualCents: document.totalCents,
    });
  }

  return {
    valid: issues.length === 0,
    roundingPolicy: "half_up_to_cent",
    computedLineSubtotalsCents,
    computedSubtotalCents,
    computedTotalCents,
    issues,
  };
}
