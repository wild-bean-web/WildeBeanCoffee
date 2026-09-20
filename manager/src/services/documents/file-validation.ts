const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "text/csv",
  "application/vnd.ms-excel",
]);

export interface FileValidationResult {
  valid: boolean;
  detectedMimeType?: string;
  reason?: string;
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((byte, index) => bytes[index] === byte);
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return new TextDecoder("ascii").decode(bytes.slice(start, start + length));
}

export function detectSupportedMimeType(
  bytes: Uint8Array,
): string | undefined {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    return "image/webp";
  }
  if (ascii(bytes, 0, 5) === "%PDF-") return "application/pdf";

  const sample = bytes.slice(0, Math.min(bytes.byteLength, 8_192));
  if (
    sample.byteLength > 0 &&
    !sample.includes(0) &&
    new TextDecoder("utf-8", { fatal: false }).decode(sample).includes(",")
  ) {
    return "text/csv";
  }

  return undefined;
}

export function validateSourceFile(
  bytes: Uint8Array,
  declaredMimeType: string,
  maxBytes: number,
): FileValidationResult {
  if (bytes.byteLength === 0) {
    return { valid: false, reason: "The selected file is empty." };
  }

  if (bytes.byteLength > maxBytes) {
    return {
      valid: false,
      reason: `The file exceeds the ${Math.floor(maxBytes / 1024 / 1024)} MB limit.`,
    };
  }

  if (!allowedMimeTypes.has(declaredMimeType)) {
    return {
      valid: false,
      reason: "Only receipt images, PDFs, and CSV files are accepted.",
    };
  }

  const detectedMimeType = detectSupportedMimeType(bytes);
  if (!detectedMimeType) {
    return {
      valid: false,
      reason: "The file content does not match a supported document type.",
    };
  }

  const declaredIsCsv =
    declaredMimeType === "text/csv" ||
    declaredMimeType === "application/vnd.ms-excel";
  if (
    detectedMimeType !== declaredMimeType &&
    !(declaredIsCsv && detectedMimeType === "text/csv")
  ) {
    return {
      valid: false,
      detectedMimeType,
      reason: "The file extension and content type do not agree.",
    };
  }

  return { valid: true, detectedMimeType };
}
