export interface MatchingCandidate {
  productId: string;
  productName: string;
  vendorDescription: string;
  vendorSku: string;
}

export interface MatchingLine {
  documentLineId: string;
  sourceLineId: string;
  invoiceLabel: string | null;
  vendorDescription: string;
  vendorSku: string | null;
  quantity: string | null;
  unit: string | null;
  amountCents: number | null;
  suggestedAka: string;
  status: "confirmed" | "remembered" | "suggested" | "unmatched";
  productId: string | null;
  akaName: string | null;
  vendorItemId: string | null;
  candidates: MatchingCandidate[];
}

export interface DocumentMatchingWorkspace {
  documentId: string;
  status: string;
  vendorName: string;
  mappedCount: number;
  lineCount: number;
  canApprove: boolean;
  lines: MatchingLine[];
  catalog: Array<{ id: string; name: string; sku: string }>;
}
