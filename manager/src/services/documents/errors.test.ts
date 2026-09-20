import { describe, expect, it } from "vitest";
import { DocumentServiceError } from "./errors";

describe("document service errors", () => {
  it("marks exact-content duplicates as a conflict the UI can show", () => {
    const error = new DocumentServiceError(
      "This file is already stored for this location. Delete or void the existing copy before uploading it again.",
      409,
      "DUPLICATE_DOCUMENT",
      { existingDocumentId: "doc-1" },
    );

    expect(error.status).toBe(409);
    expect(error.code).toBe("DUPLICATE_DOCUMENT");
    expect(error.details?.existingDocumentId).toBe("doc-1");
  });
});
