import { z } from "zod";
import type {
  AnalyzeDocumentInput,
  AnalyzeDocumentResult,
  DocumentExtractionProvider,
} from "./provider";

const API_VERSION = "2024-11-30";
const statusSchema = z.object({
  status: z.enum(["notStarted", "running", "succeeded", "failed"]),
  analyzeResult: z.unknown().optional(),
  error: z
    .object({
      code: z.string().optional(),
      message: z.string().optional(),
    })
    .optional(),
});

export interface AzureDocumentIntelligenceOptions {
  endpoint: string;
  apiKey: string;
  pollIntervalMs?: number;
  maxWaitMs?: number;
  fetchImplementation?: typeof fetch;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function modelId(model: AnalyzeDocumentInput["model"]): string {
  return model === "receipt" ? "prebuilt-receipt" : "prebuilt-invoice";
}

function operationId(location: string): string | null {
  const match = location.match(/analyzeResults\/([^/?]+)/i);
  return match?.[1] ?? null;
}

export class AzureDocumentIntelligenceProvider
  implements DocumentExtractionProvider
{
  private readonly endpoint: URL;
  private readonly request: typeof fetch;
  private readonly pollIntervalMs: number;
  private readonly maxWaitMs: number;

  constructor(private readonly options: AzureDocumentIntelligenceOptions) {
    this.endpoint = new URL(options.endpoint.replace(/\/+$/, ""));
    this.request = options.fetchImplementation ?? fetch;
    this.pollIntervalMs = options.pollIntervalMs ?? 1_000;
    this.maxWaitMs = options.maxWaitMs ?? 90_000;
  }

  async analyze(
    input: AnalyzeDocumentInput,
  ): Promise<AnalyzeDocumentResult> {
    const selectedModel = modelId(input.model);
    const analyzeUrl = new URL(
      `/documentintelligence/documentModels/${selectedModel}:analyze`,
      this.endpoint,
    );
    analyzeUrl.searchParams.set("_overload", "analyzeDocument");
    analyzeUrl.searchParams.set("api-version", API_VERSION);
    analyzeUrl.searchParams.set("locale", "en-US");

    const startResponse = await this.request(analyzeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Ocp-Apim-Subscription-Key": this.options.apiKey,
      },
      body: JSON.stringify({
        base64Source: Buffer.from(input.bytes).toString("base64"),
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (startResponse.status !== 202) {
      throw new Error(
        `Document extraction request failed with status ${startResponse.status}.`,
      );
    }

    const location = startResponse.headers.get("operation-location");
    if (!location) {
      throw new Error("Document extraction did not return an operation URL.");
    }

    const pollUrl = new URL(location);
    if (pollUrl.origin !== this.endpoint.origin) {
      throw new Error("Document extraction returned an unexpected operation URL.");
    }

    const startedAt = Date.now();
    while (Date.now() - startedAt < this.maxWaitMs) {
      await delay(this.pollIntervalMs);
      const pollResponse = await this.request(pollUrl, {
        headers: {
          "Ocp-Apim-Subscription-Key": this.options.apiKey,
        },
        signal: AbortSignal.timeout(30_000),
      });

      if (!pollResponse.ok) {
        throw new Error(
          `Document extraction polling failed with status ${pollResponse.status}.`,
        );
      }

      const status = statusSchema.parse(await pollResponse.json());
      if (status.status === "failed") {
        throw new Error(
          `Document extraction failed: ${status.error?.code ?? "provider_error"}.`,
        );
      }
      if (status.status === "succeeded") {
        return {
          provider: "azure-document-intelligence",
          providerApiVersion: API_VERSION,
          providerModelId: selectedModel,
          operationId: operationId(location),
          analyzedAt: new Date().toISOString(),
          result: status.analyzeResult,
        };
      }
    }

    throw new Error("Document extraction timed out and may be retried.");
  }
}
