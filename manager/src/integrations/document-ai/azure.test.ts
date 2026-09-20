import { describe, expect, it, vi } from "vitest";
import { AzureDocumentIntelligenceProvider } from "./azure";

describe("AzureDocumentIntelligenceProvider", () => {
  it("submits base64 content and returns a completed extraction", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 202,
          headers: {
            "operation-location":
              "https://example.cognitiveservices.azure.com/documentintelligence/documentModels/prebuilt-invoice/analyzeResults/op-1?api-version=2024-11-30",
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          status: "succeeded",
          analyzeResult: { documents: [{ fields: {} }] },
        }),
      );

    const provider = new AzureDocumentIntelligenceProvider({
      endpoint: "https://example.cognitiveservices.azure.com",
      apiKey: "test-key",
      pollIntervalMs: 0,
      fetchImplementation: request,
    });

    const result = await provider.analyze({
      bytes: new TextEncoder().encode("invoice"),
      mimeType: "application/pdf",
      model: "invoice",
    });

    expect(result).toMatchObject({
      provider: "azure-document-intelligence",
      providerApiVersion: "2024-11-30",
      providerModelId: "prebuilt-invoice",
      operationId: "op-1",
    });
    expect(request).toHaveBeenCalledTimes(2);
    const [, options] = request.mock.calls[0];
    expect(String(options?.body)).toContain("base64Source");
  });

  it("rejects a provider-controlled polling URL on another origin", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, {
        status: 202,
        headers: {
          "operation-location":
            "https://malicious.example/analyzeResults/op-1",
        },
      }),
    );
    const provider = new AzureDocumentIntelligenceProvider({
      endpoint: "https://example.cognitiveservices.azure.com",
      apiKey: "test-key",
      fetchImplementation: request,
    });

    await expect(
      provider.analyze({
        bytes: new Uint8Array([1]),
        mimeType: "image/jpeg",
        model: "receipt",
      }),
    ).rejects.toThrow("unexpected operation URL");
  });
});
