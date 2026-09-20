export type ExtractionModel = "invoice" | "receipt";

export interface AnalyzeDocumentInput {
  bytes: Uint8Array;
  mimeType: string;
  model: ExtractionModel;
}

export interface AnalyzeDocumentResult {
  provider: string;
  providerApiVersion: string;
  providerModelId: string;
  operationId: string | null;
  analyzedAt: string;
  result: unknown;
}

export interface DocumentExtractionProvider {
  analyze(input: AnalyzeDocumentInput): Promise<AnalyzeDocumentResult>;
}

export class DisabledDocumentExtractionProvider
  implements DocumentExtractionProvider
{
  async analyze(): Promise<never> {
    throw new Error(
      "Document extraction is disabled. The secured source remains queued.",
    );
  }
}
