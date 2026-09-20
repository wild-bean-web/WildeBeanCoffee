import { describe, expect, it } from "vitest";
import {
  detectSupportedMimeType,
  validateSourceFile,
} from "./file-validation";

describe("source file validation", () => {
  it("detects supported image and PDF signatures", () => {
    expect(detectSupportedMimeType(Uint8Array.from([0xff, 0xd8, 0xff, 0x00]))).toBe(
      "image/jpeg",
    );
    expect(
      detectSupportedMimeType(
        new TextEncoder().encode("%PDF-1.7\ninvoice content"),
      ),
    ).toBe("application/pdf");
  });

  it("rejects a declared type that does not match the bytes", () => {
    const result = validateSourceFile(
      new TextEncoder().encode("%PDF-1.7\ninvoice"),
      "image/jpeg",
      1_000,
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("do not agree");
  });

  it("rejects empty and oversized files", () => {
    expect(validateSourceFile(new Uint8Array(), "image/png", 10).valid).toBe(
      false,
    );
    expect(
      validateSourceFile(
        Uint8Array.from([0xff, 0xd8, 0xff, 0, 0, 0]),
        "image/jpeg",
        4,
      ).valid,
    ).toBe(false);
  });

  it("accepts text CSV exported with the Excel MIME type", () => {
    const result = validateSourceFile(
      new TextEncoder().encode("Vendor,Total\nWegmans,12.34\n"),
      "application/vnd.ms-excel",
      1_000,
    );
    expect(result).toMatchObject({
      valid: true,
      detectedMimeType: "text/csv",
    });
  });
});
