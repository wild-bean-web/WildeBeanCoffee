import "server-only";

import { getServerEnv } from "@/lib/env";
import { AzureDocumentIntelligenceProvider } from "./azure";
import {
  DisabledDocumentExtractionProvider,
  type DocumentExtractionProvider,
} from "./provider";

export function createDocumentExtractionProvider(): DocumentExtractionProvider {
  const env = getServerEnv();
  if (env.DOCUMENT_AI_PROVIDER === "disabled") {
    return new DisabledDocumentExtractionProvider();
  }

  if (
    !env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT ||
    !env.AZURE_DOCUMENT_INTELLIGENCE_KEY
  ) {
    throw new Error("Azure document extraction is not configured.");
  }

  return new AzureDocumentIntelligenceProvider({
    endpoint: env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT,
    apiKey: env.AZURE_DOCUMENT_INTELLIGENCE_KEY,
  });
}

export type {
  AnalyzeDocumentInput,
  AnalyzeDocumentResult,
  DocumentExtractionProvider,
  ExtractionModel,
} from "./provider";
